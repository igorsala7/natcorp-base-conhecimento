"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { useFocoPreso } from "./use-foco-preso";

/**
 * PAINEL LATERAL — o modal para conteúdo que não cabe num modal.
 *
 * O `Dialog` é ótimo para uma pergunta e duas respostas. Ele deixa de servir
 * quando o conteúdo tem trinta campos: o modal cresce até virar uma página
 * centralizada com rolagem, sem a barra de ações fixa que um formulário longo
 * exige, e sem espaço para o contexto que a decisão pede ao lado.
 *
 * É o caso concreto de três telas: o editor de tool (um modal com 57 estados de
 * React), o convite com escopo (que precisa mostrar por extenso o que a pessoa
 * vai poder fazer) e a prévia do widget (que só faz sentido lado a lado com o
 * formulário).
 *
 * ── Construído sobre o Dialog, não ao lado dele ─────────────────────────────
 * Mesmo scrim, mesmo `useFocoPreso` (que já é testado), mesma semântica ARIA. A
 * tentação era trazer uma biblioteca de headless UI; seria uma SEGUNDA armadilha
 * de foco convivendo com a atual — exatamente a doença que esta reforma está
 * curando, com marca melhor.
 *
 * ── `dismissible={false}` ───────────────────────────────────────────────────
 * Um Esc distraído no editor de tool custa 40 campos preenchidos. Quando o
 * painel carrega trabalho não salvo, ele só fecha por ação explícita — e o
 * botão de fechar continua ali, porque uma saída sempre precisa existir.
 */
const TAMANHOS = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-none",
} as const;

export function Sheet({
  open,
  onClose,
  title,
  description,
  side = "right",
  size = "md",
  dismissible = true,
  actions,
  footer,
  children,
  className,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  side?: "right" | "left";
  size?: keyof typeof TAMANHOS;
  /** `false` = clique no scrim e Esc NÃO fecham. Para formulário com rascunho sujo. */
  dismissible?: boolean;
  /** Ações no cabeçalho, à esquerda do fechar. */
  actions?: ReactNode;
  /** Barra fixa no rodapé — o lugar de "Salvar" e "Testar" num formulário longo. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const painelRef = useRef<HTMLDivElement>(null);
  useFocoPreso(open, painelRef, dismissible ? onClose : () => {});

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" data-testid="painel">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={dismissible ? onClose : undefined}
        role="presentation"
      />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="painel-titulo"
        className={cn(
          "absolute inset-y-0 flex w-full flex-col border-border bg-surface shadow-3",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          TAMANHOS[size],
          // Entra do lado a que pertence: movimento que vem da borda diz de onde
          // o painel saiu, e por onde ele volta.
          side === "right"
            ? "motion-safe:animate-[slidein_180ms_var(--ease-out)]"
            : "motion-safe:animate-[slideinleft_180ms_var(--ease-out)]",
          className,
        )}
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1 space-y-1">
            <h2 id="painel-titulo" className="text-base font-semibold tracking-tight text-text">
              {title}
            </h2>
            {description && <p className="text-sm text-text-muted">{description}</p>}
          </div>
          {actions}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X />
          </Button>
        </div>

        <div className={cn("flex-1 overflow-y-auto px-5 py-4", bodyClassName)}>{children}</div>

        {/* Rodapé FIXO: num formulário de trinta campos, um botão de salvar que
            rola junto some da vista justamente quando se quer salvar. */}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
