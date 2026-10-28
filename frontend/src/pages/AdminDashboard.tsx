import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, ExternalLink, LogOut, Package, PackageX, ReceiptText, Star, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import ProductsPanel from "@/components/admin/ProductsPanel";
import OrdersPanel from "@/components/admin/OrdersPanel";
import SettingsPanel from "@/components/admin/SettingsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet } from "@/lib/api";
import { brl } from "@/lib/format";
import { endSession } from "@/lib/session";
import type { AdminStats, AuthStatus } from "@/lib/types";

function Stat({ icon: Icon, label, value, testId, accent }: { icon: typeof Package; label: string; value: string | number; testId: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-panel p-4" data-testid={testId}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className={accent ? "mt-2 font-mono text-2xl font-bold text-amber-400" : "mt-2 font-mono text-2xl font-bold text-white"}>{value}</div>
    </div>
  );
}

// Two-tone chime via WebAudio — no asset file needed.
function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1318.5, 880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio unavailable */
  }
}

const SOUND_KEY = "mv_admin_sound";

export default function AdminDashboard() {
  const qc = useQueryClient();
  const [sound, setSound] = useState(() => localStorage.getItem(SOUND_KEY) !== "off");
  const lastNew = useRef<number | null>(null);
  const me = useQuery({ queryKey: ["auth-me"], queryFn: () => apiGet<AuthStatus>("/auth/me"), retry: false });
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiGet<AdminStats>("/admin/stats"),
    enabled: !!me.data?.authenticated,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });

  // Alert when the count of "novo" orders grows between polls.
  const newCount = stats.data?.orders_new;
  useEffect(() => {
    if (newCount === undefined) return;
    if (lastNew.current !== null && newCount > lastNew.current) {
      const diff = newCount - lastNew.current;
      toast.success(diff === 1 ? "Novo pedido chegou!" : `${diff} novos pedidos chegaram!`, { duration: 8000 });
      if (sound) playChime();
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      document.title = `(${newCount}) Novo pedido • Painel MV`;
    } else if (newCount === 0) {
      document.title = "Painel MV";
    }
    lastNew.current = newCount;
  }, [newCount, sound, qc]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    if (next) playChime();
    toast(next ? "Alerta sonoro ativado" : "Alerta sonoro desativado");
  };

  if (me.isLoading) return <div className="grid min-h-dvh place-items-center bg-obsidian text-slate-500">Carregando...</div>;
  if (!me.data?.authenticated) return <Navigate to="/admin" replace />;

  const s = stats.data;
  return (
    <div className="min-h-dvh bg-obsidian">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-obsidian/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo showText={false} />
            <div className="leading-tight">
              <p className="font-heading text-base font-extrabold text-white">Painel MV</p>
              <p className="text-[11px] text-slate-500">Gestão das unidades</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSound}
              title={sound ? "Desativar alerta sonoro" : "Ativar alerta sonoro"}
              aria-label="Alerta sonoro de pedidos"
              data-testid="admin-sound-toggle"
              className={sound ? "grid size-10 place-items-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400 transition-colors" : "grid size-10 place-items-center rounded-xl border border-white/10 text-slate-500 transition-colors hover:text-white"}
            >
              {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            </button>
            <a href="/" target="_blank" rel="noreferrer" data-testid="admin-view-store-link" className="hidden items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition-colors hover:text-white sm:flex">
              <ExternalLink className="size-4" /> Ver loja
            </a>
            <button type="button" onClick={() => endSession("/admin")} data-testid="admin-logout-button" className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-red-500/40 hover:text-red-300">
              <LogOut className="size-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat icon={ReceiptText} label="Pedidos hoje" value={s?.orders_today ?? "–"} testId="stat-orders-today" />
          <Stat icon={TrendingUp} label="Vendas hoje" value={s ? brl(s.revenue_today) : "–"} testId="stat-revenue-today" accent />
          <Stat icon={Package} label="Produtos ativos" value={s?.products_total ?? "–"} testId="stat-products-total" />
          <Stat icon={PackageX} label="Esgotados" value={s?.products_out_of_stock ?? "–"} testId="stat-out-of-stock" />
          <Stat icon={Star} label="Em destaque" value={s?.products_featured ?? "–"} testId="stat-featured" />
        </div>

        <Tabs defaultValue="produtos" className="mt-6">
          <TabsList className="w-full justify-start bg-panel sm:w-auto">
            <TabsTrigger value="produtos" data-testid="admin-tab-products">Produtos</TabsTrigger>
            <TabsTrigger value="pedidos" data-testid="admin-tab-orders">
              Pedidos
              {!!s?.orders_new && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-black">{s.orders_new}</span>}
            </TabsTrigger>
            <TabsTrigger value="config" data-testid="admin-tab-settings">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="produtos" className="mt-5"><ProductsPanel /></TabsContent>
          <TabsContent value="pedidos" className="mt-5"><OrdersPanel /></TabsContent>
          <TabsContent value="config" className="mt-5"><SettingsPanel /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
