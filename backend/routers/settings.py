from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_admin
from lib.db import db
from models.schemas import PublicSettings, StoreInfo

router = APIRouter(tags=["settings"])
admin = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)], tags=["admin-settings"])

TZ = ZoneInfo("America/Fortaleza")


def _minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def compute_open(store: StoreInfo, now: datetime | None = None) -> bool:
    now = now or datetime.now(TZ)
    cur = now.hour * 60 + now.minute
    o, c = _minutes(store.open_time), _minutes(store.close_time)
    if o == c:
        return True  # 24h
    return o <= cur < c if o < c else (cur >= o or cur < c)  # handles past-midnight closing


def with_status(s: PublicSettings) -> PublicSettings:
    for store in s.stores:
        store.is_open = compute_open(store)
    return s


@router.get("/settings", response_model=PublicSettings)
async def get_settings():
    doc = await db.settings.find_one({"key": "public"}, {"_id": 0, "key": 0})
    if not doc:
        raise HTTPException(status_code=503, detail="Configurações indisponíveis")
    return with_status(PublicSettings(**doc))


@admin.put("/settings", response_model=PublicSettings)
async def update_settings(body: PublicSettings):
    ids = sorted(s.id for s in body.stores)
    if ids != ["pitangueiras", "sjr"]:
        raise HTTPException(status_code=400, detail="As duas unidades são obrigatórias")
    data = body.model_dump()
    for s in data["stores"]:
        s.pop("is_open", None)
    await db.settings.update_one({"key": "public"}, {"$set": data}, upsert=True)
    return with_status(body)
