import { ApiError } from "./api";
import type { OrderStatus, PaymentMethod, PublicSettings, StoreId } from "./types";

export const CATEGORIES = [
  "Combos",
  "Cervejas",
  "Destilados",
  "Vinhos & Espumantes",
  "Refrigerantes & Energéticos",
  "Gelo & Carvão",
  "Petiscos & Snacks",
  "Mercearia",
  "Tabacaria & Outros",
];

export const NEIGHBORHOODS = [
  "Centro (Sede)",
  "Pitangueiras",
  "Araçagy",
  "Panaquatira",
  "Jardim Câmara",
  "Parque Jair",
  "Maiobão",
  "Cohatrac IV",
  "Vila Kiola",
  "Juçatuba",
  "Mata",
  "Outeiro",
  "Itapary",
  "Vila São José",
  "Sítio do Apicum",
  "Outro bairro de SJR",
];

export const STORE_IDS: StoreId[] = ["sjr", "pitangueiras"];

// Shown when the API is unreachable (static preview) — real values come from /api/settings.
export const FALLBACK_SETTINGS: PublicSettings = {
  stores: [
    { id: "sjr", name: "MV de SJR", whatsapp: "", address: "São José de Ribamar - MA", hours: "", open_time: "10:00", close_time: "02:00", is_open: true },
    { id: "pitangueiras", name: "MV de Pitangueiras", whatsapp: "", address: "Pitangueiras, São José de Ribamar - MA", hours: "", open_time: "10:00", close_time: "02:00", is_open: true },
  ],
  announcement: "Delivery em toda São José de Ribamar",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  novo: "Novo",
  preparo: "Em preparo",
  entrega: "Saiu p/ entrega",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const STATUS_STYLE: Record<OrderStatus, string> = {
  novo: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  preparo: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  entrega: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  concluido: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelado: "bg-red-500/15 text-red-300 border-red-500/30",
};

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (v: number) => brlFmt.format(v);

export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function waLink(phone: string, text = ""): string {
  let d = phone.replace(/\D/g, "");
  if (d && d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function errMsg(e: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  if (e instanceof ApiError) {
    const body = e.body as { detail?: unknown } | null;
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) return "Verifique os campos preenchidos.";
  }
  return fallback;
}

export function parseMoney(v: string): number {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function moneyInput(v: number | null | undefined): string {
  return v == null ? "" : v.toFixed(2).replace(".", ",");
}

// Downscale camera/gallery photos before upload so the DB stays light and pages stay fast.
export async function compressImage(file: File, max = 1200, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Imagem inválida"));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
