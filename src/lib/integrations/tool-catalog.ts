import "server-only";
import { embed } from "ai";
import { embeddingModel, embeddingCallOptions, aiTimeout } from "@/lib/ai/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

/**
 * Catálogo SEMÂNTICO de tools. O embedding de cada tool (name + description) vive em
 * `ai_tools.embedding` (materializado, sincronizado no saveTool). Aqui: gerar o
 * embedding, gravar (sync no CRUD) e CASAR a mensagem do usuário contra o catálogo
 * da base — embedando a mensagem 1x e ordenando por cosseno. Serve ao roteador de
 * fonte do chat (relatório da tela × conhecimento da IA / qual tool).
 */

/** Texto canônico embedado por tool (e reusado para embedar a mensagem do usuário). */
export function toolCatalogText(
  name: string,
  description: string,
  extra?: { searchTerms?: string | null; responseHint?: string | null },
): string {
  // Sinônimos/exemplos (search_terms) e o que a tool RETORNA (response_hint) enriquecem
  // o embedding — o matching semântico passa a entender o vocabulário do usuário.
  return [name, description, extra?.searchTerms, extra?.responseHint]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join(" — ")
    .slice(0, 2000);
}

/** Embedding de um texto (tool ou mensagem). Null em erro — nunca derruba o CRUD/chat. */
export async function embedTexto(texto: string): Promise<number[] | null> {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  try {
    const { embedding } = await embed({
      model: await embeddingModel(),
      value: t,
      providerOptions: await embeddingCallOptions(),
      // V2: mesma proteção do RAG — provedor de embedding FRIO (~15s) não pode travar a
      // hot-path do matcher de tools; estoura o timeout e cai no léxico/rota sem embedding.
      abortSignal: aiTimeout("embedding_query"),
    });
    return embedding as number[];
  } catch (e) {
    console.error("[tool-catalog] embed falhou:", e);
    return null;
  }
}

/** Serializa um vetor para o formato que o pgvector aceita via PostgREST ("[...]"). */
function vecLiteral(emb: number[]): string {
  return `[${emb.join(",")}]`;
}

/** Recalcula e grava o embedding de UMA tool (chamado no saveTool). Best-effort. */
export async function syncToolEmbedding(
  db: DB,
  toolId: string,
  name: string,
  description: string,
  extra?: { searchTerms?: string | null; responseHint?: string | null },
): Promise<void> {
  const emb = await embedTexto(toolCatalogText(name, description, extra));
  if (!emb) return;
  const { error } = await db.from("ai_tools").update({ embedding: vecLiteral(emb) }).eq("id", toolId);
  if (error) console.error("[tool-catalog] gravar embedding falhou:", error.message);
}

export type ToolMatch = { key: string; name: string; description: string; sim: number };

