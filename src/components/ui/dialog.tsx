"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal canônico do produto.
 *
 * Antes cada tela montava o seu (raio, sombra e padding diferentes, sem foco
 * preso e sem Esc). Aqui isso vem de graça e igual em todo lugar:
 *  - scrim forte o bastante para isolar o conteúdo (~50%);
 *  - `role="dialog"` + `aria-modal` + título ligado por `aria-labelledby`;
 *  - Esc fecha, foco vai para dentro ao abrir e volta ao gatilho ao fechar;
 *  - Tab circula dentro do diálogo (sem escapar para a página atrás).
 */
const SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  actions,
  footer,
  children,
  className,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: keyof typeof SIZES;
  /** Ações no cabeçalho, à esquerda do "fechar" (ex.: "Salvar versão"). */
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Substitui o padding padrão do corpo — para diálogos com painéis colados. */
  bodyClassName?: string;
}) {
  const painelRef = useRef<HTMLDivElement>(null);
  const gatilhoRef = useRef<HTMLElement | null>(null);

  /**
   * `onClose` vive num ref para NÃO entrar nas dependências do efeito abaixo.
   *
   * Todo chamador passa uma arrow inline (`onClose={() => setX(false)}`), cuja
   * identidade muda a cada render. Com ela nas deps, digitar uma letra
   * (setState → render → nova função) fazia o efeito rodar de novo e devolver o
   * foco ao primeiro campo — impossível escrever uma palavra inteira.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Depende SÓ de `open`: monta o foco preso uma vez por abertura.
  useEffect(() => {
    if (!open) return;
    gatilhoRef.current = document.activeElement as HTMLElement | null;

    const foco = () =>
      painelRef.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ) ?? ([] as unknown as NodeListOf<HTMLElement>);

    // Foco no primeiro CAMPO, quando houver — é o que a pessoa veio preencher.
    // Sem campo, cai no primeiro focável que não seja o "fechar".
    const campo = painelRef.current?.querySelector<HTMLElement>(
      'input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
    );
    const alvos = foco();
    (campo ?? alvos[1] ?? alvos[0])?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const lista = foco();
      if (lista.length === 0) return;
      const primeiro = lista[0]!;
      const ultimo = lista[lista.length - 1]!;
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // não rola a página atrás
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      gatilhoRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px] motion-safe:animate-[fade_150ms_var(--ease-out)] sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-titulo"
        aria-describedby={description ? "dialog-descricao" : undefined}
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-3",
          "motion-safe:animate-[scalein_150ms_var(--ease-out)]",
          SIZES[size],
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5">
          <div className="min-w-0">
            <h2 id="dialog-titulo" className="text-base font-semibold tracking-tight">
              {title}
            </h2>
            {description && (
              <p id="dialog-descricao" className="mt-1 text-sm text-text-muted">
                {description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {children && <div className={bodyClassName ?? "px-6 py-4"}>{children}</div>}

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-6 pb-5 pt-1">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
