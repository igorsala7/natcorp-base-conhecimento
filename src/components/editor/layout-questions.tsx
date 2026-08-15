"use client";

import type { LayoutQuestion } from "@/lib/importer/question-schema";
import { BlockPreview, temPreview } from "./block-previews";

/**
 * Formulário das perguntas de layout da IA — compartilhado pelo editor
 * (perguntas detalhadas com trecho citado) e pela importação (genéricas).
 * Controlado: o dono guarda `respostas` (id da pergunta → índice da opção).
 */
export function LayoutQuestionsForm({
  perguntas,
  respostas,
  onChange,
}: {
  perguntas: LayoutQuestion[];
  respostas: Record<string, number>;
  onChange: (respostas: Record<string, number>) => void;
}) {
  return (
    <div className="space-y-5">
      {perguntas.map((p) => (
        <fieldset key={p.id}>
          <legend className="text-sm font-medium">{p.pergunta}</legend>
          {p.trecho && (
            <blockquote className="mt-1.5 border-l-2 border-primary/50 pl-3 text-xs italic leading-relaxed text-text-muted">
              “{p.trecho}”
            </blockquote>
          )}
          <div className="mt-2 grid grid-cols-1 gap-2">
            {p.opcoes.map((o, i) => {
              const ativa = respostas[p.id] === i;
              return (
                <label
                  key={i}
                  className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                    ativa
                      ? "border-primary bg-brand-purple-50 dark:bg-brand-purple-950/30"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      name={`lq-${p.id}`}
                      checked={ativa}
                      onChange={() => onChange({ ...respostas, [p.id]: i })}
                      className="accent-[var(--color-primary)]"
                    />
                    {o.rotulo}
                  </span>
                  {temPreview(o.preview) ? (
                    <span className="mt-2 block">
                      <BlockPreview typeKey={o.preview!} />
                    </span>
                  ) : (
                    o.exemplo && (
                      <span className="mt-1.5 block whitespace-pre-wrap rounded bg-surface-2 px-2 py-1.5 text-2xs leading-relaxed text-text-muted">
                        {o.exemplo}
                      </span>
                    )
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/** Diretivas das opções escolhidas, na ordem das perguntas. */
export function diretivasEscolhidas(
  perguntas: LayoutQuestion[],
  respostas: Record<string, number>,
): string[] {
  return perguntas.flatMap((p) => {
    const i = respostas[p.id];
    const o = i !== undefined ? p.opcoes[i] : undefined;
    return o ? [o.diretiva] : [];
  });
}
