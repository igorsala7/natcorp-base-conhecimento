/**
 * Catálogo de provedores e modelos oferecidos na tela de configurações.
 *
 * Puro e sem dependência de SDK: serve tanto ao servidor quanto à tela, e é
 * testável.
 */

export type ProviderKind = "anthropic" | "openai" | "google";

export const PROVIDER_LABEL: Record<ProviderKind, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  google: "Google (Gemini)",
};

/** Onde obter a chave — a tela mostra para quem está cadastrando. */
export const PROVIDER_HELP: Record<ProviderKind, string> = {
  anthropic: "console.anthropic.com → API Keys",
  openai: "platform.openai.com → API Keys",
  google: "aistudio.google.com → Get API key",
};

export type Purpose =
  | "chat"
  | "query_rewrite"
  | "embedding"
  | "import_structure"
  | "import_layout"
  | "editor_text"
  | "editor_generate"
  | "transcricao";

export const PURPOSES: { key: Purpose; label: string; desc: string }[] = [
  { key: "chat", label: "Chat", desc: "Respostas do assistente e do widget." },
  {
    key: "query_rewrite",
    label: "Reescrita de busca",
    desc: "Reescreve a pergunta do usuário para o vocabulário da documentação ANTES do RAG. Roda no caminho crítico do chat — atribua um modelo RÁPIDO e barato (ex.: Gemini Flash-Lite / Haiku). Sem atribuição própria, usa o modelo do Chat.",
  },
  {
    key: "embedding",
    label: "Embeddings",
    desc: "Vetores da busca semântica. Trocar exige reindexar tudo.",
  },
  {
    key: "import_structure",
    label: "Importação — estrutura",
    desc: "Monta a árvore de documentos e artigos a partir do arquivo. Com a leitura por IA ligada, precisa de um modelo com VISÃO (lê o PDF/páginas).",
  },
  {
    key: "import_layout",
    label: "Importação — layout",
    desc: "Gera/reformata o conteúdo em blocos ricos. Com a leitura por IA ligada, é quem escreve o conteúdo de cada artigo.",
  },
  {
    key: "editor_text",
    label: "Editor — texto",
    desc: "Reescrever, expandir, resumir e mudar o tom no editor (com revisão). Sem atribuição própria, usa o provedor do Chat.",
  },
  {
    key: "editor_generate",
    label: "Editor — gerar artigo",
    desc: "Wizard \"Artigo com IA\" (outline e corpo) e remix (FAQ, resumo). Sem atribuição própria, usa o provedor do Chat.",
  },
  {
    key: "transcricao",
    label: "Transcrição de voz",
    desc: "Transforma a fala da gravação de tela (extensão) em texto. Só provedor OpenAI (Whisper).",
  },
];

/**
 * Modelos de LINGUAGEM sugeridos (chat e todas as finalidades de texto:
 * importação, editor). Texto livre continua aceito na tela — esta lista é só a
 * sugestão do datalist. TODOS aceitam entrada de IMAGEM/PDF (necessário para a
 * leitura por IA na importação). Atual em jul/2026; conferir na doc do provedor
 * ao adicionar novos.
 */
export const CHAT_MODELS: Record<ProviderKind, string[]> = {
  anthropic: [
    // Atuais
    "claude-fable-5",
    "claude-opus-4-8",
    "claude-sonnet-5",
    "claude-haiku-4-5",
    // Ainda disponíveis (geração anterior)
    "claude-opus-4-7",
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-sonnet-4-5",
    "claude-opus-4-5",
  ],
  openai: [
    "gpt-5.6",
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-5.5",
    "gpt-5.5-pro",
    "gpt-5.4",
    "gpt-5.4-pro",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
  ],
  google: [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
  ],
};

/**
 * Modelos de embedding — SÓ os que entregam **1536 dimensões**.
 *
 * `chunks.embedding` é `vector(1536)`: um modelo de outra dimensão não cabe na
 * coluna e invalidaria todos os vetores existentes. Os que não são 1536 por
 * padrão entram com `dimensions: 1536` (ver `precisaDimensoes`).
 */
export const EMBEDDING_MODELS: Record<ProviderKind, string[]> = {
  // A Anthropic não tem API de embeddings própria.
  anthropic: [],
  // Só modelos que entregam 1536 dims (nativo ou por parâmetro). Não incluir os
  // que fixam outra dimensão (ex.: text-embedding-004, 768) — não cabem na coluna.
  openai: ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
  google: ["gemini-embedding-001"],
};

export const EMBEDDING_DIM = 1536;

/**
 * O modelo precisa que a dimensão seja pedida explicitamente?
 * `text-embedding-3-small` e `text-embedding-ada-002` já são 1536 NATIVOS e NÃO
 * aceitam o parâmetro `dimensions` (pedi-lo neles quebra a chamada). Os demais
 * são maiores e aceitam truncagem via parâmetro (`dimensions`/`outputDimensionality`).
 */
export function precisaDimensoes(model: string): boolean {
  return model !== "text-embedding-3-small" && model !== "text-embedding-ada-002";
}

/** O provedor serve para esta finalidade? */
/** Modelos de TRANSCRIÇÃO (STT). Whisper/gpt-*-transcribe são OpenAI-compatíveis. */
export const TRANSCRIBE_MODELS: Record<ProviderKind, string[]> = {
  openai: ["whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe"],
  google: [],
  anthropic: [],
};

export function suportaFinalidade(kind: ProviderKind, purpose: Purpose): boolean {
  if (purpose === "embedding") return EMBEDDING_MODELS[kind].length > 0;
  if (purpose === "transcricao") return TRANSCRIBE_MODELS[kind].length > 0; // só OpenAI
  return true;
}

/** Modelos sugeridos para o par (provedor, finalidade). */
export function modelosDe(kind: ProviderKind, purpose: Purpose): string[] {
  if (purpose === "embedding") return EMBEDDING_MODELS[kind];
  if (purpose === "transcricao") return TRANSCRIBE_MODELS[kind];
  return CHAT_MODELS[kind];
}
