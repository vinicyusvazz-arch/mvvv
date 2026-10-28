import base64
import re
import uuid

from bson import Binary
from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import require_admin
from lib.db import db
from models.schemas import ImageIn, ImageOut, Product, ProductIn, ProductPatch, as_utc, now_utc

router = APIRouter(tags=["products"])
admin = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)], tags=["admin-products"])

SORT = [("featured", -1), ("is_combo", -1), ("created_at", -1)]


def to_product(doc: dict) -> Product:
    doc["created_at"] = as_utc(doc["created_at"])
    doc["updated_at"] = as_utc(doc["updated_at"])
    return Product(**doc)


@router.get("/products", response_model=list[Product])
async def list_products():
    docs = await db.products.find({"archived": False}, {"_id": 0}).sort(SORT).to_list(5000)
    return [to_product(d) for d in docs]


@router.get("/images/{image_id}")
async def get_image(image_id: str):
    doc = await db.images.find_one({"id": image_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Imagem não encontrada")
    return Response(
        content=bytes(doc["data"]),
        media_type=doc["content_type"],
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@admin.get("/products", response_model=list[Product])
async def admin_list_products():
    docs = await db.products.find({}, {"_id": 0}).sort([("archived", 1)] + SORT).to_list(5000)
    return [to_product(d) for d in docs]


@admin.post("/products", response_model=Product)
async def create_product(body: ProductIn):
    now = now_utc()
    product = Product(id=str(uuid.uuid4()), archived=False, created_at=now, updated_at=now, **body.model_dump())
    await db.products.insert_one(product.model_dump())
    return product


@admin.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, body: ProductIn):
    doc = await db.products.find_one_and_update(
        {"id": product_id},
        {"$set": {**body.model_dump(), "updated_at": now_utc()}},
        projection={"_id": 0},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return to_product(doc)


@admin.patch("/products/{product_id}", response_model=Product)
async def patch_product(product_id: str, body: ProductPatch):
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    doc = await db.products.find_one_and_update(
        {"id": product_id},
        {"$set": {**changes, "updated_at": now_utc()}},
        projection={"_id": 0},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return to_product(doc)


DATA_URL = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,(.+)$", re.S)


@admin.post("/images", response_model=ImageOut)
async def upload_image(body: ImageIn):
    m = DATA_URL.match(body.data_url)
    if not m:
        raise HTTPException(status_code=400, detail="Formato de imagem inválido (use JPG, PNG ou WEBP)")
    try:
        raw = base64.b64decode(m.group(2), validate=False)
    except Exception:
        raise HTTPException(status_code=400, detail="Imagem corrompida")
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Imagem muito grande (máx. 8MB)")
    image_id = str(uuid.uuid4())
    await db.images.insert_one({"id": image_id, "content_type": m.group(1), "data": Binary(raw), "created_at": now_utc()})
    return ImageOut(url=f"/api/images/{image_id}")
