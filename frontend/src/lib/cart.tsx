import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import type { Product, StoreId } from "./types";

interface StoredLine {
  id: string;
  qty: number;
}
export interface CartLine {
  product: Product;
  qty: number;
}

interface CartValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  storeId: StoreId;
  setStoreId: (id: StoreId) => void;
  add: (p: Product, n?: number) => boolean;
  setQty: (id: string, qty: number) => void;
  qtyOf: (id: string) => number;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const CartContext = createContext<CartValue | null>(null);
const KEY = "mv_cart_v1";
const STORE_KEY = "mv_store_v1";

export const productsQuery = {
  queryKey: ["products"],
  queryFn: () => apiGet<Product[]>("/products"),
  refetchInterval: 60_000,
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<StoredLine[]>(() => load(KEY, []));
  const [storeId, setStoreId] = useState<StoreId>(() => load<StoreId>(STORE_KEY, "sjr"));
  const [open, setOpen] = useState(false);
  const { data: products } = useQuery(productsQuery);

  useEffect(() => localStorage.setItem(KEY, JSON.stringify(stored)), [stored]);
  useEffect(() => localStorage.setItem(STORE_KEY, JSON.stringify(storeId)), [storeId]);

  // Lines always resolve against the live catalogue: fresh price and stock, archived items drop out.
  const lines = useMemo<CartLine[]>(() => {
    if (!products) return [];
    const byId = new Map(products.map((p) => [p.id, p]));
    return stored.flatMap((l) => {
      const p = byId.get(l.id);
      if (!p || p.stock <= 0) return [];
      return [{ product: p, qty: Math.min(l.qty, p.stock) }];
    });
  }, [stored, products]);

  const qtyOf = useCallback((id: string) => stored.find((l) => l.id === id)?.qty ?? 0, [stored]);

  const add = useCallback(
    (p: Product, n = 1) => {
      const current = stored.find((l) => l.id === p.id)?.qty ?? 0;
      if (current + n > p.stock) return false;
      setStored((s) =>
        s.some((l) => l.id === p.id)
          ? s.map((l) => (l.id === p.id ? { ...l, qty: l.qty + n } : l))
          : [...s, { id: p.id, qty: n }],
      );
      return true;
    },
    [stored],
  );

  const setQty = useCallback((id: string, qty: number) => {
    setStored((s) => (qty <= 0 ? s.filter((l) => l.id !== id) : s.map((l) => (l.id === id ? { ...l, qty } : l))));
  }, []);

  const clear = useCallback(() => setStored([]), []);

  const value = useMemo<CartValue>(
    () => ({
      lines,
      count: lines.reduce((a, l) => a + l.qty, 0),
      subtotal: Math.round(lines.reduce((a, l) => a + l.qty * l.product.price, 0) * 100) / 100,
      storeId,
      setStoreId,
      add,
      setQty,
      qtyOf,
      clear,
      open,
      setOpen,
    }),
    [lines, storeId, add, setQty, qtyOf, clear, open],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart outside CartProvider");
  return ctx;
}
