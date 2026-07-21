import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { tryDecryptSecret } from "@/lib/crypto/secrets";
import {
  EMBEDDING_DIM,
  precisaDimensoes,
  type ProviderKind,
  type Purpose,
} from "@/lib/ai/catalog";

/**
 * Resolução do provedor de IA por FINALIDADE (chat, embeddings, importação).
 *
 * A configuração vive no banco (`ai_assignments` + `ai_providers`) e é
 * administrada pela tela. As env vars antigas continuam valendo como
 * **fallback**: sem nenhum registro no banco, o sistema se comporta exatamente
 * como antes desta mudança. É o que evita um big-bang no primeiro deploy.
 *
 * A leitura usa service-role porque a chave mora em `ai_provider_keys`, tabela
 * sem grant nenhum para `authenticated` — a proteção por COLUNA não funciona
 * neste banco (o Supabase reconcede privilégios de tabela e sobrepõe).
 */

export { EMBEDDING_DIM };

// ── Fallback por env (o comportamento anterior a esta mudança) ────────────
const ENV_CHAT_PROVIDER = (process.env.AI_PROVIDER || "anthropic") as ProviderKind;
const ENV_CHAT_MODEL = process.env.CHAT_MODEL || "claude-opus-4-8";
const ENV_EMBEDDING_PROVIDER = (process.env.EMBEDDING_PROVIDER || "openai") as ProviderKind;
const ENV_EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

export const AI_PROVIDER = ENV_CHAT_PROVIDER;
export const CHAT_MODEL = ENV_CHAT_MODEL;
export const EMBEDDING_PROVIDER = ENV_EMBEDDING_PROVIDER;
export const EMBEDDING_MODEL = ENV_EMBEDDING_MODEL;

export type ResolvedAi = {
  kind: ProviderKind;
  model: string;
  apiKey: string;
  baseUrl?: string;
  /** De onde veio — a tela mostra isso para não haver dúvida. */
  origem: "banco" | "env";
};

/**
 * Cache curto. Sem ele, cada token de streaming poderia disparar consulta — e
 * a configuração muda raramente. 30 s é o atraso máximo entre salvar na tela e
 * a mudança valer.
 */
const TTL_MS = 30_000;
const cache = new Map<Purpose, { at: number; valor: ResolvedAi | null }>();

/** Limpa o cache — chamar depois de salvar a configuração. */
export function invalidateAiCache(): void {
  cache.clear();
}

/**
 * Timeout por finalidade. Nenhuma chamada de IA passava `abortSignal`: um
 * provedor lento travava a Server Action até o limite da plataforma, e o
 * usuário só via a tela parada.
 *
 * Os valores refletem o trabalho de cada uma: embedding de uma pergunta é
 * quase instantâneo e está no caminho crítico de toda busca do RAG; a
 * reformatação de layout roda por segmento e pode levar dezenas de segundos.
 */
const TIMEOUT_MS: Record<Purpose | "embedding_query", number> = {
  chat: 60_000,
  embedding: 120_000,
  embedding_query: 15_000,
  import_structure: 90_000,
  import_layout: 120_000,
  editor_text: 60_000,
};

/** `abortSignal` pronto para passar às funções do AI SDK. */
export function aiTimeout(purpose: Purpose | "embedding_query"): AbortSignal {
  return AbortSignal.timeout(TIMEOUT_MS[purpose]);
}

/** Mensagem honesta quando o erro foi timeout, e não falha do provedor. */
export function ehTimeout(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e.name === "TimeoutError" ||
      e.name === "AbortError" ||
      e.message.includes("aborted"))
  );
}

function doEnv(purpose: Purpose): ResolvedAi | null {
  if (purpose === "embedding") {
    const apiKey = process.env.EMBEDDING_API_KEY;
    if (!apiKey) return null;
    return {
      kind: ENV_EMBEDDING_PROVIDER,
      model: ENV_EMBEDDING_MODEL,
      apiKey,
      origem: "env",
    };
  }
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;
  return { kind: ENV_CHAT_PROVIDER, model: ENV_CHAT_MODEL, apiKey, origem: "env" };
}

async function doBanco(purpose: Purpose): Promise<ResolvedAi | null> {
  try {
    const supabase = createAdminClient();
    const { data: atrib } = await supabase
      .from("ai_assignments")
      .select("model, provider_id")
      .eq("purpose", purpose)
      .maybeSingle();
    if (!atrib) return null;

    const { data: prov } = await supabase
      .from("ai_providers")
      .select("kind, base_url, active")
      .eq("id", atrib.provider_id)
      .maybeSingle();
    if (!prov || !prov.active) return null;

    const { data: chave } = await supabase
      .from("ai_provider_keys")
      .select("api_key_enc")
      .eq("provider_id", atrib.provider_id)
      .maybeSingle();
    const apiKey = tryDecryptSecret(chave?.api_key_enc);
    if (!apiKey) return null;

    return {
      kind: prov.kind as ProviderKind,
      model: atrib.model,
      apiKey,
      baseUrl: prov.base_url ?? undefined,
      origem: "banco",
    };
  } catch {
    // Banco indisponível não pode derrubar o chat se a env ainda serve.
    return null;
  }
}

