import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Megaphone, Store } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { errMsg, formatPhone } from "@/lib/format";
import type { AuthStatus, PasswordChangeIn, PublicSettings, StoreInfo } from "@/lib/types";

export default function SettingsPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => apiGet<PublicSettings>("/settings") });
  const [form, setForm] = useState<PublicSettings | null>(null);
  const [pw, setPw] = useState<PasswordChangeIn>({ current_password: "", new_password: "" });
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (body: PublicSettings) => apiPut<PublicSettings>("/admin/settings", body),
    onSuccess: (s) => {
      qc.setQueryData(["settings"], s);
      toast.success("Configurações salvas");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const changePw = useMutation({
    mutationFn: (body: PasswordChangeIn) => apiPost<AuthStatus>("/auth/password", body),
    onSuccess: () => {
      toast.success("Senha alterada! Outros dispositivos foram desconectados.");
      setPw({ current_password: "", new_password: "" });
      setConfirm("");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const setStore = (id: string, k: keyof StoreInfo, v: string) =>
    setForm((f) => (f ? { ...f, stores: f.stores.map((s) => (s.id === id ? { ...s, [k]: v } : s)) } : f));

  if (!form) return <div className="h-64 animate-pulse rounded-2xl bg-panel" />;

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <section className="space-y-4 lg:col-span-8">
        <div className="rounded-2xl border border-whatsapp/30 bg-whatsapp/5 p-5" data-testid="settings-whatsapp-card">
          <h3 className="font-heading text-lg font-extrabold text-white">WhatsApp das lojas</h3>
          <p className="mt-1 text-xs text-slate-400">Um único número recebe as comandas das duas unidades (a comanda informa qual unidade).</p>
          <Input
            inputMode="tel"
            value={form.stores[0]?.whatsapp ?? ""}
            onChange={(e) => {
              const v = formatPhone(e.target.value);
              setForm((f) => (f ? { ...f, stores: f.stores.map((s) => ({ ...s, whatsapp: v })) } : f));
            }}
            placeholder="(98) 99999-9999"
            className="mt-3 h-11 bg-obsidian"
            data-testid="settings-whatsapp-input"
          />
          {!form.stores[0]?.whatsapp && <p className="mt-2 text-xs text-amber-300">Sem número cadastrado: o cliente escolhe o contato manualmente no WhatsApp.</p>}
        </div>
        {form.stores.map((s) => (
          <div key={s.id} className="rounded-2xl border border-white/[0.07] bg-panel p-5" data-testid={`settings-store-${s.id}`}>
            <h3 className="flex items-center gap-2 font-heading text-lg font-extrabold text-white"><Store className="size-5 text-amber-400" /> {s.name}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="mb-1.5 text-xs text-slate-400">Texto do horário (exibido no site)</Label>
                <Input value={s.hours} onChange={(e) => setStore(s.id, "hours", e.target.value)} placeholder="Todos os dias, 10h às 02h" className="h-11 bg-obsidian" data-testid={`settings-hours-${s.id}`} />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                <div>
                  <Label className="mb-1.5 text-xs text-slate-400">Abre às</Label>
                  <Input type="time" value={s.open_time} onChange={(e) => setStore(s.id, "open_time", e.target.value)} className="h-11 bg-obsidian" data-testid={`settings-open-time-${s.id}`} />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs text-slate-400">Fecha às</Label>
                  <Input type="time" value={s.close_time} onChange={(e) => setStore(s.id, "close_time", e.target.value)} className="h-11 bg-obsidian" data-testid={`settings-close-time-${s.id}`} />
                </div>
                <p className="col-span-2 text-[11px] text-slate-500">Define o selo "Aberto agora / Fechado". Fechamento após meia-noite é suportado; horários iguais = 24h.</p>
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1.5 text-xs text-slate-400">Endereço</Label>
                <Input value={s.address} onChange={(e) => setStore(s.id, "address", e.target.value)} placeholder="Rua, número, bairro" className="h-11 bg-obsidian" data-testid={`settings-address-${s.id}`} />
              </div>
            </div>
          </div>
        ))}
        <div className="rounded-2xl border border-white/[0.07] bg-panel p-5">
          <h3 className="flex items-center gap-2 font-heading text-lg font-extrabold text-white"><Megaphone className="size-5 text-amber-400" /> Faixa de aviso</h3>
          <Input value={form.announcement} maxLength={160} onChange={(e) => setForm({ ...form, announcement: e.target.value })} placeholder="Ex: Promoção de sexta • Delivery em toda SJR" className="mt-3 h-11 bg-obsidian" data-testid="settings-announcement-input" />
        </div>
        <button type="button" onClick={() => save.mutate(form)} disabled={save.isPending} data-testid="settings-save-button" className="h-12 w-full rounded-xl bg-amber-500 font-heading font-extrabold text-black transition-[background-color,opacity] hover:bg-amber-400 disabled:opacity-50 sm:w-auto sm:px-10">
          {save.isPending ? "Salvando..." : "Salvar configurações"}
        </button>
      </section>

      <section className="lg:col-span-4">
        <form
          className="space-y-3 rounded-2xl border border-white/[0.07] bg-panel p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw.new_password.length < 6) return toast.error("A nova senha precisa de 6+ caracteres");
            if (pw.new_password !== confirm) return toast.error("As senhas não conferem");
            changePw.mutate(pw);
          }}
        >
          <h3 className="flex items-center gap-2 font-heading text-lg font-extrabold text-white"><KeyRound className="size-5 text-amber-400" /> Senha do painel</h3>
          <Input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} placeholder="Senha atual" className="h-11 bg-obsidian" autoComplete="current-password" data-testid="settings-current-password-input" />
          <Input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} placeholder="Nova senha" className="h-11 bg-obsidian" autoComplete="new-password" data-testid="settings-new-password-input" />
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmar nova senha" className="h-11 bg-obsidian" autoComplete="new-password" data-testid="settings-confirm-password-input" />
          <button type="submit" disabled={changePw.isPending} data-testid="settings-change-password-button" className="h-11 w-full rounded-xl border border-amber-500/40 bg-amber-500/10 font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50">
            Alterar senha
          </button>
        </form>
      </section>
    </div>
  );
}
