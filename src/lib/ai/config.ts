import "server-only";
import {
  wrapLanguageModel,
  wrapEmbeddingModel,
  type LanguageModelMiddleware,
  type EmbeddingModelMiddleware,
} from "ai";
import type { LanguageModelV3StreamPart, LanguageModelV3Usage } from "@ai-sdk/provider";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { circuitoAberto, registrarSucesso, registrarFalha, CircuitOpenError } from "./circuit-breaker";
import { createAdminClient } from "@/lib/supabase/admin";
import { tryDecryptSecret } from "@/lib/crypto/secrets";
import {
  EMBEDDING_DIM,
  precisaDimensoes,
  type ProviderKind,
  type Purpose,
} from "@/lib/ai/catalog";
import type { TrackingKey } from "@/lib/chat/tracking";
import { resolverContexto } from "./usage-context";

/**
 * Contexto do consumo: se a chamada veio do SISTEMA (importador, editor, busca…)
 * ou de um USUÁRIO (chat do widget/portal) e, nesse caso, a identidade de
 * rastreio (p_*), para o relatório de Consumo de IA filtrar por usuário.
 */
export type UsageMeta = {
  kind?: "system" | "user";
  /**
   * Porta de entrada — decide se é COBRÁVEL (só `widget`). Normalmente vem do
   * contexto do turno (`usage-context.ts`); a chamada principal do chat passa
   * explícito de propósito: ela é registrada de dentro do `TransformStream` do
   * streaming, e se o contexto assíncrono não sobrevivesse até lá o maior
   * consumo do turno sairia da fatura sem ninguém notar.
   */
  origem?: "widget" | "portal" | "admin" | "sistema";
  turnId?: string;
  conversationId?: string;
} & Partial<Record<TrackingKey, string>>;

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
// Chave = `${base}:${purpose}` (base '' = padrão global).
const cache = new Map<string, { at: number; valor: ResolvedAi | null }>();

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
const TIMEOUT_MS: Record<Purpose | "embedding_query" | "ontology_scan", number> = {
  chat: 60_000,
  chat_ferramentas: 60_000, // turno agêntico (ferramentas) — mesma folga do chat
  report_analysis: 60_000, // análise pura do relatório — mesma folga do chat
  query_rewrite: 15_000, // caminho crítico do chat — modelo rápido
  embedding: 120_000,
  embedding_query: 15_000,
  import_structure: 90_000,
  import_layout: 120_000,
  editor_text: 60_000,
  editor_generate: 90_000,
  transcricao: 180_000, // áudio pode ser longo — Whisper leva mais tempo
  ontology_scan: 120_000, // lê lotes grandes de texto por chamada (usa a IA do Chat)
};

