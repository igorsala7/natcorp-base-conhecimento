"use server";

import { createClient } from "@/lib/supabase/server";
import { slugPathsOf } from "@/lib/content/tree";
import type { QualityContext } from "@/lib/quality/audit-article";

/**
 * Contexto para a auditoria de qualidade rodar no editor: caminhos internos
 * válidos (todas as documentações — um link pode cruzar espaços) e os títulos
 * dos DEMAIS artigos publicados do espaço (sugestão de linkagem interna).
 * A auditoria em si é pura (src/lib/quality) e roda no cliente.
 */
export async function getQualityContext(
  spaceId: string,
  nodeId: string,
): Promise<{ validPaths: string[]; otherArticles: QualityContext["otherArticles"] }> {
  const supabase = await createClient();
  const { data: spaces } = await supabase.from("spaces").select("id, slug");

  const validPaths: string[] = [];
  const otherArticles: QualityContext["otherArticles"] = [];
  for (const s of spaces ?? []) {
    const paths = await slugPathsOf(s.id);
    for (const [id, partes] of paths) {
      const caminho = `${s.slug}/${partes.join("/")}`;
      validPaths.push(caminho);
      if (s.id === spaceId && id !== nodeId) {
        // Título vem depois, numa consulta só (abaixo).
        otherArticles.push({ title: id, path: caminho });
      }
    }
  }

  // Resolve os títulos dos artigos publicados do espaço (o placeholder acima
  // guardou o id no campo title).
  const ids = otherArticles.map((o) => o.title);
  const porId = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("nodes")
      .select("id, title")
      .in("id", ids.slice(i, i + 200))
      .eq("type", "article")
      .eq("status", "published")
      .is("deleted_at", null);
    for (const n of data ?? []) porId.set(n.id, n.title);
  }
  return {
    validPaths,
    otherArticles: otherArticles
      .filter((o) => porId.has(o.title))
      .map((o) => ({ title: porId.get(o.title)!, path: o.path })),
  };
}
