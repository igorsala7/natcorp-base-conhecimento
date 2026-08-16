"use server";

import { requirePermission } from "@/lib/auth/permissions";
import { loadBaseContext, loadCredentialSecret } from "@/lib/integrations/resolve";
import { executeTool } from "@/lib/integrations/executor";

export type ResultadoTeste = {
  ok: boolean;
  status: number | string;
  ms: number;
  /** A requisição como o motor a montou, com segredos redigidos. */
  curl: string;
  /** Amostra da resposta. Grande o bastante para julgar, pequena para caber. */
  corpo: string;
  /** Quantos registros vieram, quando a resposta é uma lista. */
  registros?: number;
  erro?: string;
};

/**
 * TESTAR A FERRAMENTA SEM SAIR DA TELA.
 *
 * O cadastro tem ~40 campos e o rodapé tinha dois botões: Cancelar e Salvar.
 * Não havia como saber se o caminho estava certo, se os parâmetros casavam com
 * o que a API espera, ou se a credencial funcionava — o jeito era salvar,
 * abrir o chat, fazer uma pergunta que acionasse a tool e ir ver em "Execuções".
 * Quatro telas para responder "isso funciona?".
 *
 * Reusa o `executeTool` de produção de propósito: um testador que monta a
 * requisição por conta própria testa o testador, não a ferramenta. Mesmo
 * caminho, mesma resolução de parâmetro, mesma credencial.
 *
 * ── SÓ LEITURA ──────────────────────────────────────────────────────────────
 * Um botão de teste que dispara POST num ERP de produção cria requisição de
 * férias de verdade a cada clique. Aqui só GET passa — e o motivo é dito ao
 * usuário, não engolido, porque "não testei" e "não posso testar" são coisas
 * diferentes para quem está depurando.
 */
export async function testarTool(
  baseCode: string,
  toolKey: string,
  args: Record<string, string>,
): Promise<ResultadoTeste> {
  await requirePermission("integrations.manage");

  const ctx = await loadBaseContext(baseCode.toLowerCase());
  const bt = ctx?.tools.find((t) => t.tool.key === toolKey);
  if (!bt?.baseUrl) {
    return {
      ok: false,
      status: "—",
      ms: 0,
      curl: "",
      corpo: "",
      erro: `A ferramenta "${toolKey}" não está ativa na base ${baseCode}. Salve o cadastro antes de testar.`,
    };
  }

  const metodo = String(bt.tool.method ?? "GET").toUpperCase();
  if (metodo !== "GET") {
    return {
      ok: false,
      status: "—",
      ms: 0,
      curl: "",
      corpo: "",
      erro: `Só ferramentas GET são testadas aqui. Esta é ${metodo}, e um teste que escreve num ERP de produção cria registro de verdade a cada clique.`,
    };
  }

  const t0 = Date.now();
  try {
    const cred = bt.credentialId ? await loadCredentialSecret(bt.credentialId) : null;
    const r = await executeTool({
      tool: bt.tool,
      baseUrl: bt.baseUrl,
      credential: cred,
      modelArgs: args,
      identity: {} as never,
      timeoutMs: 20_000,
    });
    const d = r.data as { items?: unknown[] } | string | undefined;
    const registros = Array.isArray((d as { items?: unknown[] })?.items)
      ? (d as { items: unknown[] }).items.length
      : undefined;
    return {
      ok: r.ok,
      status: r.status,
      ms: Date.now() - t0,
      // `curlDeChamada` já redige token e chave — é log, não reprodução.
      curl: r.request?.curl ?? r.request?.urlSafe ?? "",
      corpo: (typeof d === "string" ? d : JSON.stringify(d, null, 2)).slice(0, 4000),
      registros,
    };
  } catch (e) {
    return {
      ok: false,
      status: "exceção",
      ms: Date.now() - t0,
      curl: "",
      corpo: "",
      erro: (e as Error).message,
    };
  }
}
