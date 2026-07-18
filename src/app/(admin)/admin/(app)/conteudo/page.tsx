import type { Metadata } from "next";
import { hasPermission } from "@/lib/auth/permissions";
import { getDefaultSpace, listTree } from "@/lib/content/tree";
import { ContentShell } from "@/components/content/content-shell";

export const metadata: Metadata = { title: "Conteúdo" };

export default async function ConteudoPage() {
  const canView = await hasPermission("content.view");
  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Conteúdo</h1>
        <p className="mt-2 text-text-muted">Sem permissão para ver conteúdo.</p>
      </div>
    );
  }

  const space = await getDefaultSpace();
  if (!space) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Conteúdo</h1>
        <p className="mt-2 text-text-muted">Nenhum espaço encontrado.</p>
      </div>
    );
  }
  const tree = await listTree(space.id);

  return (
    <ContentShell spaceId={space.id} spaceName={space.name} tree={tree}>
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-center">
        <div className="max-w-sm p-8">
          <h2 className="text-lg font-semibold">Selecione ou crie um artigo</h2>
          <p className="mt-2 text-sm text-text-muted">
            Use a árvore à esquerda para criar pastas e artigos, arrastar para
            reordenar e clicar num artigo para editar.
          </p>
        </div>
      </div>
    </ContentShell>
  );
}
