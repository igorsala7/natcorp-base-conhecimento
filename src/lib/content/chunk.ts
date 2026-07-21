import "server-only";
import { embedMany } from "ai";
import {
  embeddingModel,
  embeddingCallOptions,
  hasEmbeddingKey,
  aiTimeout,
} from "@/lib/ai/config";
import type { createClient } from "@/lib/supabase/server";
import { normalizeDoc } from "@/lib/blocks/convert";
import { blocksToText, richToText } from "@/lib/blocks/serialize";

export type Chunk = { heading_path: string; content: string };

/**
 * Particiona o documento por headings: cada H1/H2/H3 inicia um chunk, cujo
 * conteúdo é o texto até o próximo heading. heading_path acumula a trilha.
 * Aceita BlockDoc v2 ou TipTap legado (normalizeDoc converte na leitura).
 */
export function chunkArticle(docInput: unknown): Chunk[] {
  const { blocks } = normalizeDoc(docInput);
  const chunks: Chunk[] = [];
  let trail: { level: number; text: string }[] = [];
  let current: { heading_path: string; parts: string[] } = {
    heading_path: "",
    parts: [],
  };

  const flush = () => {
    const content = current.parts.join("\n").replace(/\s+\n/g, "\n").trim();
    if (content) chunks.push({ heading_path: current.heading_path, content });
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
function textoParaEmbedding(contexto: string, heading: string, content: string): string {
  const partes = [contexto, heading].filter(Boolean).join(" > ");
  return partes ? `${partes}\n\n${content}` : content;
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
  },
): Promise<void> {
  const { nodeId, articleId, spaceId, doc, withEmbeddings } = params;
  await supabase.from("chunks").delete().eq("node_id", nodeId);
  const chunks = chunkArticle(doc);
  if (chunks.length === 0) return;

  let embeddings: number[][] | null = null;
  if (withEmbeddings && await hasEmbeddingKey()) {
    try {
      const contexto = await contextoDoNo(supabase, nodeId);
      const { embeddings: e } = await embedMany({
        model: await embeddingModel(),
        values: chunks.map((c) => textoParaEmbedding(contexto, c.heading_path, c.content)),
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

  await supabase.from("chunks").insert(
    chunks.map((c, i) => ({
      article_id: articleId,
      node_id: nodeId,
      space_id: spaceId,
      heading_path: c.heading_path || null,
      content: c.content,
      token_count: Math.ceil(c.content.length / 4),
      embedding: embeddings ? JSON.stringify(embeddings[i]) : null,
    })),
  );
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
  },
): Promise<number> {
  const { documentId, spaceId, blocks, withEmbeddings } = params;
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
      const { embeddings: e } = await embedMany({
        model: await embeddingModel(),
        values: chunks.map((c) => textoParaEmbedding(contexto, c.heading_path, c.content)),
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
    })),
  );
  return chunks.length;
}
