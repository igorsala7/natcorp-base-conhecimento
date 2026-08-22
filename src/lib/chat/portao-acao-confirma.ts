/**
 * CONFIRMAÇÃO SEMÂNTICA DO PORTÃO DE AÇÃO — há conteúdo pronto para embalar?
 *
 * `soFormato` (em `portao-acao.ts`) reconhece que a mensagem é só recipiente
 * ("excel", "Faz em pdf"). Isso não basta, e o painel adversarial de 22/08/2026
 * provou por que: o caso real
 *
 *   "Gostaria de gerar o PDF por aquu"   → o gabarito pede `relatorio_recibo_pagamento`
 *
 * escapava do portão SÓ por acidente de vocabulário — "gostaria" ficou fora da
 * lista de palavras vazias enquanto "queria", "quero", "poderia", "pode" e
 * "preciso" estão dentro. Verificado à mão:
 *
 *   soFormato("Gostaria de gerar o PDF por aquu") === false
 *   soFormato("Queria  gerar o PDF por aqui")     === true
 *
 * Um sinônimo, e o portão forçaria `gerar_relatorio` num turno em que o PDF
 * ainda precisa ser EMITIDO do ERP. Cinco ferramentas existem para isso
 * (recibo, informe de rendimentos, espelho de ponto, aviso de férias), três
 * casos do gabarito as esperam, e elas estão na mesa nos quatro disparos — então
 * a guarda "não forçar quando há emissor ofertado" custaria 4 dos 4 acertos.
 *
 * ── QUATRO HEURÍSTICAS ESTRUTURAIS, TODAS MEDIDAS E DESCARTADAS ─────────────
 * A diferença entre "empacotar o que está na mesa" e "emitir um documento" tem
 * de sair de algum sinal. Testei os quatro que o sistema já tem:
 *
 *   1. `dataset:registro` NO turno .............. INVERTIDO. Os 4 casos em que
 *      forçar é certo não têm dataset — é por isso que falharam, o agente não
 *      chamou nada — e o caso problemático tem.
 *   2. `widget_datasets` ANTES do turno ......... SEM SINAL. Nenhum dos 5 tinha.
 *   3. última fala do assistente terminou em "?" . 4/5 — erra "Ok, me gere um pdf
 *      disso", onde a pergunta é cortesia DEPOIS da entrega.
 *   4. `desfecho` do turno anterior ............. 4/5 — erra o outro caso, porque
 *      "Gostaria…" veio depois de um turno que terminou como `resposta` mesmo
 *      tendo perguntado em prosa. Combinar 3 e 4 por E ou por OU também dá 4/5.
 *
 * As quatro falham pelo mesmo motivo: a distinção é SEMÂNTICA. "Aqui está seu
 * histórico… quer ver outro mês?" e "Qual mês você quer? Depois eu clico para
 * gerar" têm a mesma forma e sentidos opostos.
 *
 * O precedente do projeto é claro: em `cobertura.ts` três heurísticas baratas
 * falharam na mesma pergunta ("este catálogo cobre o assunto?") e o modelo
 * barato acertou 9/10. Mesma forma de problema, mesma saída.
 *
 * ── O que isto custa ────────────────────────────────────────────────────────
 * Uma chamada do modelo de `query_rewrite` SOMENTE nos turnos em que `soFormato`
 * já disparou — 14 em 25 dias, não 1.400. E falha ABERTA: qualquer erro devolve
 * `indefinido`, e quem chama NÃO força. Portão que erra para o lado de agir é
 * pior que portão nenhum, porque tira do usuário a saída de perguntar.
 */
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, aiTimeout, hasAiKey } from "@/lib/ai/config";

export type Confirmacao = {
  /** `true` = há conteúdo entregue e o pedido é só de formato: pode forçar. */
  embalar: boolean;
  /** Não deu para decidir — quem chama mantém o modelo livre. */
  indefinido: boolean;
};

/** Teto do trecho da fala anterior: o suficiente para julgar, sem inflar a chamada. */
const MAX_ANTERIOR = 700;

/** O prompt, separado para ser lido e testado sem chamar provedor nenhum. */
export function promptDeConfirmacao(pergunta: string, ultimaDoAssistente: string): string {
  return `Assistente de RH dentro de um ERP. O usuário acabou de escrever:
"${pergunta}"

Isso é claramente um pedido de FORMATO (pdf, excel, ppt…). A dúvida é OUTRA:
já existe conteúdo pronto para ser embalado nesse formato?

Última resposta do assistente, imediatamente antes:
"""
${String(ultimaDoAssistente ?? "").slice(-MAX_ANTERIOR)}
"""

Responda embalar=true quando o assistente JÁ ENTREGOU o conteúdo (mostrou a
tabela, os valores, a análise, o relatório) e o usuário só quer o mesmo material
noutro formato.

Responda embalar=false quando ainda FALTA obter ou emitir alguma coisa — o
assistente pediu um dado que não tem (mês, matrícula, período), ofereceu buscar,
ou o documento pedido é emitido pelo sistema (holerite, informe de rendimentos,
espelho de ponto, aviso de férias) e ainda não foi trazido.

Atenção à armadilha: uma pergunta de CORTESIA no fim de uma entrega ("quer ver
outro mês?", "posso detalhar?") NÃO significa que falta conteúdo — o conteúdo
está acima dela. O que conta é se o material existe na conversa, não se a
mensagem termina com interrogação.`;
}

/**
 * Confirma se há o que embalar. FALHA ABERTA: `indefinido` em qualquer erro,
 * ausência de chave, ou falta da fala anterior.
 */
export async function confirmaEmbalar(
  pergunta: string,
  ultimaDoAssistente: string | null | undefined,
): Promise<Confirmacao> {
  const indef: Confirmacao = { embalar: false, indefinido: true };
  const anterior = String(ultimaDoAssistente ?? "").trim();
  // Sem a fala anterior não há como julgar — e é justamente o caso em que forçar
  // seria mais arriscado (primeiro turno, ou histórico perdido).
  if (!anterior || !String(pergunta ?? "").trim()) return indef;
  if (!(await hasAiKey("query_rewrite"))) return indef;
  try {
    const { object } = await generateObject({
      model: await languageModel("query_rewrite"),
      abortSignal: aiTimeout("query_rewrite"),
      schema: z.object({ embalar: z.boolean() }),
      prompt: promptDeConfirmacao(pergunta, anterior),
    });
    return { embalar: object.embalar === true, indefinido: false };
  } catch {
    return indef;
  }
}
