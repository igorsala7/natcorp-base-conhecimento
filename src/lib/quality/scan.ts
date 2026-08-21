import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { normalizeDoc } from "@/lib/blocks/convert";
import {
  auditArticle,
  collectExternalLinks,
  type QualityContext,
  type QualityIssue,
} from "./audit-article";
import { fetchAllPaged } from "@/lib/supabase/paginate";

/**
 * Varredura de qualidade de UMA documentação (roda no worker): auditoria pura
 * por artigo publicado + checagem de links EXTERNOS com cache em `link_checks`
 * (7 dias). Resultado por artigo em `quality_reports` (upsert por node_id).
 *
 * Não usa o data-layer do app (cookies do Next) — só o client passado, que no
 * worker é service-role.
 */
type Db = SupabaseClient<Database>;

const CACHE_DIAS = 7;
const TIMEOUT_MS = 8000;
const MAX_LINKS_POR_SCAN = 200;

/** Monta o contexto sem o data-layer do Next (o worker não tem cookies). */
export async function buildQualityContext(
  db: Db,
  spaceId: string,
): Promise<QualityContext & { spaceSlugById: Map<string, string> }> {
  const [{ data: spaces }, nodes] = await Promise.all([
    db.from("spaces").select("id, slug"),
    // Paginado: sem filtro de espaço, >1000 nós no total truncariam o mapa de
    // pais e os caminhos/SEO sairiam errados (ver fetchAllPaged).
    fetchAllPaged(async (from, to) => {
      const { data, error } = await db
        .from("nodes")
        .select("id, space_id, parent_id, slug, title, type, status")
        .is("deleted_at", null)
        .order("id")
        .range(from, to);
      return { data, error };
    }),
  ]);
  const porId = new Map(nodes.map((n) => [n.id, n]));
  const caminhoDe = (id: string): string[] => {
    const partes: string[] = [];
    let atual = porId.get(id);
    let guarda = 0;
    while (atual && guarda++ < 50) {
      partes.unshift(atual.slug);
      atual = atual.parent_id ? porId.get(atual.parent_id) : undefined;
    }
    return partes;
  };
  const spaceSlugById = new Map((spaces ?? []).map((s) => [s.id, s.slug]));
  const validPaths = new Set<string>();
  const otherArticles: QualityContext["otherArticles"] = [];
  for (const n of nodes ?? []) {
    const slug = spaceSlugById.get(n.space_id);
    if (!slug) continue;
    const caminho = `${slug}/${caminhoDe(n.id).join("/")}`;
    validPaths.add(caminho);
    if (n.space_id === spaceId && n.type === "article" && n.status === "published") {
      otherArticles.push({ title: n.title, path: caminho });
    }
  }
  return { validPaths, otherArticles, spaceSlugById };
}

/** Checa um lote de URLs respeitando o cache; devolve o mapa url → ok. */
async function checkExternalLinks(db: Db, urls: string[]): Promise<Map<string, boolean>> {
  const resultado = new Map<string, boolean>();
  if (!urls.length) return resultado;

  const corte = new Date(Date.now() - CACHE_DIAS * 86400_000).toISOString();
  const { data: cache } = await db
    .from("link_checks")
    .select("url, ok, checked_at")
    .in("url", urls.slice(0, MAX_LINKS_POR_SCAN));
  const fresco = new Map(
    (cache ?? []).filter((c) => c.checked_at >= corte).map((c) => [c.url, c.ok === true]),
  );

  for (const url of urls.slice(0, MAX_LINKS_POR_SCAN)) {
    const emCache = fresco.get(url);
    if (emCache !== undefined) {
      resultado.set(url, emCache);
      continue;
    }
    let ok = false;
    let status: number | null = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
      // Muitos servidores recusam HEAD (405/403): confirma com GET antes de
      // acusar link quebrado.
      if (res.status >= 400) {
        res = await fetch(url, { method: "GET", redirect: "follow", signal: ctrl.signal });
      }
      clearTimeout(timer);
      status = res.status;
      ok = res.status < 400;
    } catch {
      ok = false;
    }
    resultado.set(url, ok);
    await db
      .from("link_checks")
      .upsert({ url, ok, status, checked_at: new Date().toISOString() }, { onConflict: "url" });
  }
  return resultado;
}

export type ScanResumo = { artigos: number; issues: number };

export async function scanSpaceQuality(db: Db, spaceId: string): Promise<ScanResumo> {
  const ctx = await buildQualityContext(db, spaceId);
  // Paginado: `natcorp` tem 4.314 artigos e o corte silencioso em 1.000 faria
  // a varredura de qualidade declarar "sem problemas" o que ela nunca abriu.
  const artigos = await fetchAllPaged<{ id: string; title: string; description: string | null }>(
    (de, ate) =>
      db
        .from("nodes")
        .select("id, title, description")
        .eq("space_id", spaceId)
        .eq("type", "article")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("id")
        .range(de, ate),
  );

  let totalIssues = 0;
  for (const n of artigos) {
    const { data: art } = await db
      .from("articles")
      .select("content_json")
      .eq("node_id", n.id)
      .maybeSingle();
    const blocks = normalizeDoc(art?.content_json).blocks;

    const issues: QualityIssue[] = auditArticle(
      { title: n.title, description: n.description, blocks },
      ctx,
    );

    const externos = collectExternalLinks(blocks);
    const checagem = await checkExternalLinks(db, externos);
    for (const [url, ok] of checagem) {
      if (!ok) {
        issues.push({
          tipo: "link",
          impacto: "alto",
          mensagem: `Link externo quebrado: ${url}`,
        });
      }
    }

    totalIssues += issues.length;
    await db.from("quality_reports").upsert(
      {
        node_id: n.id,
        space_id: spaceId,
        issues: issues as unknown as Json,
        score: issues.length,
        run_at: new Date().toISOString(),
      },
      { onConflict: "node_id" },
    );
  }
  return { artigos: artigos?.length ?? 0, issues: totalIssues };
}
