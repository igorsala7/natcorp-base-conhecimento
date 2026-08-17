import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * OS PASSOS DE UM TRABALHO LONGO.
 *
 * A importação tinha oito estados tipados em `status.ts` — na fila, extraindo,
 * inferindo, revisão, importando, melhorando, concluído, erro — e a tela
 * mostrava UM badge de texto com o estado atual. Quem esperava não sabia
 * quantas etapas faltavam nem em qual delas costuma demorar; "Inferindo
 * estrutura" durante três minutos é indistinguível de travado.
 *
 * O `Stepper` responde três perguntas que o badge não responde: quantas etapas
 * existem, em qual estamos, e quais já passaram.
 *
 * ── Por que não é uma barra de progresso ────────────────────────────────────
 * Barra promete proporção, e as etapas aqui não são proporcionais: extrair um
 * PDF de 200 páginas leva minutos, inferir a estrutura leva segundos. Uma barra
 * a 40% que fica parada mente; um passo aceso não promete tempo, só lugar.
 *
 * ── O passo que FALHOU ──────────────────────────────────────────────────────
 * Erro não vira um nono passo no fim: ele marca o passo em que o trabalho
 * parou. Saber que quebrou "na extração" e não "na importação" é a diferença
 * entre suspeitar do arquivo e suspeitar do destino.
 */

export type Passo = {
  key: string;
  rotulo: string;
  /** Passos que ainda não começaram ficam apagados; o atual pulsa. */
  opcional?: boolean;
};

export function Stepper({
  passos,
  atual,
  falhou = false,
  className,
}: {
  passos: Passo[];
  /** Chave do passo em curso, ou o último concluído. */
  atual: string;
  /** O passo `atual` é onde o trabalho parou com erro. */
  falhou?: boolean;
  className?: string;
}) {
  const i = Math.max(
    0,
    passos.findIndex((p) => p.key === atual),
  );

  return (
    <ol className={cn("flex flex-wrap items-center gap-x-1 gap-y-2", className)} aria-label="Etapas">
      {passos.map((p, idx) => {
        const feito = idx < i;
        const agora = idx === i;
        const erro = agora && falhou;
        return (
          <li key={p.key} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium transition-colors",
                erro
                  ? "bg-danger-soft text-danger"
                  : agora
                    ? "bg-brand-purple-100 text-brand-purple-800 dark:bg-brand-purple-900/50 dark:text-brand-purple-200"
                    : feito
                      ? "text-text-muted"
                      : "text-text-muted/60",
              )}
              // `aria-current` diz "você está aqui" a quem não vê a cor.
              aria-current={agora ? "step" : undefined}
            >
              {erro ? (
                <X className="size-3 shrink-0" aria-hidden="true" />
              ) : feito ? (
                <Check className="size-3 shrink-0" aria-hidden="true" />
              ) : agora ? (
                <Loader2 className="size-3 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <span className="size-3 shrink-0 rounded-full border border-current" aria-hidden="true" />
              )}
              {p.rotulo}
              {/* O estado também vai em texto: cor sozinha não comunica. */}
              {erro && <span className="sr-only"> — falhou aqui</span>}
              {feito && <span className="sr-only"> — concluído</span>}
            </div>
            {idx < passos.length - 1 && (
              <span className={cn("h-px w-3", feito ? "bg-border-strong" : "bg-border")} aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
