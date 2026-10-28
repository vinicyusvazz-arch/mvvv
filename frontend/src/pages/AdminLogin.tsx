import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { beginSession } from "@/lib/session";
import type { AuthStatus, LoginIn } from "@/lib/types";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const me = useQuery({ queryKey: ["auth-me"], queryFn: () => apiGet<AuthStatus>("/auth/me"), retry: false });
  const login = useMutation({
    mutationFn: (body: LoginIn) => apiPost<AuthStatus>("/auth/login", body),
    onSuccess: () => {
      beginSession();
      toast.success("Bem-vindo ao painel MV");
      navigate("/admin/painel");
    },
    onError: (e) => toast.error(errMsg(e, "Não foi possível entrar")),
  });

  if (me.data?.authenticated) return <Navigate to="/admin/painel" replace />;

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-obsidian px-4">
      <div className="pointer-events-none absolute left-1/2 top-1/3 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 blur-[120px]" />
      <div className="grain pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative w-full max-w-sm animate-fade-up">
        <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-slate-300" data-testid="admin-login-back-link">
          <ArrowLeft className="size-3.5" /> Voltar à loja
        </Link>
        <div className="rounded-3xl border border-white/[0.08] bg-panel/80 p-7 shadow-2xl backdrop-blur-xl">
          <img src="/mvpoint.webp?v=2" alt="MV é o Point!" className="mx-auto -mt-2 size-44 object-contain" data-testid="admin-login-logo" />
          <div className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400">
            <ShieldCheck className="size-4" /> Área restrita
          </div>
          <h1 className="mt-1 font-heading text-2xl font-black text-white">Painel dos proprietários</h1>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (password) login.mutate({ password });
            }}
          >
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha de acesso"
                autoComplete="current-password"
                autoFocus
                data-testid="admin-password-input"
                className="h-12 w-full rounded-xl border border-white/10 bg-obsidian px-4 pr-12 text-white placeholder:text-slate-500 transition-[border-color] focus:border-amber-500/60 focus:outline-none"
              />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label="Mostrar senha" data-testid="admin-password-toggle" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={login.isPending || !password}
              data-testid="admin-login-submit-button"
              className="h-12 w-full rounded-xl bg-amber-500 font-heading font-extrabold text-black transition-[background-color,opacity] hover:bg-amber-400 disabled:opacity-50"
            >
              {login.isPending ? "Verificando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
