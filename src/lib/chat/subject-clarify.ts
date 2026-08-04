import "server-only";
import { z } from "zod";
import type { UsageMeta } from "@/lib/ai/config";

/**
 * Desambiguação de SUJEITO/REFERENTE por histórico (anáfora).
 *
 * Quando a mensagem NÃO nomeia quem/o quê ("qual o salário dele?", "e a matrícula?",
 * "quanto ganham?", "detalha esses") MAS a conversa vinha tratando de colaboradores/
 * itens LISTADOS — ou há um relatório na tela — confirmamos o referente antes de
 * responder (pessoas listadas × resultados do relatório × consulta geral). Se NÃO há
 * candidato algum no contexto, NÃO pergunta.
 *
 * Custo controlado: um PRÉ-FILTRO regex barato decide se vale rodar o classificador
 * LLM (modelo `query_rewrite`) — que só entra no subconjunto "parece anáfora + há
 * contexto".
 */

export type ClarifyMsg = { role: string; content: string };

/** Marcadores anafóricos: a mensagem refere algo/alguém NÃO nomeado nela. */
const RX_ANAFORA =
  /\b(ele|ela|eles|elas|dele|dela|deles|delas|nele|nela|neles|nelas|lhe|lhes)\b|\b[oa]s?\s+(primeir|segund|terceir|quart|quint|[uú]ltim)[oa]s?\b|^\s*e\s+[oa]s?\b|\b(ess[ae]s?|dess[ae]s?|ness[ae]s?|aquel[ea]s?)\b/i;

/** Pré-filtro BARATO: a mensagem "parece anafórica"? Só quem passa vai ao classificador. */
export function pareceAnaforico(question: string): boolean {
  const q = String(question ?? "").trim();
  if (q.length < 2) return false;
  return RX_ANAFORA.test(q);
}

/** Roda o classificador SÓ quando parece anáfora E há contexto para referir: relatório
 *  na tela OU um turno anterior do assistente com conteúdo substancial (possível lista). */
export function deveClassificarSujeito(question: string, messages: ClarifyMsg[], temRelatorio: boolean): boolean {
  if (!pareceAnaforico(question)) return false;
  if (temRelatorio) return true;
  const ultAssist = [...(messages ?? [])].reverse().find((m) => m.role === "assistant");
  return !!ultAssist && String(ultAssist.content ?? "").length > 160;
}

export type SujeitoDecisao = { ambiguo: boolean; candidatos: string[]; refereRelatorio: boolean };
const NAO_AMBIGUO: SujeitoDecisao = { ambiguo: false, candidatos: [], refereRelatorio: false };

/** Classifica o referente da mensagem (modelo barato `query_rewrite`). Falha/dúvida →
 *  não-ambíguo (nunca trava o fluxo à toa). */
export async function classificarSujeito(args: {
  question: string;
  historico: ClarifyMsg[];
  colunasRelatorio: string[];
  temRelatorio: boolean;
  track: UsageMeta;
}): Promise<SujeitoDecisao> {
  // Imports DINÂMICOS: `@/lib/ai/config` valida env no topo do módulo — mantê-lo fora
  // do escopo do módulo deixa as funções PURAS (e seus testes) sem essa dependência.
  const { languageModel, hasAiKey, aiTimeout } = await import("@/lib/ai/config");
  const { generateObjectResiliente } = await import("@/lib/ai/generate");
  if (!(await hasAiKey("query_rewrite"))) return NAO_AMBIGUO;
  const hist = (args.historico ?? [])
    .slice(-4)
    .map((m) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${String(m.content ?? "").slice(0, 900)}`)
    .join("\n");
  try {
    const { object } = await generateObjectResiliente({
      model: await languageModel("query_rewrite", { kind: "user", ...args.track }, args.track.p_base ?? ""),
      abortSignal: aiTimeout("query_rewrite"),
      schema: z.object({
        ambiguo: z.boolean(),
        candidatos: z.array(z.string()).max(12).nullable(),
        refere_relatorio: z.boolean(),
      }),
      prompt: `Você resolve o REFERENTE de uma mensagem de chat (RH, pt-BR). A MENSAGEM pode ter SUJEITO IMPLÍCITO (ex.: "qual o salário dele?", "e a matrícula?", "quanto ganham?", "detalha esses", "o primeiro"). Olhe o HISTÓRICO.
Decida:
- "ambiguo": true SOMENTE se a mensagem NÃO nomeia claramente a pessoa/entidade E há candidatos plausíveis no HISTÓRICO (pessoas/itens já listados) OU no relatório da tela. false se a mensagem já deixa claro quem/o quê, ou se não há candidato algum.
- "candidatos": rótulos CURTOS (nome ou matrícula) das pessoas/itens JÁ LISTADOS no histórico que a mensagem pode referir (máx. 12). Vazio se não houver lista.
- "refere_relatorio": true se a mensagem pode ser sobre os RESULTADOS do relatório da tela.
${args.colunasRelatorio.length ? `COLUNAS DO RELATÓRIO DA TELA: ${args.colunasRelatorio.join(", ")}` : "SEM relatório na tela."}
HISTÓRICO:
${hist || "(vazio)"}
MENSAGEM: ${args.question}`,
    });
    return {
      ambiguo: !!object.ambiguo,
      candidatos: (object.candidatos ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 12),
      refereRelatorio: !!object.refere_relatorio && args.temRelatorio,
    };
  } catch {
    return NAO_AMBIGUO;
  }
}

/** Monta os botões do clarify (AGRUPADO): pessoas/itens listados · relatório · geral. */
export function montarOpcoesSujeito(dec: SujeitoDecisao, temRelatorio: boolean): Array<Record<string, unknown>> {
  const opcoes: Array<Record<string, unknown>> = [];
  if (dec.candidatos.length) {
    const amostra = dec.candidatos.slice(0, 3).join(", ");
    opcoes.push({
      id: "listados",
      label: dec.candidatos.length <= 3 ? `👥 ${amostra}` : `👥 Os ${dec.candidatos.length} listados`,
      ...(dec.candidatos.length > 3 ? { sublabel: `${amostra}…` } : {}),
      scope: { referente: "listados" },
    });
  }
  if (dec.refereRelatorio && temRelatorio) {
    opcoes.push({ id: "relatorio", label: "📄 Resultados do relatório da tela", scope: { referente: "relatorio", fonte: "relatorio", direto: true } });
  }
  opcoes.push({ id: "geral", label: "🌐 Consulta geral", scope: { referente: "geral" } });
  return opcoes;
}

/** Diretriz p/ o prompt depois que o usuário confirmou o referente. */
export function diretrizReferente(referente: string | undefined): string {
  if (referente === "listados")
    return "REFERENTE CONFIRMADO: a pergunta se refere aos itens/colaboradores LISTADOS nas mensagens anteriores desta conversa — use-os como sujeito, sem pedir de novo.";
  if (referente === "geral")
    return "REFERENTE CONFIRMADO: é uma consulta GERAL — NÃO restrinja aos itens específicos citados antes.";
  return "";
}
