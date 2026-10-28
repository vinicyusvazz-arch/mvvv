"""Single-password admin auth: PBKDF2 hash in Mongo, JWT in an httpOnly cookie."""
import hashlib
import hmac
import os
import secrets
import time

import jwt
from fastapi import HTTPException, Request, Response

from lib.db import db

COOKIE = "mv_admin"
SECRET = os.environ["JWT_SECRET"]
SESSION_SECONDS = 60 * 60 * 12
_ITER = 240_000

# naive in-memory brute-force guard: ip -> (fails, first_fail_ts)
_FAILS: dict[str, tuple[int, float]] = {}
MAX_FAILS = 8
WINDOW = 15 * 60


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _ITER)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, _ = stored.split("$", 1)
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(password, salt), stored)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?")


def check_rate_limit(ip: str) -> None:
    fails, first = _FAILS.get(ip, (0, 0.0))
    if fails >= MAX_FAILS and time.time() - first < WINDOW:
        raise HTTPException(status_code=429, detail="Muitas tentativas. Aguarde alguns minutos.")
    if time.time() - first >= WINDOW:
        _FAILS.pop(ip, None)


def register_fail(ip: str) -> None:
    fails, first = _FAILS.get(ip, (0, time.time()))
    _FAILS[ip] = (fails + 1, first)


def clear_fails(ip: str) -> None:
    _FAILS.pop(ip, None)


async def get_admin_doc() -> dict:
    doc = await db.admin.find_one({"key": "admin"})
    if not doc:
        raise HTTPException(status_code=500, detail="Admin não configurado")
    return doc


def _fingerprint(password_hash: str) -> str:
    return password_hash[-16:]


def set_session(response: Response, request: Request, password_hash: str) -> None:
    token = jwt.encode(
        {"sub": "admin", "pv": _fingerprint(password_hash), "exp": int(time.time()) + SESSION_SECONDS},
        SECRET,
        algorithm="HS256",
    )
    secure = request.headers.get("x-forwarded-proto", request.url.scheme) == "https"
    response.set_cookie(
        COOKIE, token, httponly=True, samesite="lax", secure=secure, max_age=SESSION_SECONDS, path="/"
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")


async def is_admin(request: Request) -> bool:
    token = request.cookies.get(COOKIE)
    if not token:
        return False
    try:
        payload = jwt.decode(token, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return False
    doc = await db.admin.find_one({"key": "admin"})
    # changing the password invalidates every open session
    return bool(doc) and payload.get("pv") == _fingerprint(doc["password_hash"])


async def require_admin(request: Request) -> None:
    if not await is_admin(request):
        raise HTTPException(status_code=401, detail="Não autorizado")
