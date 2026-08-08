import "server-only";
import { embed } from "ai";
import { embeddingModel, embeddingCallOptions, aiTimeout } from "@/lib/ai/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { entradasOntologia } from "@/lib/ai/ontology";
import { selecionarFormasOntologia } from "./ontology-enrich";
import { toolCatalogText } from "./tool-catalog-text";
import { escolherRanking } from "./rank-resgate";

type DB = SupabaseClient<Database>;

/**
 * Catálogo SEMÂNTICO de tools. O embedding de cada tool (name + description) vive em
 * `ai_tools.embedding` (materializado, sincronizado no saveTool). Aqui: gerar o
 * embedding, gravar (sync no CRUD) e CASAR a mensagem do usuário contra o catálogo
 * da base — embedando a mensagem 1x e ordenando por cosseno. Serve ao roteador de
 * fonte do chat (relatório da tela × conhecimento da IA / qual tool).
 */

export { semOrquestracao, toolCatalogText } from "./tool-catalog-text";

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
  extra?: { searchTerms?: string | null; responseHint?: string | null; chavesDeOutras?: Set<string> },
): Promise<void> {
  const emb = await embedTexto(toolCatalogText(name, description, extra));
  if (!emb) return;
  const { error } = await db.from("ai_tools").update({ embedding: vecLiteral(emb) }).eq("id", toolId);
  if (error) console.error("[tool-catalog] gravar embedding falhou:", error.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDING POR BASE, enriquecido com a ONTOLOGIA do cliente
//
// Ninguém consegue digitar à mão todo sinônimo de todo conceito. A ontologia da
// documentação já tem esse vocabulário — aqui ele entra no vetor da ferramenta:
// se a descrição fala em "centro de custo" e a ontologia registra que isso também
// é "célula/departamento/setor", o vetor DAQUELA BASE passa a casar com as três.
//
// Fica em `ai_tool_base_embeddings` (não no global) porque a ontologia é por
// cliente: o vocabulário de um não pode contaminar o roteamento do outro.
// ─────────────────────────────────────────────────────────────────────────────

/** Hash estável e curto do texto-fonte (evita re-embeddar o que não mudou). */
function hashTexto(s: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}`;
}

/** Espaços de documentação ligados a uma base (de onde vem a ontologia dela). */
async function espacosDaBase(db: DB, baseId: string): Promise<string[]> {
  const { data } = await db.from("ai_base_spaces").select("space_id").eq("base_id", baseId);
  return (data ?? []).map((r) => r.space_id);
}

export type ResultadoSyncBase = { total: number; regerados: number; pulados: number; semOntologia: number };

/**
 * (Re)gera os embeddings de UMA BASE com a ontologia dela. Idempotente: só refaz
 * quando o texto-fonte mudou (hash) — republicar ontologia não re-embedda o
 * catálogo inteiro à toa. `force` ignora o hash.
 *
 * Best-effort por tool: falha de embedding de uma não derruba o lote.
 */
export async function syncToolBaseEmbeddings(
  db: DB,
  baseCode: string,
  opts: { toolIds?: string[]; force?: boolean; onProgresso?: (feito: number, total: number) => void } = {},
): Promise<ResultadoSyncBase> {
  const zero: ResultadoSyncBase = { total: 0, regerados: 0, pulados: 0, semOntologia: 0 };
  const alvo = String(baseCode ?? "").trim();
  if (!alvo) return zero;
  const { data: base } = await db.from("ai_bases").select("id").ilike("base_code", alvo).eq("active", true).maybeSingle();
  if (!base) return zero;

  const spaceIds = await espacosDaBase(db, base.id);
  const { data: rows } = await db
    .from("ai_base_tools")
    .select("tool:ai_tools(id, key, name, description, search_terms, response_hint, active)")
    .eq("base_id", base.id)
    .eq("enabled", true);

  type Row = { id: string; key: string; name: string; description: string; search_terms: string | null; response_hint: string | null; active: boolean };
  const tools = (rows ?? [])
    .map((r) => (r as { tool: Row | null }).tool)
    .filter((t): t is Row => !!t && t.active)
    .filter((t) => !opts.toolIds?.length || opts.toolIds.includes(t.id));
  if (!tools.length) return zero;
  // Chaves das OUTRAS ferramentas: o que aparecer numa descrição citando uma delas é
  // orquestração, não assunto — sai do vetor (ver `semOrquestracao`).
  const todasChaves = new Set(tools.map((t) => t.key.toLowerCase()));
  const outrasChaves = (propria: string) => {
    const s2 = new Set(todasChaves);
    s2.delete(propria.toLowerCase());
    return s2;
  };

  const { data: atuais } = await db
    .from("ai_tool_base_embeddings")
    .select("tool_id, fonte_hash")
    .eq("base_id", base.id);
  const hashAtual = new Map((atuais ?? []).map((r) => [r.tool_id, r.fonte_hash]));

  // ── Quais conceitos da ontologia cada ferramenta dispara ────────────────────
  // Duas passadas: a 1ª casa os conceitos e conta em quantas ferramentas cada
  // GATILHO aparece; a 2ª descarta o conceito que só foi disparado por termo
  // genérico (presente em todo o catálogo) — senão o vetor da ferramenta vira uma
  // sopa de vocabulário de RH e perde o próprio assunto.
  const entradas = spaceIds.length ? await entradasOntologia(db, spaceIds) : [];
  const textos = new Map<string, string>();
  for (const t of tools) {
    textos.set(t.id, toolCatalogText(t.name, t.description, {
      searchTerms: t.search_terms,
      responseHint: t.response_hint,
      chavesDeOutras: outrasChaves(t.key),
    }));
  }
  const formasPorTool = selecionarFormasOntologia(textos, entradas);

  const out: ResultadoSyncBase = { ...zero, total: tools.length };
  let feito = 0;
  for (const t of tools) {
    const texto = textos.get(t.id)!;
    const usadas = formasPorTool.get(t.id) ?? [];
    const fonte = usadas.length ? `${texto}\nTambém chamado de: ${usadas.join(", ")}` : texto;
    const hash = hashTexto(fonte);
    if (!usadas.length) out.semOntologia++;
    if (!opts.force && hashAtual.get(t.id) === hash) {
      out.pulados++;
      opts.onProgresso?.(++feito, tools.length);
      continue;
    }
    const emb = await embedTexto(fonte.slice(0, 4000));
    if (!emb) {
      opts.onProgresso?.(++feito, tools.length);
      continue; // provedor falhou nesta: mantém o vetor anterior (ou o global)
    }
    const { error } = await db.from("ai_tool_base_embeddings").upsert(
      {
        base_id: base.id,
        tool_id: t.id,
        embedding: vecLiteral(emb),
        fonte_hash: hash,
        termos_ontologia: usadas.length,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "base_id,tool_id" },
    );
    if (error) console.error(`[tool-catalog] embedding por base (${t.key}):`, error.message);
    else out.regerados++;
    opts.onProgresso?.(++feito, tools.length);
  }
  invalidateCatalogo(alvo);
  return out;
}

/**
 * Uma tool candidata. `description` é o texto do MODELO (técnico, longo);
 * `descricao_usuario` é o que se mostra a quem clica — nunca troque um pelo outro.
 */
export type ToolMatch = {
  key: string;
  name: string;
  description: string;
  descricao_usuario?: string | null;
  /** false = uso interno do agente: some das listagens do chat, segue disponível ao modelo. */
  selecionavel_no_chat?: boolean;
  sim: number;
};

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

type ToolRow = { id: string; key: string; name: string; description: string; descricao_usuario: string | null; selecionavel_no_chat: boolean | null; embedding: unknown; active: boolean };
type CatalogoItem = {
  key: string;
  name: string;
  description: string;
  /** Texto para o USUÁRIO (botões de fonte no chat). Fora do embedding, de propósito. */
  descricao_usuario: string;
  /** false = não entra nas listagens de fonte (mas continua no roteamento). */
  selecionavel_no_chat: boolean;
  /** Vetor GLOBAL (nome+descrição+sinônimos digitados). */
  emb: number[];
  /** Vetor da BASE, enriquecido com a ontologia do cliente. Null = ainda não gerado. */
  embOnto?: number[] | null;
};

/**
 * Similaridade da tool com a consulta: o MAIOR entre o vetor global e o enriquecido
 * pela ontologia. Estritamente ADITIVO — o enriquecido só entra quando reconhece a
 * palavra do usuário melhor que o original, então a mudança nunca REBAIXA o que já
 * funcionava. (Substituir um pelo outro diluía as perguntas do dia a dia em ~0.015 e
 * mexia com os limiares ABSOLUTOS de roteamento: 0.60 do piso, 0.70 da rota direta.)
 */
function simDaTool(q: number[], t: CatalogoItem): number {
  const base = cosseno(q, t.emb);
  return t.embOnto?.length ? Math.max(base, cosseno(q, t.embOnto)) : base;
}

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
    .select("tool:ai_tools(id, key, name, description, descricao_usuario, selecionavel_no_chat, embedding, active)")
    .eq("base_id", base.id)
    .eq("enabled", true);
  // Vetor ENRIQUECIDO com a ontologia DESTA base tem preferência; o global de
  // `ai_tools.embedding` é o fallback (base sem ontologia, tool nova ainda não
  // processada, ou falha do provedor na geração).
  const { data: porBase } = await db
    .from("ai_tool_base_embeddings")
    .select("tool_id, embedding")
    .eq("base_id", base.id);
  const embBase = new Map((porBase ?? []).map((r) => [r.tool_id, parseEmb(r.embedding)]));
  const cat = (rows ?? [])
    .map((r) => (r as { tool: ToolRow | null }).tool)
    .filter((t): t is ToolRow => !!t && t.active)
    .flatMap((t): CatalogoItem[] => {
      const emb = parseEmb(t.embedding);
      if (!emb?.length) return [];
      return [{ key: t.key, name: t.name, description: t.description, descricao_usuario: t.descricao_usuario ?? "", selecionavel_no_chat: t.selecionavel_no_chat !== false, emb, embOnto: embBase.get(t.id) ?? null }];
    });
  catalogoCache.set(chave, { exp: Date.now() + CATALOGO_TTL, cat });
  return cat;
}

/**
 * LISTA as tools da base para o usuário escolher à mão ("Outra fonte" no gate),
 * sem limiar de similaridade — é o catálogo inteiro, ordenado por nome.
 *
 * Reusa o mesmo `loadCatalogo` cacheado do roteamento: nenhuma query nova. Por isso
 * herda a regra dele — tool SEM embedding não aparece aqui. Na prática elas também
 * não seriam roteadas por similaridade; se um dia isso incomodar, basta trocar por
 * um `select key,name,description` próprio (forçar por chave já funciona sem vetor).
 */
export async function listBaseTools(
  db: DB,
  baseCode: string,
  limite = 80,
): Promise<{ key: string; name: string; description: string | null; descricao_usuario: string }[]> {
  const cat = await loadCatalogo(db, baseCode);
  return cat
    // Esta lista é a gaveta "Outra fonte" — o catálogo inteiro para o usuário
    // escolher à mão. Ferramenta de uso interno do agente é filtrada AQUI, na
    // origem: é o único consumidor desta função, e escolher um passo
    // intermediário nunca é o que a pessoa quis.
    .filter((t) => t.selecionavel_no_chat)
    .map((t) => ({ key: t.key, name: t.name, description: t.description, descricao_usuario: t.descricao_usuario }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, limite);
}

/**
 * Casa a mensagem contra o catálogo com a ontologia como RESGATE, não como distorção.
 *
 * ── O defeito que isto conserta, medido ──────────────────────────────────────
 * A consulta de roteamento era "pergunta + as 6 primeiras formas da ontologia".
 * Para "Quero meu histórico financeiro do mês de 05/2025", as formas do cliente
 * incluem "holerite" e "recibo de salario" — que são exatamente os sinônimos
 * cadastrados de OUTRA ferramenta. Medição real:
 *
 *   pergunta crua      → historico_financeiro 0.698 > relatorio_recibo 0.691  ✓
 *   com a ontologia    → relatorio_recibo 0.796 > historico_financeiro 0.744  ✗
 *
 * A expansão deu +0.105 à irmã e +0.046 à certa: ela injeta o vocabulário de uma
 * ferramenta vizinha dentro da pergunta. E dilui — a frase do usuário vira 1
 * linha entre 7, perdendo de 6 a 1 para termos que ele não escreveu.
 *
 * ── A regra ─────────────────────────────────────────────────────────────────
 * Ranqueia com a PERGUNTA CRUA. Se ela já acha alguém acima do limiar, é esse o
 * ranking: as palavras do usuário mandam. Só quando a pergunta crua não acha
 * nada — o caso para o qual a ontologia existe, o usuário dizendo "holerite"
 * quando a ferramenta se chama "eventos financeiros" — a expansão entra.
 *
 * Aditivo por construção: a ontologia só pode ACRESCENTAR candidatas quando não
 * havia nenhuma; nunca reordena as que a pergunta já encontrou.
 */
export async function casarToolsComResgate(
  db: DB,
  baseCode: string,
  consultaPura: string,
  consultaComOntologia: string,
  opts: { limiar?: number; limite?: number } = {},
): Promise<{ matches: ToolMatch[]; viaOntologia: boolean }> {
  const pura = await matchBaseTools(db, baseCode, consultaPura, opts);
  // Sem expansão a fazer (ou a pergunta já achou): poupa o 2º embedding.
  if (pura.length > 0 || consultaComOntologia === consultaPura) {
    return escolherRanking(pura, pura);
  }
  const expandida = await matchBaseTools(db, baseCode, consultaComOntologia, opts);
  return escolherRanking(pura, expandida);
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
    // Ferramenta de USO INTERNO sai ANTES do corte por limite, não depois.
    //
    // Este ranking existe para montar a lista de opções e para decidir o
    // roteamento. Uma dependência (`*_meses`, `linha_tempo_fato`) é semanticamente
    // parecidíssima com a consulta de verdade — ela vinha alto, ocupava vaga dentro
    // do `limite`, e a boa opção que estava logo abaixo nem chegava a entrar. Pior:
    // quando vinha em 1º, era ela que o roteador forçava sozinha, e o usuário
    // recebia uma lista de competências no lugar da resposta.
    //
    // O agente NÃO perde nada com isto: o toolset dele é montado por
    // `simTools`/`selecionarTopK`, outro caminho, e a dependência continua sendo
    // puxada junto pelo mecanismo de dependência citada na descrição.
    .filter((t) => t.selecionavel_no_chat)
    .map((t) => ({ key: t.key, name: t.name, description: t.description, descricao_usuario: t.descricao_usuario, selecionavel_no_chat: t.selecionavel_no_chat, sim: simDaTool(q, t) }))
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
  for (const t of cat) out.set(t.key, simDaTool(q, t));
  return out;
}

/**
 * Similaridade de VÁRIAS facetas de uma vez (ver `facets.ts`) — um Map por faceta,
 * alinhado com a entrada. Embeda todas em PARALELO e reusa o catálogo já cacheado:
 * o custo de parede é o de UMA chamada, não o de N.
 *
 * Existe porque um embedding único de pergunta multi-intenção borra cada intenção —
 * a ferramenta certa de cada faceta desaba no ranking e o top-K a corta. Com um Map
 * por faceta, o `selecionarTopK` aplica o piso DENTRO de cada faceta e nenhuma delas
 * fica sem ferramenta.
 *
 * Faceta cujo embedding falhou/estourou o tempo vira Map VAZIO (o chamador ignora) —
 * nunca derruba o turno.
 */
export async function simToolsMulti(
  db: DB,
  baseCode: string,
  facetas: string[],
  // Folga sobre o timeout de 1 embedding: N chamadas simultâneas disputam conexão e a
  // mais lenta arrasta o lote (medido: 9 facetas em ~2,2s). Estourou → o chamador
  // refaz só o embedding da pergunta inteira.
  timeoutMs = 4000,
): Promise<Map<string, number>[]> {
  const alvos = (facetas ?? []).map((f) => String(f ?? "").trim());
  if (!alvos.length) return [];
  const cat = await loadCatalogo(db, baseCode);
  if (!cat.length) return alvos.map(() => new Map());
  // Um relógio só para o lote: N facetas não podem multiplicar o teto de espera.
  const prazo = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  const vetores = await Promise.all(
    alvos.map((msg) => (msg ? Promise.race([embedTexto(msg), prazo]) : Promise.resolve(null))),
  );
  return vetores.map((q) => {
    const m = new Map<string, number>();
    if (!q) return m;
    for (const t of cat) m.set(t.key, simDaTool(q, t));
    return m;
  });
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
    .select("tool:ai_tools(key, name, description, descricao_usuario, selecionavel_no_chat, active)")
    .eq("base_id", base.id)
    .eq("enabled", true);
  const porChave = new Map(
    (rows ?? [])
      .map((r) => (r as { tool: { key: string; name: string; description: string; descricao_usuario: string; selecionavel_no_chat: boolean; active: boolean } | null }).tool)
      .filter((t): t is { key: string; name: string; description: string; descricao_usuario: string; selecionavel_no_chat: boolean; active: boolean } => !!t && t.active)
      .map((t) => [t.key, t]),
  );
  return chaves
    .map((k) => porChave.get(k))
    .filter((t): t is { key: string; name: string; description: string; descricao_usuario: string; selecionavel_no_chat: boolean; active: boolean } => !!t)
    .map((t) => ({ key: t.key, name: t.name, description: t.description, descricao_usuario: t.descricao_usuario, selecionavel_no_chat: t.selecionavel_no_chat, sim: 1 }));
}
