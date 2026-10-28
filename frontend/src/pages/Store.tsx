import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bike, Clock, Lock, MapPin, Search, ShoppingBag, Snowflake, Sparkles, Store as StoreIcon, X, Zap } from "lucide-react";
import Logo from "@/components/Logo";
import ProductCard, { ProductImage, QtyControl } from "@/components/ProductCard";
import CartSheet, { WhatsIcon } from "@/components/CartSheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { apiGet } from "@/lib/api";
import { productsQuery, useCart } from "@/lib/cart";
import { brl, CATEGORIES, FALLBACK_SETTINGS, waLink } from "@/lib/format";
import type { Product, PublicSettings, StoreId } from "@/lib/types";
import { cn } from "@/lib/utils";

const HERO = "https://images.unsplash.com/photo-1765991564151-5b37e4bd7be8?crop=entropy&cs=srgb&fm=jpg&q=85&w=1800";

function CartButton() {
  const { count, subtotal, setOpen } = useCart();
  const [bumpKey, setBumpKey] = useState(0);
  const prev = useRef(count);
  useEffect(() => {
    if (count > prev.current) setBumpKey((k) => k + 1);
    prev.current = count;
  }, [count]);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      data-testid="header-cart-button"
      className="relative flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-300 transition-colors hover:bg-amber-500/20"
    >
      <ShoppingBag className="size-5" />
      <span className="hidden font-mono text-sm font-bold sm:inline">{brl(subtotal)}</span>
      {count > 0 && (
        <span key={bumpKey} className="absolute -right-2 -top-2 grid min-w-5 animate-bump place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-black text-black" data-testid="header-cart-count">
          {count}
        </span>
      )}
    </button>
  );
}

