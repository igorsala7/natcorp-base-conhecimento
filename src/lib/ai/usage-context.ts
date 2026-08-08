import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { UsageMeta } from "./config";

/**
 * Contexto do turno para o registro de consumo.
 *
 * ── O problema ──────────────────────────────────────────────────────────
 * Um turno do widget dispara mais chamadas de IA do que o `streamText`
 * principal: reescrita da consulta, classificador de módulo, perfil de agente,
 * desambiguação de ferramenta e um punhado de embeddings. Medido numa janela
 * real: 33 das 56 chamadas eram dessas, 25.443 tokens — **e nenhuma delas
 * chegava à fatura**, porque os 7 módulos que as fazem chamam
 * `languageModel("query_rewrite")` sem repassar `meta`. Eles não têm como
 * repassar: não conhecem o cliente nem o turno, e são chamados de lugares que
 * também não conhecem.
 *
 * ── Por que AsyncLocalStorage e não um parâmetro ────────────────────────
 * A alternativa é passar `meta` por parâmetro do route até `embeddingModel`,
 * atravessando `rag.ts`, `tool-catalog.ts`, `module-select.ts`,
 * `report-profile.ts`, `analysis-router.ts`, `tool-clarify.ts` e
 * `query-understanding.ts` — sete assinaturas públicas mudadas, e a garantia
 * de que a oitava, escrita mês que vem, vai esquecer de repassar e sumir da
 * fatura de novo, em silêncio.
 *
 * Aqui o route abre o escopo uma vez e QUALQUER chamada feita dentro dele
 * herda cliente, origem e turno. Módulo novo entra atribuído por padrão — que
 * é a direção certa do erro para um registro de cobrança.
 *
 * `meta` explícito sempre vence o contexto: a chamada principal do chat já
 * sabe exatamente a quem pertence e não deve depender de herança.
 */
export type UsageContext = {
  /** Por qual porta entrou. Decide se é cobrável — só `widget` é. */
  origem: "widget" | "portal" | "admin" | "sistema";
  /** Turno de chat, para juntar mensagem × chamadas de IA. */
  turnId?: string;
  conversationId?: string;
  /** Identidade de rastreio (p_base, p_usuario, …). */
  meta?: UsageMeta;
};

const store = new AsyncLocalStorage<UsageContext>();

/**
 * Roda `fn` com o contexto ativo. Tudo que for aguardado lá dentro — inclusive
 * o que roda depois de um `await` — enxerga o mesmo contexto.
 */
export function comContextoDeConsumo<T>(ctx: UsageContext, fn: () => T): T {
  return store.run(ctx, fn);
}

/** Contexto do turno atual, ou `undefined` fora de um. */
export function contextoDeConsumo(): UsageContext | undefined {
  return store.getStore();
}

/**
 * Resolve o que gravar em `ai_usage`, combinando o `meta` explícito da chamada
 * com o contexto do turno.
 *
 * Regras, em ordem:
 * 1. `meta` explícito manda no que ele define (`kind` e os `p_*`).
 * 2. O que ele NÃO define vem do contexto — é assim que a reescrita de consulta
 *    de um turno do widget passa a carregar o cliente.
 * 3. `origem`/`turnId` também aceitam valor explícito. Quem chama uma
 *    finalidade genérica não sabe por qual porta o pedido entrou e deixa vir do
 *    contexto; a chamada principal do chat passa explícito porque é registrada
 *    de dentro do `TransformStream` do streaming, onde não dá para garantir que
 *    o contexto assíncrono ainda esteja de pé.
 * 4. Sem contexto e sem `meta`, é trabalho de sistema — importador, indexação,
 *    editor. Não cobrável, e é o padrão seguro.
 */
export function resolverContexto(meta?: UsageMeta): {
  kind: "system" | "user";
  origem: UsageContext["origem"];
  turnId: string | null;
  conversationId: string | null;
  p: Record<string, string | null>;
} {
  const ctx = store.getStore();
  const herdado = ctx?.meta ?? {};
  const explicito = meta ?? {};
  const campo = (k: keyof typeof herdado): string | null => {
    const v = explicito[k] ?? herdado[k];
    return typeof v === "string" && v.trim() !== "" ? v : null;
  };
  return {
    kind: explicito.kind ?? herdado.kind ?? "system",
    origem: explicito.origem ?? ctx?.origem ?? "sistema",
    turnId: explicito.turnId ?? ctx?.turnId ?? null,
    conversationId: explicito.conversationId ?? ctx?.conversationId ?? null,
    p: {
      p_base: campo("p_base"),
      p_usuario: campo("p_usuario"),
      p_portal: campo("p_portal"),
      p_empresa: campo("p_empresa"),
      p_matricula: campo("p_matricula"),
      p_perfil: campo("p_perfil"),
    },
  };
}
