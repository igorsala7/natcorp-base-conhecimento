import "server-only";
import { createHash } from "node:crypto";
import { embedMany, generateText } from "ai";
import {
  embeddingModel,
  embeddingCallOptions,
  hasEmbeddingKey,
  hasAiKey,
  languageModel,
  aiTimeout,
  resolveAi,
} from "@/lib/ai/config";
import type { createClient } from "@/lib/supabase/server";
import { promptField } from "@/lib/ai/prompts";
import { normalizeDoc } from "@/lib/blocks/convert";
import { blocksToText, richToText } from "@/lib/blocks/serialize";

/**
 * VARREDURA POR IA (Fase 3): antes de vetorizar, a IA lê o documento inteiro e
 * gera UMA frase de contexto, prefixada em todos os chunks — trechos genéricos
 * ("clique em Salvar") deixam de colidir entre documentos e a busca fica mais
 * assertiva. Cacheada por hash do conteúdo (`embedding_context`/`_hash` na
 * origem) para NÃO repetir a chamada a cada publicação. Sem IA de chat
 * configurada, devolve "" e vale o prefixo estático de sempre.
 */
async function documentContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "articles" | "knowledge_documents",
  id: string,
  fullText: string,
): Promise<string> {
  const texto = fullText.trim();
  if (!texto) return "";
  const hash = createHash("sha256").update(texto).digest("hex");

  const { data: row } = await supabase
    .from(table)
    .select("embedding_context, embedding_context_hash")
    .eq("id", id)
    .maybeSingle();
  if (row?.embedding_context && row.embedding_context_hash === hash) return row.embedding_context;

  if (!(await hasAiKey("chat"))) return "";
  try {
    const contexto = await promptField("embeddings", "contexto");
    const { text } = await generateText({
      model: await languageModel("chat", { rotulo: "chunking" }),
      prompt: contexto + "\n\nDOCUMENTO:\n" + texto.slice(0, 12_000),
      // Timeout curto: a varredura roda também na publicação; não pode travar.
      abortSignal: AbortSignal.timeout(20_000),
    });
    const ctx = text.trim().replace(/\s+/g, " ").slice(0, 400);
    if (ctx) {
      await supabase.from(table).update({ embedding_context: ctx, embedding_context_hash: hash }).eq("id", id);
    }
    return ctx;
  } catch {
    return ""; // falha/timeout: segue com o prefixo estático
  }
}

export type Chunk = { heading_path: string; content: string };

// Tamanho-alvo do chunk (chars). ~500 tokens: bom para embedding (fica MUITO
// abaixo do limite do modelo) e para precisão da busca. Uma seção grande SEM
// heading (ex.: um artigo com milhares de parágrafos) era virava 1 chunk gigante
// que estourava o modelo e era inútil na busca — por isso o corte por tamanho.
const CHUNK_MAX = 2000;

/** Fatia um texto longo em pedaços de até `max`, cortando em espaço quando dá. */
function fatiar(s: string, max: number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + max, s.length);
    if (end < s.length) {
      const sp = s.lastIndexOf(" ", end);
      if (sp > i + max * 0.6) end = sp; // corta numa palavra, se razoável
    }
    const p = s.slice(i, end).trim();
    if (p) out.push(p);
    i = end;
  }
  return out;
}

/**
 * Particiona o documento por headings: cada H1/H2/H3 inicia um chunk, cujo
 * conteúdo é o texto até o próximo heading. heading_path acumula a trilha.
 * Seções grandes são ainda sub-divididas por TAMANHO (~CHUNK_MAX). Aceita
 * BlockDoc v2 ou TipTap legado (normalizeDoc converte na leitura).
 */
export function chunkArticle(docInput: unknown): Chunk[] {
  const { blocks } = normalizeDoc(docInput);
  const chunks: Chunk[] = [];
  let trail: { level: number; text: string }[] = [];
  let current: { heading_path: string; parts: string[] } = {
    heading_path: "",
    parts: [],
  };

  const push = (texto: string) => {
    const content = texto.replace(/\s+\n/g, "\n").trim();
    if (content) chunks.push({ heading_path: current.heading_path, content });
  };
  const flush = () => {
    let buf = "";
    for (const p of current.parts) {
      if (p.length > CHUNK_MAX) {
        // parágrafo isolado maior que o limite → fecha o buffer e fatia por tamanho
        if (buf) { push(buf); buf = ""; }
        for (const pedaco of fatiar(p, CHUNK_MAX)) push(pedaco);
        continue;
      }
      if (buf && buf.length + 1 + p.length > CHUNK_MAX) { push(buf); buf = ""; }
      buf = buf ? buf + "\n" + p : p;
    }
    if (buf) push(buf);
  };

  for (const block of blocks) {
    if (block.type === "heading") {
      flush();
      const level = block.data.level;
      const text = richToText(block.text).trim();
      trail = trail.filter((t) => t.level < level);
      trail.push({ level, text });
      current = {
        heading_path: trail.map((t) => t.text).join(" > "),
        parts: text ? [text] : [],
      };
    } else {
      current.parts.push(blocksToText([block]));
    }
  }
  flush();
  return chunks;
}

