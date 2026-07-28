"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { Surface } from "@/components/ui/surface";
import { controlClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { salvarPrompts, restaurarPrompts } from "./prompt-actions";

export type PromptFieldUI = {
  key: string; label: string; type: "text" | "number"; rows: number;
  hint?: string; min?: number; max?: number; step?: number; def: string;
};
export type PromptCatUI = {
  key: string; label: string; description: string;
  hasOverride: boolean; fields: PromptFieldUI[]; values: Record<string, string>;
};

export function PromptsPanel({ categorias }: { categorias: PromptCatUI[] }) {
  const router = useRouter();
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [pending, startTransition] = useTransition();
  const [aba, setAba] = useState(categorias[0]?.key ?? "");
  // Estado editável: { categoria: { campo: valor } }, semeado com o efetivo atual.
  const [vals, setVals] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(categorias.map((c) => [c.key, { ...c.values }])),
  );

  const cat = categorias.find((c) => c.key === aba);
  if (!cat) return null;

  function set(campo: string, valor: string) {
    setVals((prev) => ({ ...prev, [aba]: { ...prev[aba], [campo]: valor } }));
  }

  function salvar() {
    startTransition(async () => {
      const r = await salvarPrompts(aba, vals[aba] ?? {});
      if (r.ok) toast.success(r.msg ?? "Salvo."); else toast.error(r.error);
      router.refresh();
    });
  }

  async function restaurar() {
    const ok = await confirmar({
      title: "Restaurar para o padrão do código?",
      description: `Descarta as personalizações de “${cat!.label}” e volta ao prompt/temperatura que vêm no código-fonte.`,
      confirmLabel: "Restaurar",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await restaurarPrompts(aba);
      if (r.ok) toast.success(r.msg ?? "Restaurado."); else toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <div className="mt-5 space-y-4">
      <p className="text-sm text-text-muted">
        Parametrize os prompts e as temperaturas que a IA usa no sistema. O que você não alterar continua usando o
        <strong className="font-medium"> padrão do código-fonte</strong> (o código é o fallback). “Restaurar” volta a
        categoria inteira ao padrão.
      </p>

      {/* Sub-abas por categoria */}
      <div className="flex flex-wrap gap-1.5">
        {categorias.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setAba(c.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              c.key === aba
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-text-muted hover:border-primary/40 hover:text-text",
            )}
          >
            {c.label}
            {c.hasOverride && <span className="size-1.5 rounded-full bg-brand-pink-500" title="Personalizado" />}
          </button>
        ))}
      </div>

      <Surface elevation={1} padding="lg">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{cat.label}</h2>
            <p className="mt-1 text-sm text-text-muted">{cat.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={restaurar} disabled={pending} title="Voltar ao padrão do código">
              <RotateCcw className="size-4" /> Restaurar padrão
            </Button>
            <Button onClick={salvar} disabled={pending}>
              <Save className="size-4" /> Salvar
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {cat.fields.map((f) => {
            const v = vals[aba]?.[f.key] ?? "";
            const alterado = v !== f.def;
            return (
              <div key={f.key}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-text">{f.label}</label>
                  {alterado && (
                    <button
                      type="button"
                      onClick={() => set(f.key, f.def)}
                      className="text-xs font-medium text-text-muted hover:text-primary"
                      title="Volta este campo ao valor do código"
                    >
                      voltar ao padrão
                    </button>
                  )}
                </div>
                {f.type === "number" ? (
                  <input
                    type="number" className={cn(controlClass, "max-w-40")}
                    min={f.min} max={f.max} step={f.step} value={v}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                ) : (
                  <textarea
                    className={cn(controlClass, "font-mono text-xs leading-relaxed")}
                    rows={f.rows} value={v}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
                {f.hint && <p className="mt-1 text-xs text-text-muted">{f.hint}</p>}
              </div>
            );
          })}
        </div>
      </Surface>
    </div>
  );
}
