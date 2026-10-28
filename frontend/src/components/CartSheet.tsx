import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bike, CheckCircle2, Minus, Plus, ShoppingBag, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductImage } from "@/components/ProductCard";
import { apiPost } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { brl, errMsg, formatPhone, NEIGHBORHOODS, parseMoney, waLink } from "@/lib/format";
import type { Fulfillment, OrderCreated, OrderIn, PaymentMethod, PublicSettings, StoreId } from "@/lib/types";
import { cn } from "@/lib/utils";

type Step = "cart" | "checkout" | "done";

const CUSTOMER_KEY = "mv_customer_v1";
interface SavedCustomer {
  name: string;
  phone: string;
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  reference: string;
}
const emptyCustomer: SavedCustomer = { name: "", phone: "", street: "", number: "", neighborhood: "", complement: "", reference: "" };
function loadCustomer(): SavedCustomer {
  try {
    return { ...emptyCustomer, ...(JSON.parse(localStorage.getItem(CUSTOMER_KEY) ?? "{}") as Partial<SavedCustomer>) };
  } catch {
    return emptyCustomer;
  }
}

function Choice({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-[background-color,border-color,color] duration-150",
        active ? "border-amber-500 bg-amber-500/15 text-amber-300" : "border-white/10 bg-elevated text-slate-300 hover:border-white/20",
      )}
    >
      {children}
    </button>
  );
}