/**
 * Texto que VIRA o vetor: o conteúdo prefixado por onde ele vive
 * ("Documento: Manual X — Artigo: Emitir NF > Passos").
 *
 * É o "contextual retrieval": numa documentação com 20 manuais importados,
 * trechos genéricos ("clique em Salvar e confirme") ficam quase idênticos no
 * espaço vetorial e a busca cruzava manuais. O prefixo carrega a identidade
 * do manual para dentro do vetor. Só o EMBEDDING muda — a coluna `content`
 * (exibição, snippet, tsv) continua o texto puro.
 */
function textoParaEmbedding(
  contexto: string,
  heading: string,
  content: string,
  aiContext = "",
): string {
  const trilha = [contexto, heading].filter(Boolean).join(" > ");
  const cabecalho = [aiContext ? `Contexto: ${aiContext}` : "", trilha].filter(Boolean).join("\n");
  return cabecalho ? `${cabecalho}\n\n${content}` : content;
}

/** Reconstrói o uuid a partir do rótulo do ltree (uuid sem hífens). */
function uuidDeLabel(label: string): string | null {
  if (!/^[0-9a-f]{32}$/.test(label)) return null;
  return `${label.slice(0, 8)}-${label.slice(8, 12)}-${label.slice(12, 16)}-${label.slice(16, 20)}-${label.slice(20)}`;
}

/**
 * "Documento: <manual> — Artigo: <título>" do nó — o prefixo de contexto dos
 * embeddings. O manual é o diretório de 1º nível (primeiro rótulo do path).
 */
async function contextoDoNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nodeId: string,
): Promise<string> {
  const { data: node } = await supabase
    .from("nodes")
    .select("title, path")
    .eq("id", nodeId)
    .maybeSingle();
  if (!node) return "";

  let manual: string | null = null;
  const rootId = uuidDeLabel(String(node.path ?? "").split(".")[0] ?? "");
  if (rootId && rootId !== nodeId) {
    const { data: root } = await supabase
      .from("nodes")
      .select("title")
      .eq("id", rootId)
      .maybeSingle();
    manual = root?.title ?? null;
  }
  return manual ? `Documento: ${manual} — Artigo: ${node.title}` : `Documento: ${node.title}`;
}

/**
 * Regenera os chunks de um nó (delete + insert). Idempotente.
 * `withEmbeddings`: gera embeddings (OpenAI) — usado na publicação. No autosave
 * fica false (rápido; a busca léxica já funciona sem embeddings).
 */
export async function reindexNodeChunks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    nodeId: string;
    articleId: string;
    spaceId: string;
    doc: unknown;
    withEmbeddings?: boolean;
    /** Usuário que disparou (proveniência). Null no worker/sistema. */
    embeddedBy?: string | null;
  },
): Promise<void> {
  const { nodeId, articleId, spaceId, doc, withEmbeddings, embeddedBy } = params;
  await supabase.from("chunks").delete().eq("node_id", nodeId);
  const chunks = chunkArticle(doc);
  if (chunks.length === 0) return;

  let embeddings: number[][] | null = null;
  if (withEmbeddings && await hasEmbeddingKey()) {
    try {
      const contexto = await contextoDoNo(supabase, nodeId);
      const ctxIa = await documentContext(
        supabase,
        "articles",
        articleId,
        chunks.map((c) => c.content).join("\n\n"),
      );
      const { embeddings: e } = await embedMany({
        model: await embeddingModel(),
        values: chunks.map((c) => textoParaEmbedding(contexto, c.heading_path, c.content, ctxIa)),
        // Dimensão na CHAMADA (ver `embeddingCallOptions`): a coluna
        // `chunks.embedding` é vector(1536) e recusa outro tamanho.
        providerOptions: await embeddingCallOptions(),
        abortSignal: aiTimeout("embedding"),
      });
      embeddings = e;
    } catch {
      embeddings = null; // sem embeddings a busca cai no léxico
    }
  }

  const prov = await proveniencia(embeddings, embeddedBy);
  await supabase.from("chunks").insert(
    chunks.map((c, i) => ({
      article_id: articleId,
      node_id: nodeId,
      space_id: spaceId,
      heading_path: c.heading_path || null,
      content: c.content,
      token_count: Math.ceil(c.content.length / 4),
      embedding: embeddings ? JSON.stringify(embeddings[i]) : null,
      ...prov,
    })),
  );
}

/**
 * Proveniência do vetor (provider/model/quando/quem) — só quando o embedding
 * foi realmente gerado. Sem embedding, tudo null (o chunk existe só p/ léxico).
 */