function parseEmb(v: unknown): number[] | null {
  if (Array.isArray(v)) return v as number[];
  if (typeof v === "string") {
    try {
      const a = JSON.parse(v);
      return Array.isArray(a) ? (a as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function cosseno(a: number[], b: number[]): number {
  let d = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    d += x * y; na += x * x; nb += y * y;
  }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

type ToolRow = { key: string; name: string; description: string; embedding: unknown; active: boolean };
type CatalogoItem = { key: string; name: string; description: string; emb: number[] };

// Cache EM MEMÓRIA do catálogo (embeddings das tools) — antes relido do Supabase a
// cada `matchBaseTools`. TTL curto; zerado por invalidateBaseContext ao editar tools.
const catalogoCache = new Map<string, { exp: number; cat: CatalogoItem[] }>();
const CATALOGO_TTL = 60_000;

/** Zera o cache do catálogo de embeddings (chamado por invalidateBaseContext). */
export function invalidateCatalogo(baseCode?: string): void {
  if (baseCode) catalogoCache.delete(baseCode.trim().toLowerCase());
  else catalogoCache.clear();
}

/** Carrega as tools ATIVAS da base com seus embeddings (só as com embedding). Cacheado. */
async function loadCatalogo(db: DB, baseCode: string): Promise<CatalogoItem[]> {
  const alvo = String(baseCode ?? "").trim();
  if (!alvo) return [];
  const chave = alvo.toLowerCase();
  const hit = catalogoCache.get(chave);
  if (hit && hit.exp > Date.now()) return hit.cat;
  const { data: base } = await db.from("ai_bases").select("id").ilike("base_code", alvo).eq("active", true).maybeSingle();
  if (!base) return [];
  const { data: rows } = await db
    .from("ai_base_tools")
    .select("tool:ai_tools(key, name, description, embedding, active)")
    .eq("base_id", base.id)
    .eq("enabled", true);
  const cat = (rows ?? [])
    .map((r) => (r as { tool: ToolRow | null }).tool)
    .filter((t): t is ToolRow => !!t && t.active)
    .map((t) => ({ key: t.key, name: t.name, description: t.description, emb: parseEmb(t.embedding) }))
    .filter((t): t is CatalogoItem => !!t.emb && t.emb.length > 0);
  catalogoCache.set(chave, { exp: Date.now() + CATALOGO_TTL, cat });
  return cat;
}

/**
 * CASA a mensagem contra o catálogo da base: embeda a mensagem 1x e ordena por
 * cosseno. Só embeda se houver catálogo (economiza a chamada quando a base não tem
 * tools). Retorna as acima do limiar (padrão 0.38), no máximo `limite`.
 */
export async function matchBaseTools(
  db: DB,
  baseCode: string,
  mensagem: string,
  opts: { limiar?: number; limite?: number } = {},
): Promise<ToolMatch[]> {
  const msg = String(mensagem ?? "").trim();
  if (!msg) return [];
  const cat = await loadCatalogo(db, baseCode);
  if (!cat.length) return [];
  const q = await embedTexto(msg);
  if (!q) return [];
  // Limiar 70%: só pergunta a fonte quando a semelhança da mensagem com a tool for
  // >= 0.70. Intenções claras (ex.: "férias do colaborador") batem ~0.72+; perguntas
  // genéricas de relatório ("quantos registros no total") ficam ~0.61 e NÃO roteiam.
  const limiar = opts.limiar ?? 0.70;
  const limite = opts.limite ?? 5;
  return cat
    .map((t) => ({ key: t.key, name: t.name, description: t.description, sim: cosseno(q, t.emb) }))
    .filter((m) => m.sim >= limiar)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, limite);
}

/**
 * Similaridade da mensagem contra TODAS as tools do catálogo (Map `key`→sim). Embeda a
 * mensagem 1× e reusa o catálogo cacheado — serve à SELEÇÃO do toolset (não só à rota).
 * `timeoutMs`: se o provedor de embedding estiver frio e demorar, devolve Map VAZIO →
 * o chamador cai no fallback léxico sem travar o turno.
 */
export async function simTools(
  db: DB,
  baseCode: string,
  mensagem: string,
  timeoutMs = 2500,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const msg = String(mensagem ?? "").trim();
  if (!msg) return out;
  const cat = await loadCatalogo(db, baseCode);
  if (!cat.length) return out;
  const q = await Promise.race([
    embedTexto(msg),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
  if (!q) return out;
  for (const t of cat) out.set(t.key, cosseno(q, t.emb));
  return out;
}

/** Metadados (nome/descrição) de tools por chave — sem embeddar (usado no 2º passo). */
export async function loadToolsByKeys(db: DB, baseCode: string, keys: string[]): Promise<ToolMatch[]> {
  const alvo = String(baseCode ?? "").trim();
  const chaves = [...new Set((keys ?? []).map((k) => String(k)).filter(Boolean))];
  if (!alvo || !chaves.length) return [];
  const { data: base } = await db.from("ai_bases").select("id").ilike("base_code", alvo).eq("active", true).maybeSingle();
  if (!base) return [];
  const { data: rows } = await db
    .from("ai_base_tools")
    .select("tool:ai_tools(key, name, description, active)")
    .eq("base_id", base.id)
    .eq("enabled", true);
  const porChave = new Map(
    (rows ?? [])
      .map((r) => (r as { tool: { key: string; name: string; description: string; active: boolean } | null }).tool)
      .filter((t): t is { key: string; name: string; description: string; active: boolean } => !!t && t.active)
      .map((t) => [t.key, t]),
  );
  return chaves
    .map((k) => porChave.get(k))
    .filter((t): t is { key: string; name: string; description: string; active: boolean } => !!t)
    .map((t) => ({ key: t.key, name: t.name, description: t.description, sim: 1 }));
}
