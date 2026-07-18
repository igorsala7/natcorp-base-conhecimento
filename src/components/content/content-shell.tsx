import type { ReactNode } from "react";
import type { TreeNode } from "@/lib/content/tree";
import { Tree } from "./tree";

/** Layout de duas colunas: árvore (esquerda) + área de edição (direita). */
export function ContentShell({
  spaceId,
  spaceName,
  tree,
  selectedId,
  children,
}: {
  spaceId: string;
  spaceName: string;
  tree: TreeNode[];
  selectedId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] gap-4">
      <aside className="w-72 shrink-0 overflow-auto rounded-lg border border-border bg-surface p-3">
        <div className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {spaceName}
        </div>
        <Tree spaceId={spaceId} nodes={tree} selectedId={selectedId} />
      </aside>
      <section className="min-w-0 flex-1 overflow-auto">{children}</section>
    </div>
  );
}
