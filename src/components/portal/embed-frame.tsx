import type { CSSProperties, ReactNode } from "react";
import { spaceChrome } from "@/components/portal/shell";

type EmbedSpace = { id: string; slug: string; name: string; theme?: Record<string, unknown> | null };

/**
 * Casca MÍNIMA para as páginas de incorporação (iframe): aplica só o tema/marca
 * do espaço (mesmas variáveis do portal) e um respiro em volta — sem cabeçalho,
 * navegação ou rodapé do portal. É o que o site de terceiros mostra dentro do
 * iframe. Um link discreto para a documentação completa fecha a moldura.
 */
export function EmbedFrame({
  space,
  portalHref,
  children,
}: {
  space: EmbedSpace;
  /** Link "abrir a documentação completa" (nova aba). */
  portalHref?: string;
  children: ReactNode;
}) {
  const { style, temaClasse } = spaceChrome(space);
  return (
    <div className={`min-h-dvh bg-bg text-text${temaClasse ? ` ${temaClasse}` : ""}`} style={style as CSSProperties}>
      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-6">
        {children}
        {portalHref && (
          <div className="mt-8 flex justify-end border-t border-border pt-3">
            <a
              href={portalHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-text-muted transition-colors hover:text-primary"
            >
              {space.name} ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