function StorePicker({ settings }: { settings: PublicSettings }) {
  const { storeId, setStoreId } = useCart();
  return (
    <div className="inline-flex rounded-2xl border border-white/10 bg-black/40 p-1 backdrop-blur-md" role="radiogroup" aria-label="Unidade">
      {settings.stores.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={storeId === s.id}
          onClick={() => setStoreId(s.id as StoreId)}
          data-testid={`hero-store-${s.id}`}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-[background-color,color] duration-200",
            storeId === s.id ? "bg-amber-500 text-black" : "text-slate-300 hover:text-white",
          )}
        >
          <StoreIcon className="size-4" /> {s.name}
          <span
            className={cn("size-2 rounded-full", s.is_open ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-red-500")}
            title={s.is_open ? "Aberto agora" : "Fechado"}
            data-testid={`hero-store-status-${s.id}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function StorePage() {
  const { data: products, isLoading, isError } = useQuery(productsQuery);
  const { data: settingsData } = useQuery({ queryKey: ["settings"], queryFn: () => apiGet<PublicSettings>("/settings") });
  const settings = settingsData ?? FALLBACK_SETTINGS;
  const cart = useCart();
  const [category, setCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Product | null>(null);

  const list = isError ? [] : (products ?? []);
  const highlights = list.filter((p) => p.featured || p.is_combo).slice(0, 8);
  const presentCats = useMemo(() => CATEGORIES.filter((c) => list.some((p) => p.category === c)).concat(
    Array.from(new Set(list.map((p) => p.category))).filter((c) => !CATEGORIES.includes(c)),
  ), [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter(
      (p) => (category === "Todos" || p.category === category) && (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
    );
  }, [list, category, search]);

  const scrollToCatalog = () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-dvh bg-obsidian pb-28 md:pb-0">
      {/* Announcement marquee */}
      {settings.announcement && (
        <div className="overflow-hidden border-b border-amber-500/20 bg-amber-500 py-1.5 text-black" data-testid="announcement-bar">
          <div className="flex w-max animate-marquee gap-12 whitespace-nowrap text-xs font-bold uppercase tracking-[0.14em]">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="flex items-center gap-2">
                <Zap className="size-3.5" /> {settings.announcement}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-amber-500/15 bg-obsidian/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" data-testid="header-home-link"><Logo /></Link>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={scrollToCatalog}
              placeholder="Buscar cerveja, gelo, combo..."
              data-testid="header-search-input"
              className="h-11 w-full rounded-xl border border-white/10 bg-panel pl-10 pr-4 text-sm text-white placeholder:text-slate-500 transition-[border-color] focus:border-amber-500/60 focus:outline-none"
            />
          </div>
          <CartButton />
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" data-testid="hero-section">
        <img src={HERO} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/90 to-obsidian/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-transparent" />
        <div className="grain absolute inset-0 opacity-60" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 pb-14 pt-8 sm:px-6 sm:pt-16 lg:grid-cols-[1fr_auto] lg:gap-10 lg:px-8 lg:pb-24 lg:pt-20">
          <img
            src="/mvpoint.webp?v=2"
            alt="MV Conveniência — MV é o Point!"
            data-testid="hero-point-logo"
            className="mx-auto size-56 animate-float object-contain drop-shadow-[0_0_40px_rgba(245,158,11,0.25)] sm:size-72 lg:order-2 lg:size-[440px]"
          />
          <div className="max-w-2xl animate-fade-up lg:order-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">
              <Snowflake className="size-3.5" /> Geladas trincando
            </span>
            <h1 className="mt-5 font-heading text-[2.6rem] font-black leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Sua resenha
              <br />
              <span className="text-gold-gradient">começa aqui.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-300 sm:text-lg">
              Cervejas, destilados, combos e petiscos com delivery em São José de Ribamar — ou retire em uma das nossas unidades.
            </p>
            <div className="mt-7 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Escolha sua unidade</p>
              <StorePicker settings={settings} />
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button type="button" onClick={scrollToCatalog} data-testid="hero-cta-button" className="animate-glow rounded-xl bg-amber-500 px-7 py-3.5 font-heading text-base font-extrabold text-black transition-colors hover:bg-amber-400">
                Ver cardápio
              </button>
              <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                <span className="flex items-center gap-1.5"><Bike className="size-4 text-amber-400" /> Delivery SJR</span>
                <span className="flex items-center gap-1.5"><StoreIcon className="size-4 text-amber-400" /> Retirada</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights */}
      {highlights.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8" data-testid="highlights-section">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400"><Sparkles className="size-3.5" /> Destaques da casa</p>
              <h2 className="mt-1 font-heading text-2xl font-black tracking-tight text-white sm:text-3xl">Combos & ofertas</h2>
            </div>
          </div>
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {highlights.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDetail(p)}
                data-testid={`highlight-card-${p.id}`}
                style={{ animationDelay: `${i * 60}ms` }}
                className={cn(
                  "group relative shrink-0 animate-fade-up snap-start overflow-hidden rounded-3xl border border-white/[0.08] text-left transition-[border-color,transform] duration-200 hover:-translate-y-1 hover:border-amber-500/40",
                  i === 0 ? "h-80 w-[82%] sm:h-96 sm:w-[460px]" : "h-80 w-[66%] sm:h-96 sm:w-[300px]",
                )}
              >
                <ProductImage product={p} className={cn("absolute inset-0 transition-transform duration-700 group-hover:scale-105", p.stock <= 0 && "grayscale")} />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute left-4 top-4 flex gap-1.5">
                  {p.is_combo && <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black">Combo</span>}
                  {p.stock <= 0 && <span className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">Esgotado</span>}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-heading text-xl font-extrabold leading-tight text-white sm:text-2xl">{p.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-300 sm:text-sm">{p.description}</p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold text-amber-400">{brl(p.price)}</span>
                    {p.old_price && p.old_price > p.price && <span className="font-mono text-sm text-slate-400 line-through">{brl(p.old_price)}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Catalog */}
      <section id="catalogo" className="mx-auto max-w-7xl scroll-mt-20 px-4 pt-12 sm:px-6 lg:px-8" data-testid="catalog-section">
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400">Cardápio completo</p>
          <h2 className="mt-1 font-heading text-2xl font-black tracking-tight text-white sm:text-3xl">O que tem hoje</h2>
        </div>
        <div className="sticky top-[65px] z-30 -mx-4 border-b border-white/[0.05] bg-obsidian/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="relative mb-3 md:hidden">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              data-testid="catalog-search-input"
              className="h-11 w-full rounded-xl border border-white/10 bg-panel pl-10 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/60 focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Limpar" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {["Todos", ...presentCats].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                data-testid={`category-filter-${c.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-[background-color,border-color,color] duration-150",
                  category === c ? "border-amber-500 bg-amber-500 text-black" : "border-white/10 bg-panel text-slate-300 hover:border-white/25 hover:text-white",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-5">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-[3/4.4] animate-pulse rounded-2xl bg-panel" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center" data-testid="catalog-empty">
              <p className="font-heading text-lg font-bold text-white">{isError ? "Cardápio indisponível no momento" : "Nenhum produto encontrado"}</p>
              <p className="mt-1 text-sm text-slate-400">{isError ? "Tente novamente em instantes." : "Tente outra busca ou categoria."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5" data-testid="product-grid">
              {filtered.map((p, i) => (
                <ProductCard key={p.id} product={p} onOpen={setDetail} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Stores */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8" data-testid="stores-section">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400">Nossas unidades</p>
        <h2 className="mt-1 font-heading text-2xl font-black tracking-tight text-white sm:text-3xl">Duas MVs pra te atender</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {settings.stores.map((s) => (
            <div key={s.id} className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-panel p-6" data-testid={`store-card-${s.id}`}>
              <div className="absolute -right-10 -top-10 size-40 rounded-full bg-amber-500/10 blur-3xl" />
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-heading text-xl font-extrabold text-white">{s.name}</h3>
                {settingsData && <span
                  data-testid={`store-open-badge-${s.id}`}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
                    s.is_open ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", s.is_open ? "animate-pulse bg-emerald-400" : "bg-red-400")} />
                  {s.is_open ? "Aberto agora" : "Fechado"}
                </span>}
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                {s.address && <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-amber-400" /> {s.address}</li>}
                <li className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-amber-400" /> {s.hours || `Das ${s.open_time} às ${s.close_time}`}</li>
              </ul>
              {s.whatsapp && (
                <a href={waLink(s.whatsapp, "Olá, MV! ")} target="_blank" rel="noreferrer" data-testid={`store-whatsapp-${s.id}`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-whatsapp px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1fb955]">
                  <WhatsIcon className="size-4" /> Chamar no WhatsApp
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto mt-16 max-w-7xl border-t border-white/[0.06] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <Logo />
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} MV Conveniência • São José de Ribamar - MA • Venda de bebidas alcoólicas proibida para menores de 18 anos.
          </p>
          <Link to="/admin" aria-label="Área restrita" data-testid="footer-admin-link" className="text-slate-700 transition-colors hover:text-slate-400">
            <Lock className="size-3.5" />
          </Link>
        </div>
      </footer>

      {/* Mobile sticky cart bar */}
      {cart.count > 0 && !cart.open && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          <button
            type="button"
            onClick={() => cart.setOpen(true)}
            data-testid="mobile-cart-bar"
            className="flex w-full animate-fade-up items-center justify-between rounded-2xl bg-amber-500 px-5 py-4 text-black shadow-2xl shadow-amber-500/30 active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 font-bold">
              <span className="grid size-7 place-items-center rounded-lg bg-black/15 font-mono text-sm">{cart.count}</span>
              Ver carrinho
            </span>
            <span className="font-mono text-lg font-black">{brl(cart.subtotal)}</span>
          </button>
        </div>
      )}

      <CartSheet settings={settings} />

      {/* Product detail */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-md overflow-hidden border-white/10 bg-panel p-0 sm:max-w-lg" data-testid="product-detail-dialog">
          {detail && (
            <>
              <div className="relative aspect-[4/3] bg-elevated">
                <ProductImage product={detail} />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-panel to-transparent" />
              </div>
              <div className="space-y-3 px-5 pb-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">{detail.category}</p>
                <DialogTitle className="font-heading text-2xl font-black text-white">{detail.name}</DialogTitle>
                {detail.description && <DialogDescription className="text-sm leading-relaxed text-slate-400">{detail.description}</DialogDescription>}
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-bold text-amber-400">{brl(detail.price)}</span>
                  {detail.old_price && detail.old_price > detail.price && <span className="font-mono text-base text-slate-500 line-through">{brl(detail.old_price)}</span>}
                </div>
                <p className="text-xs text-slate-500">{detail.stock > 0 ? `${detail.stock} disponíveis` : "Sem estoque no momento"}</p>
                <QtyControl product={detail} size="lg" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
