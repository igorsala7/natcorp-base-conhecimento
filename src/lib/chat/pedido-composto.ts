/**
 * O pedido tem MAIS DE UM ASSUNTO?
 *
 * Existe para uma decisão só: quando perguntar "sobre qual dessas você quer
 * saber?" — e, principalmente, quando NÃO perguntar.
 *
 * ── O defeito que isto conserta ─────────────────────────────────────────────
 * "Quero saber meu histórico de férias e meu histórico de pagamento de março"
 * é um pedido com DUAS origens. O classificador acertou (módulos FÉRIAS e
 * PAGAMENTO), o toolset recebeu `consultar_ferias` E `historico_financeiro`, e
 * então um gate de ESCOLHA ÚNICA perguntou qual das duas o usuário queria —
 * obrigando-o a jogar fora metade do próprio pedido.
 *
 * As candidatas ali não competiam pela MESMA resposta: eram assuntos
 * diferentes. Ambiguidade é "duas ferramentas respondem a mesma coisa"; isto
 * era só o pedido tendo duas partes. O agente já tinha as duas ferramentas —
 * bastava deixá-lo responder.
 *
 * A proteção já existia num dos gates (`!pareceComposta`) e faltava no outro.
 * Aqui ela vira uma regra só, com o sinal mais forte disponível: o número de
 * MÓDULOS que o classificador reconheceu.
 *
 * Puro (sem IO): testável isolado.
 */

export type SinaisComposto = {
  /** Módulos/assuntos que o classificador reconheceu na pergunta. */
  modulos?: string[];
  /** Casamento com ferramentas de domínios distintos (roteador de fonte). */
  compostoPorTool?: boolean;
  /** Heurística léxica sobre o texto ("e", "também", "além de"…). */
  lexico?: boolean;
};

/**
 * Dois módulos DIFERENTES é o sinal mais direto e o mais confiável: veio de um
 * classificador que leu a pergunta inteira, não de uma regex. Os outros dois
 * entram como rede — qualquer um basta.
 */
export function pedidoComposto(s: SinaisComposto): boolean {
  const modulos = new Set((s.modulos ?? []).map((m) => String(m).split("/")[0]!.trim().toUpperCase()).filter(Boolean));
  return modulos.size >= 2 || s.compostoPorTool === true || s.lexico === true;
}