/**
 * Configuração efetiva de uma finalidade: atribuição própria no banco →
 * atribuição de CHAT no banco → env.
 *
 * O degrau do meio existe porque finalidades de linguagem novas (ex.:
 * editor_text) nascem sem atribuição — e quem configurou um provedor na tela
 * do Sistema espera que TODAS as finalidades de texto o usem, não que uma
 * caia silenciosamente numa AI_API_KEY antiga da env (foi exatamente o bug:
 * chat no banco funcionando e o editor falhando numa chave sem créditos).
 * Embeddings ficam de fora: modelo de chat não gera vetor.
 */
export async function resolveAi(purpose: Purpose): Promise<ResolvedAi | null> {
  const agora = Date.now();
  const hit = cache.get(purpose);
  if (hit && agora - hit.at < TTL_MS) return hit.valor;

  const valor =
    (await doBanco(purpose)) ??
    (purpose !== "embedding" && purpose !== "chat" ? await doBanco("chat") : null) ??
    doEnv(purpose);
  cache.set(purpose, { at: agora, valor });
  return valor;
}

export async function hasAiKey(purpose: Purpose = "chat"): Promise<boolean> {
  return (await resolveAi(purpose)) !== null;
}

export async function hasEmbeddingKey(): Promise<boolean> {
  return (await resolveAi("embedding")) !== null;
}

function instanciar(cfg: ResolvedAi) {
  const opts = { apiKey: cfg.apiKey, ...(cfg.baseUrl ? { baseURL: cfg.baseUrl } : {}) };
  switch (cfg.kind) {
    case "openai":
      return createOpenAI(opts)(cfg.model);
    case "google":
      return createGoogleGenerativeAI(opts)(cfg.model);
    default:
      return createAnthropic(opts)(cfg.model);
  }
}

/** Modelo de linguagem de uma finalidade (chat, importação…). */
export async function languageModel(purpose: Purpose = "chat") {
  const cfg = await resolveAi(purpose);
  if (!cfg) {
    throw new Error(
      "Nenhuma IA configurada para esta finalidade. Cadastre um provedor em Sistema → IA, ou defina AI_API_KEY.",
    );
  }
  return instanciar(cfg);
}

/** Modelo de chat (streamText/generateObject/generateText). */
export async function chatModel() {
  return languageModel("chat");
}

/**
 * Modelo de embeddings.
 *
 * `dimensions: 1536` é obrigatório em tudo que não seja o
 * `text-embedding-3-small`: a coluna `chunks.embedding` é `vector(1536)`, e um
 * vetor de outro tamanho seria recusado pelo Postgres — a gravação falharia
 * artigo por artigo, sem causa óbvia no log.
 */
export async function embeddingModel() {
  const cfg = await resolveAi("embedding");
  if (!cfg) {
    throw new Error(
      "Nenhum provedor de embeddings configurado. Cadastre em Sistema → IA, ou defina EMBEDDING_API_KEY.",
    );
  }
  const opts = { apiKey: cfg.apiKey, ...(cfg.baseUrl ? { baseURL: cfg.baseUrl } : {}) };
  if (cfg.kind === "google") {
    return createGoogleGenerativeAI(opts).textEmbeddingModel(cfg.model);
  }
  return createOpenAI(opts).textEmbeddingModel(cfg.model);
}

/**
 * Opções de provedor a passar em `embed`/`embedMany` junto do modelo.
 *
 * A dimensão NÃO faz parte do modelo neste SDK — vai na chamada. E ela é
 * obrigatória em tudo que não seja `text-embedding-3-small`: a coluna
 * `chunks.embedding` é `vector(1536)`, e um vetor de outro tamanho seria
 * recusado pelo Postgres, falhando artigo por artigo sem causa óbvia no log.
 */
export async function embeddingCallOptions(): Promise<
  Record<string, Record<string, number>> | undefined
> {
  const cfg = await resolveAi("embedding");
  if (!cfg || !precisaDimensoes(cfg.model)) return undefined;
  // Cada provedor nomeia o parâmetro do seu jeito: OpenAI usa `dimensions`,
  // Google usa `outputDimensionality`.
  return cfg.kind === "google"
    ? { google: { outputDimensionality: EMBEDDING_DIM } }
    : { openai: { dimensions: EMBEDDING_DIM } };
}
