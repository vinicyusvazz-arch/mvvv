import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiPost, apiPut } from "@/lib/api";
import { CATEGORIES, compressImage, errMsg, moneyInput, parseMoney } from "@/lib/format";
import type { ImageIn, ImageOut, Product, ProductIn } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FormState {
  name: string;
  description: string;
  category: string;
  price: string;
  old_price: string;
  stock: string;
  featured: boolean;
  is_combo: boolean;
  image_url: string;
}

const empty: FormState = { name: "", description: "", category: "Cervejas", price: "", old_price: "", stock: "0", featured: false, is_combo: false, image_url: "" };

function fromProduct(p: Product): FormState {
  return {
    name: p.name,
    description: p.description,
    category: p.category,
    price: moneyInput(p.price),
    old_price: moneyInput(p.old_price),
    stock: String(p.stock),
    featured: p.featured,
    is_combo: p.is_combo,
    image_url: p.image_url,
  };
}

function Toggle({ checked, onChange, label, hint, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; testId: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className={cn("flex flex-1 items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors", checked ? "border-amber-500/50 bg-amber-500/10" : "border-white/10 bg-obsidian")}
    >
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-[11px] text-slate-500">{hint}</p>
      </div>
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-amber-500" : "bg-white/15")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

export default function ProductFormDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (v: boolean) => void; product: Product | null }) {
  const qc = useQueryClient();
  const [f, setF] = useState<FormState>(empty);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setF(product ? fromProduct(product) : empty);
  }, [open, product]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: (body: ProductIn) => (product ? apiPut<Product>(`/admin/products/${product.id}`, body) : apiPost<Product>("/admin/products", body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success(product ? "Produto atualizado!" : "Produto cadastrado!");
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const data_url = await compressImage(file);
      const res = await apiPost<ImageOut>("/admin/images", { data_url } satisfies ImageIn);
      set("image_url", res.url);
      toast.success("Foto enviada");
    } catch (e) {
      toast.error(errMsg(e, "Não foi possível enviar a foto"));
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseMoney(f.price);
    const old = f.old_price.trim() ? parseMoney(f.old_price) : null;
    const stock = parseInt(f.stock, 10);
    if (!f.name.trim()) return toast.error("Informe o nome");
    if (!(price > 0)) return toast.error("Preço inválido");
    if (old !== null && Number.isNaN(old)) return toast.error("Preço antigo inválido");
    if (!(stock >= 0)) return toast.error("Estoque inválido");
    save.mutate({
      name: f.name.trim(),
      description: f.description.trim(),
      category: f.category,
      price,
      old_price: old,
      stock,
      featured: f.featured,
      is_combo: f.is_combo,
      image_url: f.image_url,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto border-white/10 bg-panel sm:max-w-lg" data-testid="product-form-dialog">
        <DialogTitle className="font-heading text-xl font-extrabold text-white">{product ? "Editar produto" : "Novo produto"}</DialogTitle>
        <form onSubmit={submit} className="space-y-4">
          {/* Photo */}
          <div>
            <Label className="mb-1.5 text-xs text-slate-400">Foto do produto / combo</Label>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-dashed border-white/15 bg-obsidian">
              {f.image_url ? (
                <>
                  <img src={f.image_url} alt="" className="size-full object-cover" data-testid="product-form-image-preview" />
                  <button type="button" onClick={() => set("image_url", "")} aria-label="Remover foto" data-testid="product-form-remove-image" className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/70 text-white hover:bg-black">
                    <X className="size-4" />
                  </button>
                </>
              ) : (
                <div className="grid size-full place-items-center text-sm text-slate-500">Sem foto</div>
              )}
              {uploading && (
                <div className="absolute inset-0 grid place-items-center bg-black/60">
                  <Loader2 className="size-7 animate-spin text-amber-400" />
                </div>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" disabled={uploading} onClick={() => cameraRef.current?.click()} data-testid="product-form-camera-button" className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50">
                <Camera className="size-4" /> Tirar foto
              </button>
              <button type="button" disabled={uploading} onClick={() => galleryRef.current?.click()} data-testid="product-form-upload-button" className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-elevated py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/25 disabled:opacity-50">
                <ImagePlus className="size-4" /> Galeria / arquivo
              </button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="product-form-camera-input" />
            <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="product-form-file-input" />
          </div>

          <div>
            <Label htmlFor="p-name" className="mb-1.5 text-xs text-slate-400">Nome</Label>
            <Input id="p-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Combo Resenha" className="h-11 bg-obsidian" data-testid="product-form-name-input" />
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-slate-400">Categoria</Label>
            <Select value={f.category} onValueChange={(v: string) => set("category", v)}>
              <SelectTrigger className="h-11 w-full bg-obsidian" data-testid="product-form-category-select">
                <SelectValue>{(v) => String(v ?? "")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(CATEGORIES.includes(f.category) ? CATEGORIES : [f.category, ...CATEGORIES]).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="p-price" className="mb-1.5 text-xs text-slate-400">Preço (R$)</Label>
              <Input id="p-price" inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="0,00" className="h-11 bg-obsidian font-mono" data-testid="product-form-price-input" />
            </div>
            <div>
              <Label htmlFor="p-old" className="mb-1.5 text-xs text-slate-400">De (opcional)</Label>
              <Input id="p-old" inputMode="decimal" value={f.old_price} onChange={(e) => set("old_price", e.target.value)} placeholder="0,00" className="h-11 bg-obsidian font-mono" data-testid="product-form-old-price-input" />
            </div>
            <div>
              <Label htmlFor="p-stock" className="mb-1.5 text-xs text-slate-400">Estoque</Label>
              <Input id="p-stock" inputMode="numeric" value={f.stock} onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))} className="h-11 bg-obsidian font-mono" data-testid="product-form-stock-input" />
            </div>
          </div>
          <div>
            <Label htmlFor="p-desc" className="mb-1.5 text-xs text-slate-400">Descrição</Label>
            <Textarea id="p-desc" value={f.description} maxLength={600} onChange={(e) => set("description", e.target.value)} placeholder="O que vem no combo, volume, etc." className="min-h-20 bg-obsidian" data-testid="product-form-description-input" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Toggle checked={f.featured} onChange={(v) => set("featured", v)} label="Destaque" hint="Aparece no topo da loja" testId="product-form-featured-toggle" />
            <Toggle checked={f.is_combo} onChange={(v) => set("is_combo", v)} label="Combo" hint="Selo de combo" testId="product-form-combo-toggle" />
          </div>
          <button type="submit" disabled={save.isPending || uploading} data-testid="product-form-submit-button" className="h-12 w-full rounded-xl bg-amber-500 font-heading font-extrabold text-black transition-[background-color,opacity] hover:bg-amber-400 disabled:opacity-50">
            {save.isPending ? "Salvando..." : product ? "Salvar alterações" : "Cadastrar produto"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
