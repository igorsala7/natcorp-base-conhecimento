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
  | "embedding"
  | "import_structure"
  | "import_layout"
  | "editor_text";

export const PURPOSES: { key: Purpose; label: string; desc: string }[] = [
  { key: "chat", label: "Chat", desc: "Respostas do assistente e do widget." },
  {
    key: "embedding",
    label: "Embeddings",
    desc: "Vetores da busca semântica. Trocar exige reindexar tudo.",
  },
  {
    key: "import_structure",
    label: "Importação — estrutura",
    desc: "Monta a árvore de documentos e artigos a partir do arquivo.",
  },
  {
    key: "import_layout",
    label: "Importação — layout",
    desc: "Reformata o texto em blocos ricos (Melhorar layout).",
  },
  {
    key: "editor_text",
    label: "Editor — texto",
    desc: "Reescrever, expandir, resumir e mudar o tom no editor (com revisão). Sem atribuição própria, usa o provedor do Chat.",
  },
];

/** Modelos de chat sugeridos. Texto livre continua aceito na tela. */
export const CHAT_MODELS: Record<ProviderKind, string[]> = {
  anthropic: ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"],
  openai: ["gpt-4o", "gpt-4o-mini"],
  google: ["gemini-2.0-flash", "gemini-1.5-pro"],
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
  openai: ["text-embedding-3-small", "text-embedding-3-large"],
  google: ["gemini-embedding-001"],
};

export const EMBEDDING_DIM = 1536;

/**
 * O modelo precisa que a dimensão seja pedida explicitamente?
 * `text-embedding-3-small` já é 1536 nativo; os demais são maiores e aceitam
 * truncagem via parâmetro.
 */
export function precisaDimensoes(model: string): boolean {
  return model !== "text-embedding-3-small";
}

/** O provedor serve para esta finalidade? */
export function suportaFinalidade(kind: ProviderKind, purpose: Purpose): boolean {
  if (purpose === "embedding") return EMBEDDING_MODELS[kind].length > 0;
  return true;
}

/** Modelos sugeridos para o par (provedor, finalidade). */
export function modelosDe(kind: ProviderKind, purpose: Purpose): string[] {
  return purpose === "embedding" ? EMBEDDING_MODELS[kind] : CHAT_MODELS[kind];
}
