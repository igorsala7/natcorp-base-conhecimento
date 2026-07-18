import type { ReactNode } from "react";

/** Layout de duas colunas: navegação (esquerda) + área de edição (direita). */
export function ContentShell({
  aside,
  children,
}: {
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] gap-4">
      <aside className="w-72 shrink-0 overflow-auto rounded-lg border border-border bg-surface p-3">
        {aside}
      </aside>
      <section className="min-w-0 flex-1 overflow-auto">{children}</section>
    </div>
  );
}
