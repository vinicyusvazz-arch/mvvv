import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Minus, Pencil, Plus, Search, Star } from "lucide-react";
import { toast } from "sonner";
import ProductFormDialog from "@/components/admin/ProductFormDialog";
import { ProductImage } from "@/components/ProductCard";
import { apiGet, apiPatch } from "@/lib/api";
import { brl, errMsg } from "@/lib/format";
import type { Product, ProductPatch } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "ativos" | "esgotados" | "arquivados";

export default function ProductsPanel() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-products"], queryFn: () => apiGet<Product[]>("/admin/products") });
  const [view, setView] = useState<View>("ativos");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProductPatch }) => apiPatch<Product>(`/admin/products/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const counts = useMemo(
    () => ({
      ativos: data.filter((p) => !p.archived).length,
      esgotados: data.filter((p) => !p.archived && p.stock === 0).length,
      arquivados: data.filter((p) => p.archived).length,
    }),
    [data],
  );

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data
      .filter((p) => (view === "arquivados" ? p.archived : !p.archived && (view === "ativos" || p.stock === 0)))
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s));
  }, [data, view, q]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {(["ativos", "esgotados", "arquivados"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              data-testid={`admin-products-view-${v}`}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold capitalize transition-colors",
                view === v ? "border-amber-500 bg-amber-500 text-black" : "border-white/10 bg-panel text-slate-300 hover:text-white",
              )}
            >
              {v} <span className="opacity-70">({counts[v]})</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto" data-testid="admin-products-search-input" className="h-10 w-full rounded-xl border border-white/10 bg-panel pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/60 focus:outline-none" />
          </div>
          <button type="button" onClick={openNew} data-testid="admin-new-product-button" className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 text-sm font-bold text-black transition-colors hover:bg-amber-400">
            <Plus className="size-4" strokeWidth={3} /> Novo produto
          </button>
        </div>
      </div>

      {view === "arquivados" && (
        <p className="rounded-xl border border-white/[0.07] bg-panel p-3 text-xs text-slate-400">
          Produtos arquivados ficam salvos para sempre e podem ser restaurados a qualquer momento. Nada é apagado.
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-panel" />)}</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-slate-400" data-testid="admin-products-empty">
          Nenhum produto aqui.
        </div>
      ) : (
        <ul className="space-y-2" data-testid="admin-products-list">
          {list.map((p) => (
            <li key={p.id} className={cn("flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-panel p-2.5 sm:p-3", p.archived && "opacity-60")} data-testid={`admin-product-row-${p.id}`}>
              <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-elevated sm:size-16">
                <ProductImage product={p} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate font-semibold text-white" data-testid={`admin-product-name-${p.id}`}>{p.name}</p>
                  {p.is_combo && <span className="rounded bg-amber-500/20 px-1.5 text-[10px] font-bold uppercase text-amber-300">Combo</span>}
                  {p.stock === 0 && !p.archived && <span className="rounded bg-red-500/20 px-1.5 text-[10px] font-bold uppercase text-red-300">Esgotado</span>}
                </div>
                <p className="text-xs text-slate-500">{p.category} • <span className="font-mono text-amber-400">{brl(p.price)}</span></p>
                {/* stock stepper on mobile below the name */}
                <div className="mt-1.5 flex items-center gap-1 sm:hidden">
                  <StockStepper p={p} onChange={(stock) => patch.mutate({ id: p.id, body: { stock } })} />
                </div>
              </div>
              <div className="hidden items-center gap-1 sm:flex">
                <StockStepper p={p} onChange={(stock) => patch.mutate({ id: p.id, body: { stock } })} />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <IconBtn
                  label={p.featured ? "Remover destaque" : "Destacar"}
                  testId={`admin-product-feature-${p.id}`}
                  active={p.featured}
                  onClick={() => patch.mutate({ id: p.id, body: { featured: !p.featured } }, { onSuccess: () => toast.success(p.featured ? "Destaque removido" : "Produto em destaque!") })}
                >
                  <Star className={cn("size-4", p.featured && "fill-amber-400")} />
                </IconBtn>
                <IconBtn label="Editar" testId={`admin-product-edit-${p.id}`} onClick={() => { setEditing(p); setFormOpen(true); }}>
                  <Pencil className="size-4" />
                </IconBtn>
                <IconBtn
                  label={p.archived ? "Restaurar" : "Arquivar"}
                  testId={`admin-product-archive-${p.id}`}
                  onClick={() => patch.mutate({ id: p.id, body: { archived: !p.archived } }, { onSuccess: () => toast.success(p.archived ? "Produto restaurado na loja" : "Produto arquivado (fica salvo)") })}
                >
                  {p.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                </IconBtn>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />
    </div>
  );
}

function StockStepper({ p, onChange }: { p: Product; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-elevated p-0.5" title="Estoque">
      <button type="button" aria-label="Diminuir estoque" disabled={p.stock === 0} onClick={() => onChange(Math.max(0, p.stock - 1))} data-testid={`admin-stock-decrease-${p.id}`} className="grid size-7 place-items-center rounded-md text-slate-300 hover:bg-white/10 disabled:opacity-30">
        <Minus className="size-3.5" />
      </button>
      <span className={cn("min-w-8 text-center font-mono text-sm font-bold", p.stock === 0 ? "text-red-400" : "text-white")} data-testid={`admin-stock-value-${p.id}`}>{p.stock}</span>
      <button type="button" aria-label="Aumentar estoque" onClick={() => onChange(p.stock + 1)} data-testid={`admin-stock-increase-${p.id}`} className="grid size-7 place-items-center rounded-md text-slate-300 hover:bg-white/10">
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function IconBtn({ children, label, onClick, testId, active }: { children: React.ReactNode; label: string; onClick: () => void; testId: string; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      data-testid={testId}
      className={cn("grid size-9 place-items-center rounded-xl border transition-colors", active ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "border-white/10 text-slate-400 hover:text-white")}
    >
      {children}
    </button>
  );
}
