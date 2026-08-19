import "server-only";
import { loadBaseContext, loadCredentialSecret } from "@/lib/integrations/resolve";
import { executeTool } from "@/lib/integrations/executor";
import { runGuard } from "@/lib/integrations/guards";
import { escopoDoPainel, aplicarEscopoParams } from "@/lib/integrations/panel-scope";
import type { Identity } from "@/lib/integrations/params";
import type { PendenciaConfirmada } from "@/lib/integrations/confirmations";
import { logToolRun } from "@/lib/integrations/run-log";

/**
 * O "sim" executa NO SERVIDOR — o modelo só redige o resultado.
 *
 * Antes, uma confirmação devolvia a bola ao modelo: o turno remontava 30+
 * schemas de ferramenta, buscava documentação e gastava uma chamada inteira só
 * para ele reemitir os mesmos 25 parâmetros que já estavam na pendência.
 * Medido numa criação de férias real (13/08/2026): **80 mil tokens para a
 * palavra "Sim"**, e quatro perguntas de confirmação seguidas, porque a cada
 * reemissão os argumentos mudavam de ordem e a pendência não era reconhecida.
 *
 * Aqui o servidor executa os argumentos GRAVADOS — os que a pessoa leu na
 * pergunta. Isso corta o turno para ~1 chamada e, de quebra, elimina a
 * reinterpretação em linguagem natural entre o "sim" e a gravação: o que ela
 * viu é o que grava.
 *
 * Os guards rodam igual (escopo, alçada). O único dispensado é o de
 * confirmação — pedir "sim" para quem acabou de dizer sim é o defeito que este
 * módulo existe para consertar.
 */

export type { ResultadoConfirmacao } from "./confirmacao-bloco";
export { blocoConfirmacaoExecutada } from "./confirmacao-bloco";
import type { ResultadoConfirmacao } from "./confirmacao-bloco";

export async function executarConfirmacao(
  baseCode: string,
  pend: PendenciaConfirmada,
  identity: Identity,
  portal: string,
  /** Conversa do turno — sem ela a execução fica órfã no log. */
  conversationId?: string | null,
): Promise<ResultadoConfirmacao | null> {
  const ctx = await loadBaseContext(baseCode);
  const bt = ctx?.tools.find((t) => t.tool.key === pend.tool);
  // Ferramenta saiu do catálogo entre o pedido e o "sim": devolve null e o turno
  // segue pelo caminho normal, com o modelo decidindo. Melhor perder a economia
  // do que executar às cegas.
  if (!bt?.baseUrl) return null;

  const escopo = escopoDoPainel(bt.tool.panel_scope, portal.toUpperCase());
  if (escopo === "nenhum") {
    return { tool: pend.tool, nome: bt.tool.name, ok: false, erro: "Sem permissão para esta ação." };
  }

  const credential = bt.credentialId ? await loadCredentialSecret(bt.credentialId) : null;

  if (bt.tool.guard && !/confirm/i.test(bt.tool.guard)) {
    const g = await runGuard(bt.tool.guard, {
      baseUrl: bt.baseUrl,
      baseCode,
      credential,
      identity,
      modelArgs: pend.args,
      panelScope: escopo,
      excludeSelf: !!bt.tool.exclude_self,
      toolKey: bt.tool.key,
      actionLabel: bt.tool.name,
    });
    if (!g.ok) return { tool: pend.tool, nome: bt.tool.name, ok: false, erro: g.erro };
  }

  /**
   * ESTE CAMINHO PRECISA DE LOG COMO NENHUM OUTRO.
   *
   * Aqui não passa `wrapTool` — quem chama `executeTool` é o servidor, direto. O
   * resultado era que justamente as ações de ESCRITA confirmadas pelo usuário
   * (enviar e-mail, criar férias) eram as únicas sem uma linha em `ai_tool_runs`.
   * Ao investigar por que o modelo dizia que um e-mail enviado não tinha sido
   * enviado, não havia o que ler: nenhuma execução registrada (19/08/2026).
   */
  const params = aplicarEscopoParams(bt.tool.params, escopo);
  const t0 = Date.now();
  try {
    const r = await executeTool({
      tool: { ...bt.tool, params },
      baseUrl: bt.baseUrl,
      credential,
      modelArgs: pend.args,
      identity,
    });
    void logToolRun({
      baseCode, conversationId, toolKey: pend.tool, stepIndex: 0,
      input: pend.args, params: params as never,
      status: r.status ?? null, ok: r.ok, output: r.ok ? r.data : null,
      files: 0, cached: false, durationMs: Date.now() - t0,
      error: r.ok ? null : `HTTP ${r.status}`,
    });
    return { tool: pend.tool, nome: bt.tool.name, ok: r.ok, data: r.ok ? r.data : undefined, erro: r.ok ? undefined : `HTTP ${r.status}` };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    void logToolRun({
      baseCode, conversationId, toolKey: pend.tool, stepIndex: 0,
      input: pend.args, params: params as never,
      status: null, ok: false, output: null, files: 0, cached: false,
      durationMs: Date.now() - t0, error: erro,
    });
    return { tool: pend.tool, nome: bt.tool.name, ok: false, erro };
  }
}
