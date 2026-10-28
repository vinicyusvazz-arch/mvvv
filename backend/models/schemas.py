"""Pydantic models — every one has a hand-written TS mirror in frontend/src/lib/types.ts."""
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

StoreId = Literal["sjr", "pitangueiras"]
Fulfillment = Literal["retirada", "delivery"]
PaymentMethod = Literal["pix", "cartao", "dinheiro"]
OrderStatus = Literal["novo", "preparo", "entrega", "concluido", "cancelado"]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    """Motor returns naive datetimes; normalise to aware UTC on read."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ---------- Products ----------
class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=600)
    category: str = Field(min_length=1, max_length=60)
    price: float = Field(gt=0, le=100000)
    old_price: Optional[float] = Field(default=None, ge=0, le=100000)
    stock: int = Field(ge=0, le=100000)
    featured: bool = False
    is_combo: bool = False
    image_url: str = Field(default="", max_length=2000)


class ProductPatch(BaseModel):
    stock: Optional[int] = Field(default=None, ge=0, le=100000)
    featured: Optional[bool] = None
    archived: Optional[bool] = None


class Product(ProductIn):
    id: str
    archived: bool = False
    created_at: datetime
    updated_at: datetime


# ---------- Images ----------
class ImageIn(BaseModel):
    data_url: str = Field(min_length=20, max_length=12_000_000)


class ImageOut(BaseModel):
    url: str


# ---------- Settings ----------
class StoreInfo(BaseModel):
    id: StoreId
    name: str = Field(min_length=1, max_length=60)
    whatsapp: str = Field(default="", max_length=20)
    address: str = Field(default="", max_length=160)
    hours: str = Field(default="", max_length=80)
    open_time: str = Field(default="10:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    close_time: str = Field(default="02:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    is_open: bool = False  # computed on read (America/Fortaleza); ignored on write


class PublicSettings(BaseModel):
    stores: list[StoreInfo]
    announcement: str = Field(default="", max_length=160)


# ---------- Auth ----------
class LoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class AuthStatus(BaseModel):
    authenticated: bool


# ---------- Orders ----------
class OrderItemIn(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=99)


class OrderIn(BaseModel):
    store_id: StoreId
    fulfillment: Fulfillment
    customer_name: str = Field(min_length=2, max_length=80)
    customer_phone: str = Field(min_length=8, max_length=20)
    street: str = Field(default="", max_length=120)
    number: str = Field(default="", max_length=20)
    neighborhood: str = Field(default="", max_length=80)
    complement: str = Field(default="", max_length=120)
    reference: str = Field(default="", max_length=120)
    payment_method: PaymentMethod
    change_for: Optional[float] = Field(default=None, ge=0, le=100000)
    notes: str = Field(default="", max_length=300)
    items: list[OrderItemIn] = Field(min_length=1, max_length=50)


class OrderItem(BaseModel):
    product_id: str
    name: str
    unit_price: float
    quantity: int
    total: float


class Order(BaseModel):
    id: str
    number: int
    store_id: StoreId
    store_name: str
    fulfillment: Fulfillment
    customer_name: str
    customer_phone: str
    street: str = ""
    number_address: str = ""
    neighborhood: str = ""
    complement: str = ""
    reference: str = ""
    payment_method: PaymentMethod
    change_for: Optional[float] = None
    notes: str = ""
    items: list[OrderItem]
    subtotal: float
    status: OrderStatus = "novo"
    whatsapp_message: str = ""
    created_at: datetime


class OrderCreated(BaseModel):
    order: Order
    whatsapp_url: str


class OrderStatusIn(BaseModel):
    status: OrderStatus


class ClearOrdersIn(BaseModel):
    password: str = Field(min_length=1, max_length=128)
    reset_numbering: bool = False


class ClearOrdersOut(BaseModel):
    deleted: int
    next_number: int


class AdminStats(BaseModel):
    products_total: int
    products_out_of_stock: int
    products_featured: int
    orders_today: int
    revenue_today: float
    orders_new: int
