import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bike, Copy, MapPin, Phone, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { WhatsIcon } from "@/components/CartSheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { brl, errMsg, PAYMENT_LABEL, STATUS_LABEL, STATUS_STYLE, waLink } from "@/lib/format";
import type { ClearOrdersIn, ClearOrdersOut, Order, OrderStatus, OrderStatusIn } from "@/lib/types";
import { cn } from "@/lib/utils";

function ClearOrdersButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [reset, setReset] = useState(true);

  const clear = useMutation({
    mutationFn: (body: ClearOrdersIn) => apiPost<ClearOrdersOut>("/admin/orders/clear", body),
    onSuccess: (r) => {
      toast.success(`${r.deleted} ${r.deleted === 1 ? "pedido apagado" : "pedidos apagados"}. Próximo pedido: nº ${r.next_number}`);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setOpen(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) {
      setPassword("");
      setReset(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            data-testid="admin-orders-clear-button"
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20"
          />
        }
      >
        <Trash2 className="size-4" /> Limpar pedidos
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-panel sm:max-w-md" data-testid="clear-orders-dialog">
        <DialogTitle className="flex items-center gap-2 font-heading text-xl font-extrabold text-white">
          <AlertTriangle className="size-5 text-red-400" /> Zerar todos os pedidos?
        </DialogTitle>
        <DialogDescription className="text-sm text-slate-400">
          Todos os pedidos (de todos os status) serão <span className="font-semibold text-red-300">apagados de vez</span>, e as vendas do dia voltam para zero. Produtos e estoque não são alterados.
        </DialogDescription>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (password) clear.mutate({ password, reset_numbering: reset });
          }}
        >
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-obsidian p-3">
            <Checkbox checked={reset} onCheckedChange={(v) => setReset(!!v)} data-testid="clear-orders-reset-checkbox" />
            <span className="text-sm text-slate-200">
              Reiniciar numeração <span className="text-slate-500">(próximo pedido volta a ser nº 1001)</span>
            </span>
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite a senha do painel para confirmar"
            autoComplete="current-password"
            className="h-11 bg-obsidian"
            data-testid="clear-orders-password-input"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} data-testid="clear-orders-cancel-button" className="h-11 flex-1 rounded-xl border border-white/10 text-sm font-semibold text-slate-300 hover:text-white">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!password || clear.isPending}
              data-testid="clear-orders-confirm-button"
              className="h-11 flex-1 rounded-xl bg-red-600 text-sm font-bold text-white transition-[background-color,opacity] hover:bg-red-500 disabled:opacity-50"
            >
              {clear.isPending ? "Apagando..." : "Apagar tudo"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const FILTERS: (OrderStatus | "todos")[] = ["todos", "novo", "preparo", "entrega", "concluido", "cancelado"];
const STATUSES: OrderStatus[] = ["novo", "preparo", "entrega", "concluido", "cancelado"];

export default function OrdersPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<OrderStatus | "todos">("todos");
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-orders", filter],
    queryFn: () => apiGet<Order[]>(`/admin/orders${filter === "todos" ? "" : `?status=${filter}`}`),
    refetchInterval: 20_000,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => apiPatch<Order>(`/admin/orders/${id}/status`, { status } satisfies OrderStatusIn),
    onSuccess: (o) => {
      toast.success(`Pedido nº ${o.number}: ${STATUS_LABEL[o.status]}`);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            data-testid={`admin-orders-filter-${s}`}
            className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors", filter === s ? "border-amber-500 bg-amber-500 text-black" : "border-white/10 bg-panel text-slate-300 hover:text-white")}
          >
            {s === "todos" ? "Todos" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>
        <ClearOrdersButton />
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-panel" />)}</div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-slate-400" data-testid="admin-orders-empty">Nenhum pedido por aqui ainda.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2" data-testid="admin-orders-list">
          {data.map((o) => (
            <article key={o.id} className="flex flex-col rounded-2xl border border-white/[0.07] bg-panel p-4" data-testid={`admin-order-card-${o.number}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-xl font-black text-white">#{o.number}</p>
                  <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
                <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-bold", STATUS_STYLE[o.status])} data-testid={`admin-order-status-${o.number}`}>{STATUS_LABEL[o.status]}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="flex items-center gap-1 rounded-lg bg-elevated px-2 py-1 text-slate-300"><Store className="size-3.5 text-amber-400" />{o.store_name}</span>
                <span className="flex items-center gap-1 rounded-lg bg-elevated px-2 py-1 text-slate-300">
                  {o.fulfillment === "delivery" ? <><Bike className="size-3.5 text-amber-400" />Delivery</> : <><Store className="size-3.5 text-amber-400" />Retirada</>}
                </span>
                <span className="rounded-lg bg-elevated px-2 py-1 text-slate-300">{PAYMENT_LABEL[o.payment_method]}{o.change_for ? ` • troco p/ ${brl(o.change_for)}` : ""}</span>
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <p className="font-semibold text-white">{o.customer_name}</p>
                <p className="flex items-center gap-1.5 text-slate-400"><Phone className="size-3.5" />{o.customer_phone}</p>
                {o.fulfillment === "delivery" && (
                  <p className="flex gap-1.5 text-slate-400"><MapPin className="mt-0.5 size-3.5 shrink-0" />{o.street}, {o.number_address}{o.complement && ` - ${o.complement}`} • {o.neighborhood}{o.reference && ` (Ref: ${o.reference})`}</p>
                )}
              </div>

              <ul className="mt-3 space-y-1 border-t border-white/[0.06] pt-3 text-sm">
                {o.items.map((it) => (
                  <li key={it.product_id} className="flex justify-between gap-2 text-slate-300">
                    <span className="truncate">{it.quantity}x {it.name}</span>
                    <span className="shrink-0 font-mono">{brl(it.total)}</span>
                  </li>
                ))}
              </ul>
              {o.notes && <p className="mt-2 rounded-lg bg-elevated p-2 text-xs text-slate-400">Obs: {o.notes}</p>}
              <div className="mt-3 flex items-baseline justify-between border-t border-white/[0.06] pt-3">
                <span className="text-xs text-slate-500">Subtotal</span>
                <span className="font-mono text-lg font-bold text-amber-400">{brl(o.subtotal)}</span>
              </div>

              <div className="mt-3 flex gap-2">
                <Select value={o.status} onValueChange={(v: string) => setStatus.mutate({ id: o.id, status: v as OrderStatus })}>
                  <SelectTrigger className="h-10 flex-1 bg-obsidian" data-testid={`admin-order-status-select-${o.number}`}>
                    <SelectValue>{(v) => STATUS_LABEL[v as OrderStatus]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <a href={waLink(o.customer_phone, `Olá ${o.customer_name.split(" ")[0]}! Aqui é da ${o.store_name} sobre seu pedido nº ${o.number}. `)} target="_blank" rel="noreferrer" title="WhatsApp do cliente" data-testid={`admin-order-whatsapp-${o.number}`} className="grid size-10 place-items-center rounded-xl bg-whatsapp text-white transition-colors hover:bg-[#1fb955]">
                  <WhatsIcon className="size-4" />
                </a>
                <button
                  type="button"
                  title="Copiar comanda"
                  data-testid={`admin-order-copy-${o.number}`}
                  onClick={() => navigator.clipboard.writeText(o.whatsapp_message).then(() => toast.success("Comanda copiada"), () => toast.error("Não foi possível copiar"))}
                  className="grid size-10 place-items-center rounded-xl border border-white/10 text-slate-300 transition-colors hover:text-white"
                >
                  <Copy className="size-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