/** `abortSignal` pronto para passar às funções do AI SDK. */
export function aiTimeout(purpose: Purpose | "embedding_query" | "ontology_scan"): AbortSignal {
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

async function doBanco(purpose: Purpose, base: string): Promise<ResolvedAi | null> {
  try {
    const supabase = createAdminClient();
    const { data: atrib } = await supabase
      .from("ai_assignments")
      .select("model, provider_id")
      .eq("purpose", purpose)
      .eq("base_code", base)
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
export async function resolveAi(purpose: Purpose, base = ""): Promise<ResolvedAi | null> {
  if (purpose === "embedding") base = ""; // vetores consistentes → embedding é sempre global
  const agora = Date.now();
  const key = base + ":" + purpose;
  const hit = cache.get(key);
  if (hit && agora - hit.at < TTL_MS) return hit.valor;

  // Override da base → padrão global (base '') → chat (base/padrão) para finalidades
  // novas sem atribuição própria → env.
  const valor =
    (base ? await doBanco(purpose, base) : null) ??
    (await doBanco(purpose, "")) ??
    (purpose !== "embedding" && purpose !== "chat"
      ? ((base ? await doBanco("chat", base) : null) ?? (await doBanco("chat", "")))
      : null) ??
    doEnv(purpose);
  cache.set(key, { at: agora, valor });
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

/**
 * Registro de consumo (tokens de envio/recebimento) por provedor e modelo.
 *
 * É AGUARDADO dentro do middleware (não fire-and-forget): um insert solto após
 * a resposta/stream terminar é descartado quando o runtime encerra a função —
 * era essa a causa de "conta menos chamadas do que o real". À prova de falhas
 * mesmo assim: um erro de gravação é registrado no log e NUNCA derruba a
 * chamada de IA. Reusa o service-role que `doBanco` já usa aqui (a tabela
 * `ai_usage` só tem policy de leitura; a escrita passa por fora do RLS).
 */
async function logUsage(row: {
  provider: ProviderKind;
  model: string;
  purpose: Purpose;
  input: number;
  output: number;
  /** Fatias DENTRO de `input` (ver `tokensDe`) — preço diferente do token novo. */
  cacheRead?: number;
  cacheWrite?: number;
  meta?: UsageMeta;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    // Identidade + porta de entrada + turno. O `meta` explícito manda no que
    // define; o resto vem do contexto do turno — é o que faz a reescrita de
    // consulta e os embeddings de um turno do widget caírem na fatura do
    // cliente certo em vez de virarem consumo órfão (ver usage-context.ts).
    const ctx = resolverContexto(row.meta);
    const { error } = await supabase.from("ai_usage").insert({
      provider: row.provider,
      model: row.model,
      purpose: row.purpose,
      input_tokens: row.input,
      output_tokens: row.output,
      total_tokens: row.input + row.output,
      cache_read_tokens: row.cacheRead ?? 0,
      cache_write_tokens: row.cacheWrite ?? 0,
      kind: ctx.kind,
      origem: ctx.origem,
      turn_id: ctx.turnId,
      conversation_id: ctx.conversationId,
      ...ctx.p,
    });
    if (error) console.error("[ai_usage] falha ao registrar consumo:", error.message);
  } catch (e) {
    // Nunca propagar: o registro é secundário à resposta da IA.
    console.error("[ai_usage] erro ao registrar consumo:", e instanceof Error ? e.message : e);
  }
}

/** No nível da spec V3, o uso vem aninhado; o total não existe pronto. */
/**
 * Quebra do consumo, com a parte de CACHE separada.
 *
 * `input` continua sendo o TOTAL de entrada (é assim que o provedor conta), e
 * `cacheRead`/`cacheWrite` são fatias DENTRO dele — nunca somar por fora, ou o
 * total dobra. A separação existe porque os três têm preço diferente: entrada
 * nova 1×, leitura de cache ~0,1×, escrita ~1,25×. Sem ela, faturar pelo total
 * superestima o custo (medido: ~45% num turno real com o cache quente).
 */
function tokensDe(usage: LanguageModelV3Usage): {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
} {
  const inp = usage.inputTokens;
  return {
    input: inp?.total ?? 0,
    output: usage.outputTokens?.total ?? 0,
    cacheRead: inp?.cacheRead ?? 0,
    cacheWrite: inp?.cacheWrite ?? 0,
  };
}

/**
 * Envolve o modelo de linguagem para registrar o consumo — num ponto único,
 * cobrindo chat, importador, editor e busca. `cfg`/`purpose` ficam presos no
 * fecho no momento do wrap (o modelo é reinstanciado a cada chamada).
 */
function comRegistro(model: ReturnType<typeof instanciar>, cfg: ResolvedAi, purpose: Purpose, meta?: UsageMeta) {
  const registrar = (usage: LanguageModelV3Usage) => {
    const { input, output, cacheRead, cacheWrite } = tokensDe(usage);
    return logUsage({ provider: cfg.kind, model: cfg.model, purpose, input, output, cacheRead, cacheWrite, meta });
  };
  const cbKey = cfg.kind + ":" + cfg.model; // disjuntor por provedor+modelo
  const middleware: LanguageModelMiddleware = {
    specificationVersion: "v3",
    wrapGenerate: async ({ doGenerate }) => {
      if (circuitoAberto(cbKey)) throw new CircuitOpenError(cfg.kind);
      try {
        const result = await doGenerate();
        registrarSucesso(cbKey);
        await registrar(result.usage); // aguardado: senão o insert some ao retornar
        return result;
      } catch (e) {
        registrarFalha(cbKey, e);
        throw e;
      }
    },
    wrapStream: async ({ doStream }) => {
      if (circuitoAberto(cbKey)) throw new CircuitOpenError(cfg.kind);
      try {
        const { stream, ...rest } = await doStream();
        const transformed = stream.pipeThrough(
          new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
            // `transform` async: o stream aguarda a gravação antes de fechar, então
            // a função não é encerrada com o insert pendente (a causa da subcontagem).
            async transform(chunk, controller) {
              if (chunk.type === "finish") {
                registrarSucesso(cbKey);
                await registrar(chunk.usage);
              } else if (chunk.type === "error") {
                registrarFalha(cbKey, (chunk as { error?: unknown }).error);
              }
              controller.enqueue(chunk);
            },
          }),
        );
        return { stream: transformed, ...rest };
      } catch (e) {
        registrarFalha(cbKey, e); // falha ao ABRIR o stream (conexão/429)
        throw e;
      }
    },
  };
  return wrapLanguageModel({ model, middleware });
}

/** Estimativa de tokens (~4 caracteres por token) pelo texto enviado — usada só
 *  quando o provedor NÃO reporta o uso, para o faturamento nunca contar zero. */
function estimarTokensEmbedding(values: unknown): number {
  if (!Array.isArray(values)) return 0;
  let chars = 0;
  for (const v of values) chars += typeof v === "string" ? v.length : String(v ?? "").length;
  return Math.ceil(chars / 4);
}

/** Middleware de registro para embeddings — só há tokens de ENTRADA (envio). */
function embMiddleware(cfg: ResolvedAi): EmbeddingModelMiddleware {
  return {
    specificationVersion: "v3",
    wrapEmbed: async ({ doEmbed, params }) => {
      const result = await doEmbed();
      // Alguns provedores (ex.: Google gemini-embedding) NÃO devolvem a contagem de
      // tokens do embedding → o registro ficava em 0 (subcontagem no faturamento).
      // Quando o provedor reporta, usa o valor real; senão, ESTIMA pelo texto enviado.
      const reportado = result.usage?.tokens;
      const input = typeof reportado === "number" && reportado > 0
        ? reportado
        : estimarTokensEmbedding(params.values);
      await logUsage({
        provider: cfg.kind,
        model: cfg.model,
        purpose: "embedding",
        input,
        output: 0,
      });
      return result;
    },
  };
}

/** Modelo de linguagem de uma finalidade (chat, importação…). `meta` atribui o
 *  consumo a um usuário (chat) em vez do sistema. */
export async function languageModel(purpose: Purpose = "chat", meta?: UsageMeta, base = "") {
  const cfg = await resolveAi(purpose, base);
  if (!cfg) {
    throw new Error(
      "Nenhuma IA configurada para esta finalidade. Cadastre um provedor em Sistema → IA, ou defina AI_API_KEY.",
    );
  }
  return comRegistro(instanciar(cfg), cfg, purpose, meta);
}

/** Modelo de chat (streamText/generateObject/generateText). `base` = p_base do
 *  cliente para usar a config PRÓPRIA da base (senão, o padrão global). */
export async function chatModel(meta?: UsageMeta, base = "") {
  return languageModel("chat", meta, base);
}

/** Resolve a config de um provider pelo KIND, usando a CHAVE já cadastrada em
 *  Sistema → IA (nenhuma chave trafega na requisição). `null` se não houver. */
async function resolveAiPorProvider(kind: ProviderKind, model: string): Promise<ResolvedAi | null> {
  try {
    const supabase = createAdminClient();
    const { data: provs } = await supabase
      .from("ai_providers")
      .select("id, base_url")
      .eq("kind", kind)
      .eq("active", true)
      .limit(1);
    const prov = provs?.[0];
    if (!prov) {
      const envCfg = doEnv("chat"); // fallback: env, se o kind bater
      return envCfg && envCfg.kind === kind ? { ...envCfg, model } : null;
    }
    const { data: chave } = await supabase
      .from("ai_provider_keys")
      .select("api_key_enc")
      .eq("provider_id", prov.id)
      .maybeSingle();
    const apiKey = tryDecryptSecret(chave?.api_key_enc);
    if (!apiKey) return null;
    return { kind, model, apiKey, baseUrl: prov.base_url ?? undefined, origem: "banco" };
  } catch {
    return null;
  }
}

/** Modelo de um provider+model ESCOLHIDO na requisição (override). Cai no padrão
 *  de `chat` quando o provider não é válido/configurado. */
export async function languageModelEscolhido(
  llm: { provider?: string | null; model?: string | null } | null | undefined,
  meta?: UsageMeta,
  base = "",
) {
  const kind = String(llm?.provider ?? "").toLowerCase();
  const model = String(llm?.model ?? "").trim();
  const kinds: readonly string[] = ["anthropic", "openai", "google"];
  if (model && kinds.includes(kind)) {
    const cfg = await resolveAiPorProvider(kind as ProviderKind, model);
    if (cfg) return comRegistro(instanciar(cfg), cfg, "chat", meta);
  }
  return languageModel("chat", meta, base); // sem override → config da base (ou padrão)
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
  const base =
    cfg.kind === "google"
      ? createGoogleGenerativeAI(opts).textEmbeddingModel(cfg.model)
      : createOpenAI(opts).textEmbeddingModel(cfg.model);
  return wrapEmbeddingModel({ model: base, middleware: embMiddleware(cfg) });
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