async function proveniencia(
  embeddings: number[][] | null,
  embeddedBy?: string | null,
): Promise<{
  embedding_provider: string | null;
  embedding_model: string | null;
  embedded_at: string | null;
  embedded_by: string | null;
}> {
  if (!embeddings) {
    return { embedding_provider: null, embedding_model: null, embedded_at: null, embedded_by: null };
  }
  const cfg = await resolveAi("embedding");
  return {
    embedding_provider: cfg?.kind ?? null,
    embedding_model: cfg?.model ?? null,
    embedded_at: new Date().toISOString(),
    embedded_by: embeddedBy ?? null,
  };
}

/**
 * Particiona blocos EXTRAÍDOS de um arquivo (PDF/Word/Excel/HTML).
 *
 * Mesma ideia de `chunkArticle`, mas a entrada é `ExtractedBlock[]` (texto +
 * nível) em vez de um documento de blocos. Devolve o mesmo `Chunk`, então o
 * caminho de embedding e gravação é compartilhado — a alternativa seria
 * duplicar a geração de vetores, com risco de as duas divergirem.
 *
 * Chunks pequenos demais são agrupados: um vetor para "Sim" não recupera nada.
 */
export function chunkExtracted(
  blocks: { text: string; level: number }[],
  { minChars = 400, maxChars = 2000 } = {},
): Chunk[] {
  const chunks: Chunk[] = [];
  let trail: { level: number; text: string }[] = [];
  let heading = "";
  let parts: string[] = [];

  const flush = () => {
    const content = parts.join("\n").trim();
    if (content) chunks.push({ heading_path: heading, content });
    parts = [];
  };

  for (const b of blocks) {
    const texto = b.text.trim();
    if (!texto) continue;

    if (b.level > 0) {
      flush();
      trail = trail.filter((t) => t.level < b.level);
      trail.push({ level: b.level, text: texto });
      heading = trail.map((t) => t.text).join(" > ");
      continue;
    }

    parts.push(texto);
    // Corta por tamanho para o trecho caber no contexto do modelo, mas só
    // depois de acumular o mínimo — senão uma planilha viraria um vetor por
    // linha, e cada um sozinho não responde nada.
    const atual = parts.join("\n").length;
    if (atual >= maxChars) flush();
    else if (atual >= minChars && b === blocks[blocks.length - 1]) flush();
  }
  flush();
  return chunks;
}

/**
 * Regenera os chunks de um DOCUMENTO da base de conhecimento (delete+insert).
 * Idempotente: reprocessar o mesmo arquivo não duplica.
 */
export async function reindexDocumentChunks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    documentId: string;
    spaceId: string;
    blocks: { text: string; level: number }[];
    withEmbeddings?: boolean;
    /** Usuário que disparou (proveniência). */
    embeddedBy?: string | null;
  },
): Promise<number> {
  const { documentId, spaceId, blocks, withEmbeddings, embeddedBy } = params;
  await supabase.from("chunks").delete().eq("document_id", documentId);
  const chunks = chunkExtracted(blocks);
  if (chunks.length === 0) return 0;

  let embeddings: number[][] | null = null;
  if (withEmbeddings && await hasEmbeddingKey()) {
    try {
      // Mesmo contextual retrieval dos artigos: o nome do arquivo entra no
      // vetor para trechos genéricos não colidirem entre documentos.
      const { data: docRow } = await supabase
        .from("knowledge_documents")
        .select("original_name")
        .eq("id", documentId)
        .maybeSingle();
      const contexto = docRow?.original_name ? `Documento: ${docRow.original_name}` : "";
      const ctxIa = await documentContext(
        supabase,
        "knowledge_documents",
        documentId,
        chunks.map((c) => c.content).join("\n\n"),
      );
      const { embeddings: e } = await embedMany({
        model: await embeddingModel(),
        values: chunks.map((c) => textoParaEmbedding(contexto, c.heading_path, c.content, ctxIa)),
        // Dimensão na CHAMADA (ver `embeddingCallOptions`): a coluna
        // `chunks.embedding` é vector(1536) e recusa outro tamanho.
        providerOptions: await embeddingCallOptions(),
        abortSignal: aiTimeout("embedding"),
      });
      embeddings = e;
    } catch {
      embeddings = null; // sem vetores a busca cai no léxico
    }
  }

  const prov = await proveniencia(embeddings, embeddedBy);
  await supabase.from("chunks").insert(
    chunks.map((c, i) => ({
      // article_id/node_id ficam nulos: a origem é o documento (o CHECK
      // `chunks_uma_origem` garante que só uma esteja preenchida).
      document_id: documentId,
      space_id: spaceId,
      heading_path: c.heading_path || null,
      content: c.content,
      token_count: Math.ceil(c.content.length / 4),
      embedding: embeddings ? JSON.stringify(embeddings[i]) : null,
      ...prov,
    })),
  );
  return chunks.length;
}
