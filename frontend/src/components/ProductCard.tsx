import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { brl } from "@/lib/format";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QtyControl({ product, size = "md" }: { product: Product; size?: "md" | "lg" }) {
  const { qtyOf, add, setQty } = useCart();
  const qty = qtyOf(product.id);
  const out = product.stock <= 0;
  const big = size === "lg";

  const onAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (add(product)) {
      if (qty === 0) toast.success(`${product.name} adicionado ao carrinho`);
    } else toast.error(`Só temos ${product.stock} em estoque`);
  };

  if (out)
    return (
      <div
        className={cn("w-full rounded-xl border border-red-500/30 bg-red-500/10 text-center font-semibold text-red-300", big ? "py-3 text-sm" : "py-2 text-xs")}
        data-testid={`product-out-of-stock-${product.id}`}
      >
        Esgotado
      </div>
    );

  if (qty === 0)
    return (
      <button
        type="button"
        onClick={onAdd}
        data-testid={`add-to-cart-${product.id}`}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 font-bold text-black transition-[background-color,transform] duration-150 hover:bg-amber-400 active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none",
          big ? "py-3 text-sm" : "py-2 text-xs sm:text-sm",
        )}
      >
        <Plus className="size-4" strokeWidth={3} /> Adicionar
      </button>
    );

  return (
    <div
      className={cn("flex w-full items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10", big ? "p-1.5" : "p-1")}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Diminuir"
        data-testid={`qty-decrease-${product.id}`}
        onClick={() => setQty(product.id, qty - 1)}
        className="grid size-8 place-items-center rounded-lg text-amber-300 transition-colors hover:bg-amber-500/20 active:scale-90"
      >
        <Minus className="size-4" strokeWidth={3} />
      </button>
      <span className="font-mono text-sm font-bold text-white" data-testid={`qty-value-${product.id}`}>
        {qty}
      </span>
      <button
        type="button"
        aria-label="Aumentar"
        data-testid={`qty-increase-${product.id}`}
        onClick={onAdd}
        className="grid size-8 place-items-center rounded-lg text-amber-300 transition-colors hover:bg-amber-500/20 active:scale-90"
      >
        <Plus className="size-4" strokeWidth={3} />
      </button>
    </div>
  );
}

export function ProductImage({ product, className }: { product: Product; className?: string }) {
  return product.image_url ? (
    <img src={product.image_url} alt={product.name} loading="lazy" className={cn("size-full object-cover", className)} />
  ) : (
    <div className={cn("grid size-full place-items-center bg-gradient-to-br from-elevated to-panel text-slate-600", className)}>
      <ShoppingBag className="size-10" />
    </div>
  );
}

export default function ProductCard({ product, onOpen, index = 0 }: { product: Product; onOpen: (p: Product) => void; index?: number }) {
  const out = product.stock <= 0;
  const discount = product.old_price && product.old_price > product.price ? Math.round((1 - product.price / product.old_price) * 100) : 0;
  return (
    <article
      data-testid={`product-card-${product.id}`}
      onClick={() => onOpen(product)}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
      className="group flex animate-fade-up cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-panel transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/5"
    >
      <div className="relative aspect-square overflow-hidden bg-elevated">
        <ProductImage product={product} className={cn("transition-transform duration-500 group-hover:scale-105", out && "grayscale opacity-50")} />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {product.is_combo && (
            <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black">Combo</span>
          )}
          {product.featured && !product.is_combo && (
            <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black">Destaque</span>
          )}
          {discount > 0 && (
            <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">-{discount}%</span>
          )}
        </div>
        {out && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="rotate-[-8deg] rounded-md border border-red-400/50 bg-red-600/90 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
              Esgotado
            </span>
          </div>
        )}
        {!out && product.stock <= 5 && (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 backdrop-blur">
            Últimas {product.stock} un.
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{product.category}</div>
        <h3 className="line-clamp-2 min-h-[2.5rem] font-heading text-sm font-bold leading-tight text-slate-100 sm:text-[15px]" data-testid={`product-name-${product.id}`}>
          {product.name}
        </h3>
        <div className="mt-auto flex items-baseline gap-2">
          <span className="font-mono text-base font-bold tracking-tight text-amber-400 sm:text-lg" data-testid={`product-price-${product.id}`}>
            {brl(product.price)}
          </span>
          {discount > 0 && <span className="font-mono text-xs text-slate-500 line-through">{brl(product.old_price!)}</span>}
        </div>
        <QtyControl product={product} />
      </div>
    </article>
  );
}
