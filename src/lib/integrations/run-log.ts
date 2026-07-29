import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ToolParam } from "./tools";
import { previewSaida, sanitizarBody, sanitizarUrl } from "./run-log-sanitize";

/**
 * Log de EXECUÇÃO de ferramenta (ver migration ai_tool_runs). Grava o que entrou,
 * a requisição montada, o que saiu, tempo e erro — como o n8n mostra por nó.
 * A sanitização (redigir segredos, truncar saída) vive em run-log-sanitize.
 */

export type ToolRunLog = {
  baseCode: string;
  conversationId?: string | null;
  toolKey: string;
  agentKey?: string | null;
  stepIndex: number;
  /** Args do modelo (não contêm segredos — só `origem='modelo'`). */
  input: unknown;
  /** Requisição CRUA (com segredos); é sanitizada aqui antes de gravar. */
  request?: { method: string; url: string; body?: string } | null;
  /** Params da tool (para saber o que redigir). */
  params: ToolParam[];
  status?: number | null;
  ok: boolean;
  /** Dados de saída (serão truncados numa amostra). */
  output: unknown;
  files: number;
  cached: boolean;
  durationMs: number;
  error?: string | null;
};

/** Grava uma execução. À prova de falhas: um erro de log NUNCA derruba o chat. */
export async function logToolRun(row: ToolRunLog): Promise<void> {
  try {
    const req = row.request
      ? {
          method: row.request.method,
          url: sanitizarUrl(row.request.url, row.params),
          body: sanitizarBody(row.request.body, row.params) ?? null,
        }
      : null;
    const db = createAdminClient();
    await db.from("ai_tool_runs").insert({
      base_code: row.baseCode,
      conversation_id: row.conversationId ?? null,
      tool_key: row.toolKey,
      agent_key: row.agentKey ?? null,
      step_index: row.stepIndex,
      input: (row.input ?? null) as never,
      request: (req ?? null) as never,
      status: row.status ?? null,
      ok: row.ok,
      output: previewSaida(row.output) as never,
      files: row.files,
      cached: row.cached,
      duration_ms: row.durationMs,
      error: row.error ?? null,
    });
  } catch (e) {
    console.error("[ai_tool_runs] falha ao registrar execução:", e instanceof Error ? e.message : e);
  }
}

/** Retenção: apaga execuções mais antigas que `dias` (padrão 30). Rode no worker. */
export async function cleanupToolRuns(dias = 30): Promise<number> {
  const limite = new Date(Date.now() - dias * 86400_000).toISOString();
  const db = createAdminClient();
  const { data, error } = await db.from("ai_tool_runs").delete().lt("created_at", limite).select("id");
  if (error) {
    console.error("[ai_tool_runs] falha na limpeza:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}
