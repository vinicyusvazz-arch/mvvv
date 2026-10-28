import { useState } from "react";
import { cn } from "@/lib/utils";

// Uses /mvlogo.png from public/; falls back to a typographic MV mark until the file exists.
export default function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("flex items-center gap-2.5", className)} data-testid="brand-logo">
      {failed ? (
        <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 font-heading text-lg font-black tracking-tighter text-black shadow-lg shadow-amber-500/20">
          MV
        </div>
      ) : (
        <img
          src="/mvlogo.png?v=2"
          alt="MV Conveniência"
          className="size-11 rounded-full object-contain drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]"
          onError={() => setFailed(true)}
        />
      )}
      {showText && (
        <div className="leading-none">
          <div className="font-heading text-lg font-extrabold tracking-tight text-white">
            MV <span className="text-gold-gradient">Conveniência</span>
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            São José de Ribamar
          </div>
        </div>
      )}
    </div>
  );
}
