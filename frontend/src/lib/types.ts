// Hand-written mirrors of backend/models/schemas.py — keep in sync.
export type StoreId = "sjr" | "pitangueiras";
export type Fulfillment = "retirada" | "delivery";
export type PaymentMethod = "pix" | "cartao" | "dinheiro";
export type OrderStatus = "novo" | "preparo" | "entrega" | "concluido" | "cancelado";

export interface ProductIn {
  name: string;
  description: string;
  category: string;
  price: number;
  old_price: number | null;
  stock: number;
  featured: boolean;
  is_combo: boolean;
  image_url: string;
}

export interface ProductPatch {
  stock?: number;
  featured?: boolean;
  archived?: boolean;
}

export interface Product extends ProductIn {
  id: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ImageIn {
  data_url: string;
}
export interface ImageOut {
  url: string;
}

export interface StoreInfo {
  id: StoreId;
  name: string;
  whatsapp: string;
  address: string;
  hours: string;
  open_time: string;
  close_time: string;
  is_open: boolean;
}

export interface PublicSettings {
  stores: StoreInfo[];
  announcement: string;
}

export interface LoginIn {
  password: string;
}
export interface PasswordChangeIn {
  current_password: string;
  new_password: string;
}
export interface AuthStatus {
  authenticated: boolean;
}

export interface OrderItemIn {
  product_id: string;
  quantity: number;
}

export interface OrderIn {
  store_id: StoreId;
  fulfillment: Fulfillment;
  customer_name: string;
  customer_phone: string;
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  reference: string;
  payment_method: PaymentMethod;
  change_for: number | null;
  notes: string;
  items: OrderItemIn[];
}

export interface OrderItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total: number;
}

export interface Order {
  id: string;
  number: number;
  store_id: StoreId;
  store_name: string;
  fulfillment: Fulfillment;
  customer_name: string;
  customer_phone: string;
  street: string;
  number_address: string;
  neighborhood: string;
  complement: string;
  reference: string;
  payment_method: PaymentMethod;
  change_for: number | null;
  notes: string;
  items: OrderItem[];
  subtotal: number;
  status: OrderStatus;
  whatsapp_message: string;
  created_at: string;
}

export interface OrderCreated {
  order: Order;
  whatsapp_url: string;
}

export interface OrderStatusIn {
  status: OrderStatus;
}

export interface ClearOrdersIn {
  password: string;
  reset_numbering: boolean;
}

export interface ClearOrdersOut {
  deleted: number;
  next_number: number;
}

export interface AdminStats {
  products_total: number;
  products_out_of_stock: number;
  products_featured: number;
  orders_today: number;
  revenue_today: number;
  orders_new: number;
}
