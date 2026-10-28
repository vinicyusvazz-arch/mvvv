import re
import uuid
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import quote
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from lib.auth import get_admin_doc, require_admin, verify_password
from lib.db import db
from models.schemas import (
    AdminStats, ClearOrdersIn, ClearOrdersOut, Order, OrderCreated, OrderIn, OrderItem, OrderStatusIn, PublicSettings, as_utc, now_utc,
)

router = APIRouter(tags=["orders"])
admin = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)], tags=["admin-orders"])

TZ = ZoneInfo("America/Fortaleza")  # Maranhão, UTC-3
PAY_LABEL = {"pix": "Pix", "cartao": "Cartão (crédito/débito)", "dinheiro": "Dinheiro"}
LINE = "━━━━━━━━━━━━━━━━━━━━"


def brl(v: float) -> str:
    s = f"{v:,.2f}"
    return "R$ " + s.replace(",", "X").replace(".", ",").replace("X", ".")


def wa_number(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if digits and len(digits) <= 11:
        digits = "55" + digits
    return digits


def build_message(o: Order) -> str:
    when = o.created_at.astimezone(TZ).strftime("%d/%m/%Y às %H:%M")
    tipo = "🛵 Delivery (São José de Ribamar)" if o.fulfillment == "delivery" else "🏪 Retirada na loja"
    lines = [
        "🍻 *NOVO PEDIDO - MV CONVENIÊNCIA*",
        f"*Pedido nº {o.number}*",
        LINE,
        f"📍 *Unidade:* {o.store_name}",
        f"*Tipo:* {tipo}",
        "",
        f"👤 *Cliente:* {o.customer_name}",
        f"📱 *Telefone:* {o.customer_phone}",
    ]
    if o.fulfillment == "delivery":
        addr = f"{o.street}, {o.number_address}"
        if o.complement:
            addr += f" - {o.complement}"
        lines.append(f"🏠 *Endereço:* {addr}")
        lines.append(f"🏘️ *Bairro:* {o.neighborhood} - São José de Ribamar/MA")
        if o.reference:
            lines.append(f"📌 *Referência:* {o.reference}")
    lines += ["", "🛒 *ITENS DO PEDIDO:*"]
    for it in o.items:
        lines.append(f"• {it.quantity}x {it.name} — {brl(it.total)}")
    lines += ["", LINE, f"💰 *Subtotal:* {brl(o.subtotal)}"]
    if o.fulfillment == "delivery":
        lines.append("🛵 *Taxa de entrega:* A combinar")
    pay = PAY_LABEL[o.payment_method]
    if o.payment_method == "dinheiro":
        pay += f" (troco para {brl(o.change_for)})" if o.change_for else " (sem troco)"
    lines.append(f"💳 *Pagamento:* {pay}")
    if o.notes:
        lines.append(f"📝 *Observações:* {o.notes}")
    lines += [LINE, f"🕒 {when}", "", "_Por favor, confirme o pedido e informe o tempo estimado!_ 🙏"]
    return "\n".join(lines)


async def _restock(items: list[tuple[str, int]]) -> None:
    for pid, qty in items:
        await db.products.update_one({"id": pid}, {"$inc": {"stock": qty}})


def to_order(doc: dict) -> Order:
    doc["created_at"] = as_utc(doc["created_at"])
    return Order(**doc)


@router.post("/orders", response_model=OrderCreated)
async def create_order(body: OrderIn):
    settings_doc = await db.settings.find_one({"key": "public"}, {"_id": 0, "key": 0})
    settings = PublicSettings(**settings_doc)
    store = next((s for s in settings.stores if s.id == body.store_id), None)
    if not store:
        raise HTTPException(status_code=400, detail="Unidade inválida")
    if body.fulfillment == "delivery":
        if not (body.street.strip() and body.number.strip() and body.neighborhood.strip()):
            raise HTTPException(status_code=400, detail="Informe rua, número e bairro para o delivery")
    if body.payment_method == "dinheiro" and body.change_for is not None and body.change_for < 0:
        raise HTTPException(status_code=400, detail="Troco inválido")

    # merge duplicate lines
    qty: dict[str, int] = {}
    for it in body.items:
        qty[it.product_id] = qty.get(it.product_id, 0) + it.quantity

    reserved: list[tuple[str, int]] = []
    items: list[OrderItem] = []
    for pid, q in qty.items():
        doc = await db.products.find_one_and_update(
            {"id": pid, "archived": False, "stock": {"$gte": q}},
            {"$inc": {"stock": -q}},
            projection={"_id": 0},
        )
        if not doc:
            await _restock(reserved)
            p = await db.products.find_one({"id": pid}, {"_id": 0, "name": 1, "stock": 1})
            name = p["name"] if p else "Produto"
            left = p.get("stock", 0) if p else 0
            raise HTTPException(status_code=409, detail=f"Estoque insuficiente para {name} (disponível: {left})")
        reserved.append((pid, q))
        items.append(OrderItem(product_id=pid, name=doc["name"], unit_price=doc["price"], quantity=q, total=round(doc["price"] * q, 2)))

    counter = await db.counters.find_one_and_update(
        {"key": "orders"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    number = 1000 + counter["seq"]
    data = body.model_dump(exclude={"items", "number"})
    order = Order(
        id=str(uuid.uuid4()),
        number=number,
        store_name=store.name,
        number_address=body.number,
        items=items,
        subtotal=round(sum(i.total for i in items), 2),
        created_at=now_utc(),
        **data,
    )
    if order.fulfillment == "retirada":
        order.street = order.number_address = order.neighborhood = order.complement = order.reference = ""
    if order.payment_method != "dinheiro":
        order.change_for = None
    order.whatsapp_message = build_message(order)
    await db.orders.insert_one(order.model_dump())

    num = wa_number(store.whatsapp)
    url = f"https://wa.me/{num}?text={quote(order.whatsapp_message)}" if num else f"https://wa.me/?text={quote(order.whatsapp_message)}"
    return OrderCreated(order=order, whatsapp_url=url)


@admin.get("/orders", response_model=list[Order])
async def list_orders(status: Optional[str] = None):
    q = {"status": status} if status else {}
    docs = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [to_order(d) for d in docs]


@admin.post("/orders/clear", response_model=ClearOrdersOut)
async def clear_orders(body: ClearOrdersIn):
    # Password re-check: a stray tap on an unlocked phone must not wipe the history.
    doc = await get_admin_doc()
    if not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Senha incorreta")
    res = await db.orders.delete_many({})
    if body.reset_numbering:
        await db.counters.update_one({"key": "orders"}, {"$set": {"seq": 0}}, upsert=True)
    counter = await db.counters.find_one({"key": "orders"})
    return ClearOrdersOut(deleted=res.deleted_count, next_number=1000 + (counter or {}).get("seq", 0) + 1)


@admin.patch("/orders/{order_id}/status", response_model=Order)
async def set_status(order_id: str, body: OrderStatusIn):
    current = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    prev = current["status"]
    if prev == body.status:
        return to_order(current)
    # cancelling gives stock back; un-cancelling takes it again
    if body.status == "cancelado" and prev != "cancelado":
        await _restock([(i["product_id"], i["quantity"]) for i in current["items"]])
    elif prev == "cancelado":
        await _restock([(i["product_id"], -i["quantity"]) for i in current["items"]])
    doc = await db.orders.find_one_and_update(
        {"id": order_id}, {"$set": {"status": body.status}}, projection={"_id": 0}, return_document=True
    )
    return to_order(doc)


@admin.get("/stats", response_model=AdminStats)
async def stats():
    local_now = datetime.now(TZ)
    start = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_utc = start.astimezone(ZoneInfo("UTC"))
    end_utc = (start + timedelta(days=1)).astimezone(ZoneInfo("UTC"))
    today = await db.orders.find(
        {"created_at": {"$gte": start_utc, "$lt": end_utc}, "status": {"$ne": "cancelado"}}, {"subtotal": 1}
    ).to_list(5000)
    return AdminStats(
        products_total=await db.products.count_documents({"archived": False}),
        products_out_of_stock=await db.products.count_documents({"archived": False, "stock": 0}),
        products_featured=await db.products.count_documents({"archived": False, "featured": True}),
        orders_today=len(today),
        revenue_today=round(sum(o["subtotal"] for o in today), 2),
        orders_new=await db.orders.count_documents({"status": "novo"}),
    )
