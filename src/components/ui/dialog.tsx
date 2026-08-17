"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocoPreso } from "./use-foco-preso";

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
  resizable = false,
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
  /**
   * Deixa o diálogo LARGO por padrão e ARRASTÁVEL na largura (alça na borda
   * direita). Para conteúdo que precisa de espaço — ex.: o shuttle de módulos,
   * cujos rótulos "Módulo › Submódulo" são longos.
   */
  resizable?: boolean;
  /** Ações no cabeçalho, à esquerda do "fechar" (ex.: "Salvar versão"). */
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Substitui o padding padrão do corpo — para diálogos com painéis colados. */
  bodyClassName?: string;
}) {
  const painelRef = useRef<HTMLDivElement>(null);
  // Largura arrastada (px). null = usa a largura inicial do CSS.
  const [width, setWidth] = useState<number | null>(null);

  // Arrasto da alça direita. Centrado no scrim → crescer a largura afasta as
  // DUAS bordas, então cada px do cursor vale 2px de largura para a borda
  // acompanhar o mouse. Trava entre 22rem e 96vw.
  const iniciarArrasto = useCallback((e: ReactPointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = painelRef.current?.offsetWidth ?? 640;
    const min = 22 * 16;
    const max = window.innerWidth * 0.96;
    const mover = (ev: PointerEvent) => {
      setWidth(Math.min(max, Math.max(min, startW + 2 * (ev.clientX - startX))));
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  }, []);

  /**
   * `onClose` vive num ref para NÃO entrar nas dependências do efeito abaixo.
   *
   * Todo chamador passa uma arrow inline (`onClose={() => setX(false)}`), cuja
   * identidade muda a cada render. Com ela nas deps, digitar uma letra
   * (setState → render → nova função) fazia o efeito rodar de novo e devolver o
   * foco ao primeiro campo — impossível escrever uma palavra inteira.
   */
  // O foco preso mora em `use-foco-preso.ts` — o drawer "Perguntar à IA"
  // precisa do mesmo comportamento sem a casca deste modal.
  useFocoPreso(open, painelRef, onClose);

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
          // max-h-full = viewport menos o padding do scrim: o diálogo nunca
          // passa da tela; quem rola é o CORPO (header e footer ficam fixos).
          "relative flex max-h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-3",
          "motion-safe:animate-[scalein_150ms_var(--ease-out)]",
          resizable ? "w-[min(64rem,94vw)] max-w-none" : SIZES[size],
          className,
        )}
        style={resizable && width ? { width: `${width}px`, maxWidth: "96vw" } : undefined}
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

        {children && (
          <div className={cn("slim-scroll min-h-0 flex-1 overflow-y-auto", bodyClassName ?? "px-6 py-4")}>
            {children}
          </div>
        )}

        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 px-6 pb-5 pt-1">
            {footer}
          </div>
        )}

        {resizable && (
          // O trilho é pointer-events-none (deixa a barra de rolagem do corpo
          // livre); só o trecho CENTRAL captura o arrasto.
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 flex items-center">
            <div
              onPointerDown={iniciarArrasto}
              title="Arraste para alargar"
              className="pointer-events-auto flex h-16 w-3 cursor-ew-resize items-center justify-center rounded-l hover:bg-primary/15"
            >
              <span className="h-8 w-0.5 rounded-full bg-border" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
