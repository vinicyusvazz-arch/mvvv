from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.auth import (
    check_rate_limit, clear_fails, clear_session, client_ip, get_admin_doc, hash_password,
    is_admin, register_fail, require_admin, set_session, verify_password,
)
from lib.db import db
from models.schemas import AuthStatus, LoginIn, PasswordChangeIn, now_utc

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthStatus)
async def login(body: LoginIn, request: Request, response: Response):
    ip = client_ip(request)
    check_rate_limit(ip)
    doc = await get_admin_doc()
    if not verify_password(body.password, doc["password_hash"]):
        register_fail(ip)
        raise HTTPException(status_code=401, detail="Senha incorreta")
    clear_fails(ip)
    set_session(response, request, doc["password_hash"])
    return AuthStatus(authenticated=True)


@router.post("/logout", response_model=AuthStatus)
async def logout(response: Response):
    clear_session(response)
    return AuthStatus(authenticated=False)


@router.get("/me", response_model=AuthStatus)
async def me(request: Request):
    return AuthStatus(authenticated=await is_admin(request))


@router.post("/password", response_model=AuthStatus, dependencies=[Depends(require_admin)])
async def change_password(body: PasswordChangeIn, request: Request, response: Response):
    doc = await get_admin_doc()
    if not verify_password(body.current_password, doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    new_hash = hash_password(body.new_password)
    await db.admin.update_one({"key": "admin"}, {"$set": {"password_hash": new_hash, "updated_at": now_utc()}})
    set_session(response, request, new_hash)  # keep this device logged in, others are invalidated
    return AuthStatus(authenticated=True)