export default function CartSheet({ settings }: { settings: PublicSettings }) {
  const cart = useCart();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("cart");
  const [c, setC] = useState<SavedCustomer>(loadCustomer);
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [change, setChange] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<OrderCreated | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const store = settings.stores.find((s) => s.id === cart.storeId) ?? settings.stores[0];
  const set = (k: keyof SavedCustomer, v: string) => setC((p) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: (body: OrderIn) => apiPost<OrderCreated>("/orders", body),
  });

  const onOpenChange = (v: boolean) => {
    cart.setOpen(v);
    if (!v && step === "done") setStep("cart");
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (c.name.trim().length < 2) e.name = "Informe seu nome";
    if (c.phone.replace(/\D/g, "").length < 10) e.phone = "Telefone com DDD";
    if (fulfillment === "delivery") {
      if (!c.street.trim()) e.street = "Informe a rua";
      if (!c.number.trim()) e.number = "Nº";
      if (!c.neighborhood) e.neighborhood = "Escolha o bairro";
    }
    if (payment === "dinheiro" && change.trim()) {
      const v = parseMoney(change);
      if (Number.isNaN(v) || v < cart.subtotal) e.change = `Troco deve ser ≥ ${brl(cart.subtotal)}`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) {
      toast.error("Confira os campos destacados");
      return;
    }
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
    const body: OrderIn = {
      store_id: cart.storeId,
      fulfillment,
      customer_name: c.name.trim(),
      customer_phone: c.phone,
      street: c.street.trim(),
      number: c.number.trim(),
      neighborhood: c.neighborhood,
      complement: c.complement.trim(),
      reference: c.reference.trim(),
      payment_method: payment,
      change_for: payment === "dinheiro" && change.trim() ? parseMoney(change) : null,
      notes: notes.trim(),
      items: cart.lines.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
    };
    // Desktop: open the tab synchronously so the popup blocker allows it; mobile: hand off to the app.
    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    const win = isMobile ? null : window.open("", "_blank");
    mutation.mutate(body, {
      onSuccess: (res) => {
        setResult(res);
        setStep("done");
        cart.clear();
        setNotes("");
        setChange("");
        qc.invalidateQueries({ queryKey: ["products"] });
        toast.success(`Pedido nº ${res.order.number} gerado!`);
        if (win) win.location.href = res.whatsapp_url;
        else window.location.href = res.whatsapp_url;
      },
      onError: (e) => {
        win?.close();
        toast.error(errMsg(e));
        qc.invalidateQueries({ queryKey: ["products"] });
      },
    });
  };

  const fieldErr = (k: string) => errors[k] && <p className="mt-1 text-xs text-red-400">{errors[k]}</p>;

  return (
    <Sheet open={cart.open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 border-l border-white/10 bg-obsidian p-0 sm:max-w-md" data-testid="cart-sheet">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-4 pr-12">
          {step === "checkout" && (
            <button type="button" onClick={() => setStep("cart")} data-testid="checkout-back-button" className="grid size-8 place-items-center rounded-lg bg-elevated text-slate-300 hover:text-white" aria-label="Voltar">
              <ArrowLeft className="size-4" />
            </button>
          )}
          <div>
            <SheetTitle className="font-heading text-lg font-extrabold text-white">
              {step === "cart" ? "Seu carrinho" : step === "checkout" ? "Finalizar pedido" : "Pedido enviado"}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-400">
              {step === "cart" ? `${cart.count} ${cart.count === 1 ? "item" : "itens"} • ${store.name}` : step === "checkout" ? "Comanda vai direto para o WhatsApp da loja" : "Obrigado por comprar na MV!"}
            </SheetDescription>
          </div>
        </div>

        {/* CART */}
        {step === "cart" && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cart.lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center" data-testid="cart-empty">
                  <div className="grid size-16 place-items-center rounded-2xl bg-elevated">
                    <ShoppingBag className="size-7 text-slate-500" />
                  </div>
                  <p className="font-heading text-lg font-bold text-white">Carrinho vazio</p>
                  <p className="max-w-[240px] text-sm text-slate-400">Adicione suas geladas, combos e petiscos favoritos.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {cart.lines.map((l) => (
                    <li key={l.product.id} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-panel p-2.5" data-testid={`cart-line-${l.product.id}`}>
                      <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-elevated">
                        <ProductImage product={l.product} />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{l.product.name}</p>
                          <button type="button" aria-label="Remover" onClick={() => cart.setQty(l.product.id, 0)} data-testid={`cart-remove-${l.product.id}`} className="text-slate-500 transition-colors hover:text-red-400">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div className="mt-auto flex items-center justify-between pt-1.5">
                          <span className="font-mono text-sm font-bold text-amber-400">{brl(l.product.price * l.qty)}</span>
                          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-elevated p-0.5">
                            <button type="button" aria-label="Diminuir" data-testid={`cart-decrease-${l.product.id}`} onClick={() => cart.setQty(l.product.id, l.qty - 1)} className="grid size-7 place-items-center rounded-md text-slate-300 hover:bg-white/10">
                              <Minus className="size-3.5" />
                            </button>
                            <span className="w-6 text-center font-mono text-sm font-bold">{l.qty}</span>
                            <button
                              type="button"
                              aria-label="Aumentar"
                              data-testid={`cart-increase-${l.product.id}`}
                              onClick={() => {
                                if (!cart.add(l.product)) toast.error(`Só temos ${l.product.stock} em estoque`);
                              }}
                              className="grid size-7 place-items-center rounded-md text-slate-300 hover:bg-white/10"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {cart.lines.length > 0 && (
              <div className="border-t border-white/[0.07] bg-panel/80 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
                <div className="mb-1 flex items-center justify-between text-sm text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-xl font-bold text-white" data-testid="cart-subtotal">{brl(cart.subtotal)}</span>
                </div>
                <p className="mb-3 text-xs text-slate-500">Taxa de entrega a combinar no WhatsApp</p>
                <button type="button" onClick={() => setStep("checkout")} data-testid="cart-checkout-button" className="w-full animate-glow rounded-xl bg-amber-500 py-3.5 font-heading text-base font-extrabold text-black transition-colors hover:bg-amber-400 active:scale-[0.99]">
                  Continuar para entrega
                </button>
              </div>
            )}
          </>
        )}

        {/* CHECKOUT */}
        {step === "checkout" && (
          <>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">1. Unidade</p>
                <div className="flex gap-2">
                  {settings.stores.map((s) => (
                    <Choice key={s.id} active={cart.storeId === s.id} onClick={() => cart.setStoreId(s.id as StoreId)} testId={`checkout-store-${s.id}`}>
                      <Store className="size-4" /> {s.name}
                    </Choice>
                  ))}
                </div>
                {!store.is_open && (
                  <p className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-medium text-red-200" data-testid="checkout-store-closed-notice">
                    A {store.name} está fechada agora (abre às {store.open_time}). Você pode enviar o pedido e a loja confirma assim que abrir.
                  </p>
                )}
              </section>

              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">2. Como quer receber?</p>
                <div className="flex gap-2">
                  <Choice active={fulfillment === "delivery"} onClick={() => setFulfillment("delivery")} testId="checkout-fulfillment-delivery">
                    <Bike className="size-4" /> Delivery
                  </Choice>
                  <Choice active={fulfillment === "retirada"} onClick={() => setFulfillment("retirada")} testId="checkout-fulfillment-pickup">
                    <Store className="size-4" /> Retirar na loja
                  </Choice>
                </div>
                {fulfillment === "retirada" ? (
                  <p className="mt-2 rounded-xl border border-white/[0.07] bg-panel p-3 text-xs text-slate-400">
                    Retire na <span className="font-semibold text-white">{store.name}</span>
                    {store.address && <> — {store.address}</>}
                  </p>
                ) : (
                  <p className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-medium text-amber-200" data-testid="checkout-sjr-notice">
                    Entregamos apenas em São José de Ribamar - MA.
                  </p>
                )}
              </section>

              <section className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">3. Seus dados</p>
                <div>
                  <Label htmlFor="c-name" className="mb-1.5 text-xs text-slate-400">Nome completo</Label>
                  <Input id="c-name" value={c.name} onChange={(e) => set("name", e.target.value)} placeholder="Seu nome" className="h-11 bg-panel" data-testid="checkout-name-input" />
                  {fieldErr("name")}
                </div>
                <div>
                  <Label htmlFor="c-phone" className="mb-1.5 text-xs text-slate-400">WhatsApp / Telefone</Label>
                  <Input id="c-phone" inputMode="tel" value={c.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="(98) 99999-9999" className="h-11 bg-panel" data-testid="checkout-phone-input" />
                  {fieldErr("phone")}
                </div>
                {fulfillment === "delivery" && (
                  <>
                    <div className="grid grid-cols-[1fr_88px] gap-2">
                      <div>
                        <Label htmlFor="c-street" className="mb-1.5 text-xs text-slate-400">Rua / Avenida</Label>
                        <Input id="c-street" value={c.street} onChange={(e) => set("street", e.target.value)} placeholder="Rua..." className="h-11 bg-panel" data-testid="checkout-street-input" />
                        {fieldErr("street")}
                      </div>
                      <div>
                        <Label htmlFor="c-number" className="mb-1.5 text-xs text-slate-400">Número</Label>
                        <Input id="c-number" value={c.number} onChange={(e) => set("number", e.target.value)} placeholder="Nº" className="h-11 bg-panel" data-testid="checkout-number-input" />
                        {fieldErr("number")}
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1.5 text-xs text-slate-400">Bairro (São José de Ribamar)</Label>
                      <Select value={c.neighborhood} onValueChange={(v: string) => set("neighborhood", v)}>
                        <SelectTrigger className="h-11 w-full bg-panel" data-testid="checkout-neighborhood-select">
                          <SelectValue>{(v) => (v ? String(v) : <span className="text-slate-500">Selecione o bairro</span>)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {NEIGHBORHOODS.map((n) => (
                            <SelectItem key={n} value={n} data-testid={`neighborhood-option-${n.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldErr("neighborhood")}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="c-comp" className="mb-1.5 text-xs text-slate-400">Complemento</Label>
                        <Input id="c-comp" value={c.complement} onChange={(e) => set("complement", e.target.value)} placeholder="Apto, casa..." className="h-11 bg-panel" data-testid="checkout-complement-input" />
                      </div>
                      <div>
                        <Label htmlFor="c-ref" className="mb-1.5 text-xs text-slate-400">Referência</Label>
                        <Input id="c-ref" value={c.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Perto de..." className="h-11 bg-panel" data-testid="checkout-reference-input" />
                      </div>
                    </div>
                  </>
                )}
              </section>

              <section className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">4. Pagamento</p>
                <div className="flex gap-2">
                  {(["pix", "cartao", "dinheiro"] as PaymentMethod[]).map((p) => (
                    <Choice key={p} active={payment === p} onClick={() => setPayment(p)} testId={`checkout-payment-${p}`}>
                      {p === "pix" ? "Pix" : p === "cartao" ? "Cartão" : "Dinheiro"}
                    </Choice>
                  ))}
                </div>
                {payment === "dinheiro" && (
                  <div>
                    <Label htmlFor="c-change" className="mb-1.5 text-xs text-slate-400">Troco para quanto? (opcional)</Label>
                    <Input id="c-change" inputMode="decimal" value={change} onChange={(e) => setChange(e.target.value)} placeholder="Ex: 100,00" className="h-11 bg-panel" data-testid="checkout-change-input" />
                    {fieldErr("change")}
                  </div>
                )}
                <div>
                  <Label htmlFor="c-notes" className="mb-1.5 text-xs text-slate-400">Observações</Label>
                  <Textarea id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Ex: cerveja bem gelada, sem gelo..." className="min-h-20 bg-panel" data-testid="checkout-notes-input" />
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-panel p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">Resumo</p>
                <ul className="space-y-1.5 text-sm">
                  {cart.lines.map((l) => (
                    <li key={l.product.id} className="flex justify-between gap-3 text-slate-300">
                      <span className="truncate">{l.qty}x {l.product.name}</span>
                      <span className="shrink-0 font-mono">{brl(l.qty * l.product.price)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between border-t border-white/[0.07] pt-3 text-sm">
                  <span className="text-slate-400">Entrega</span>
                  <span className="text-slate-300">{fulfillment === "delivery" ? "A combinar" : "Retirada"}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-semibold text-white">Subtotal</span>
                  <span className="font-mono text-xl font-bold text-amber-400" data-testid="checkout-subtotal">{brl(cart.subtotal)}</span>
                </div>
              </section>
            </div>
            <div className="border-t border-white/[0.07] bg-panel/80 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
              <button
                type="button"
                onClick={submit}
                disabled={mutation.isPending || cart.lines.length === 0}
                data-testid="checkout-submit-button"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-whatsapp py-3.5 font-heading text-base font-extrabold text-white shadow-lg shadow-green-500/20 transition-[background-color,opacity] hover:bg-[#1fb955] disabled:opacity-60"
              >
                <WhatsIcon />
                {mutation.isPending ? "Gerando comanda..." : "Enviar pedido no WhatsApp"}
              </button>
            </div>
          </>
        )}

        {/* DONE */}
        {step === "done" && result && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center" data-testid="order-success">
            <div className="relative">
              <img src="/mvpoint.webp?v=2" alt="MV é o Point!" className="size-40 object-contain" />
              <div className="absolute -bottom-1 -right-1 grid size-12 place-items-center rounded-full bg-emerald-500 ring-4 ring-obsidian">
                <CheckCircle2 className="size-7 text-white" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400">Pedido nº</p>
              <p className="font-heading text-5xl font-black text-white" data-testid="order-success-number">{result.order.number}</p>
            </div>
            <p className="max-w-xs text-sm text-slate-400">
              Sua comanda foi gerada para a <span className="font-semibold text-white">{result.order.store_name}</span>. Toque em enviar no WhatsApp para confirmarmos seu pedido.
            </p>
            <a href={result.whatsapp_url} target="_blank" rel="noreferrer" data-testid="order-success-whatsapp-link" className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-whatsapp py-3.5 font-bold text-white transition-colors hover:bg-[#1fb955]">
              <WhatsIcon /> Abrir WhatsApp novamente
            </a>
            {store.whatsapp && (
              <a href={waLink(store.whatsapp)} target="_blank" rel="noreferrer" className="text-xs text-slate-500 underline-offset-4 hover:underline">
                Falar com a loja
              </a>
            )}
            <button type="button" onClick={() => onOpenChange(false)} data-testid="order-success-continue-button" className="text-sm font-semibold text-amber-400 hover:text-amber-300">
              Continuar comprando
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function WhatsIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.91-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.81 11.81 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41" />
    </svg>
  );
}
