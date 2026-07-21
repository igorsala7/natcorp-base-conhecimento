import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { env } from "@/lib/env";
import { DocsHub, type DocResumo } from "./hub";

export const metadata: Metadata = { title: "Documentações" };

/**
 * A porta de entrada da gestão: TODAS as documentações num lugar só, com
 * contagens, estado dos embeddings e atalhos para cada área (conteúdo,
 * aparência, preferências, chatbot, prévia, página pública).
 */
export default async function DocumentacoesPage() {
  if (!(await hasPermission("content.view"))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Documentações</h1>
        <p className="mt-2 text-text-muted">Sem permissão.</p>
      </div>
    );
  }

  const spaces = await listSpaces();
  const supabase = await createClient();

  // Uma consulta só para todas as contagens de conteúdo.
  const { data: nodes } = await supabase
    .from("nodes")
    .select("space_id, type, status")
    .is("deleted_at", null)
    .limit(10000);

  type Contagem = { publicados: number; rascunhos: number; emRevisao: number; pastas: number };
  const porEspaco = new Map<string, Contagem>();
  for (const n of nodes ?? []) {
    const s: Contagem =
      porEspaco.get(n.space_id) ?? { publicados: 0, rascunhos: 0, emRevisao: 0, pastas: 0 };
    if (n.type === "article") {
      if (n.status === "published") s.publicados += 1;
      else if (n.status === "review") s.emRevisao += 1;
      else s.rascunhos += 1;
    } else if (n.type === "folder") {
      s.pastas += 1;
    }
    porEspaco.set(n.space_id, s);
  }

  const docs: DocResumo[] = await Promise.all(
    spaces.map(async (s) => {
      const [{ count: chunksIndexados }, canEdit] = await Promise.all([
        supabase
          .from("chunks")
          .select("id", { count: "exact", head: true })
          .eq("space_id", s.id)
          .not("embedding", "is", null),
        hasPermission("content.edit", s.id),
      ]);
      const c = porEspaco.get(s.id) ?? { publicados: 0, rascunhos: 0, emRevisao: 0, pastas: 0 };
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        type: s.type,
        visibility: s.visibility,
        ...c,
        chunksIndexados: chunksIndexados ?? 0,
        canEdit,
        publicBase: `${env.NEXT_PUBLIC_SITE_URL}/docs/${s.slug}`,
      };
    }),
  );

  const canCreate = await hasPermission("space.create");

  return (
    <div className="mx-auto max-w-5xl">
      <DocsHub
        docs={docs}
        spaces={spaces.map((s) => ({ id: s.id, name: s.name, slug: s.slug, type: s.type, parent_space_id: s.parent_space_id, visibility: s.visibility, custom_domain: s.custom_domain }))}
        canCreate={canCreate}
      />
    </div>
  );
}
