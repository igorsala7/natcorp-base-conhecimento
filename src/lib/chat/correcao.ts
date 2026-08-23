/**
 * "O TURNO ANTERIOR ERROU" — dito pela própria pessoa, de graça.
 *
 * O rótulo humano é o material caro da calibragem: alguém precisa olhar o caso e
 * julgar. Mas existe um rótulo que a pessoa JÁ escreve sozinha, todo dia, sem
 * saber que está rotulando — quando ela corrige o agente no turno seguinte.
 *
 * Medido na sessão de 23/08: 8 das 24 mensagens do usuário eram conserto —
 * "Mas eu não pedi amostra", "Você não fez o word", "Você não entendeu...",
 * "De novo??? Eu estou falando que é só da minha equipe!". Um terço da conversa.
 *
 * ── O QUE ISTO NÃO É ───────────────────────────────────────────────────────
 * NÃO é veredito. `ai_tool_casos.veredito` é o julgamento de gente, e a migration
 * de 17/08 separou as duas naturezas de propósito: rótulo humano é "caro, raro e
 * confiável", sinal automático é "barato, abundante e ambíguo". Isto aqui é da
 * segunda espécie e fica em coluna própria — serve para ORDENAR a fila de quem
 * vai rotular, nunca para substituí-la.
 *
 * A ambiguidade é real: "Mas e se eu desligá-lo?" não corrige nada, é
 * continuação. Por isso "mas" sozinho não marca — só marca junto com um sinal de
 * discordância.
 */

/** Tira acento e caixa: "não" e "nao" são a mesma reclamação. */
const normalizar = (s: string): string =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * Discordância explícita. Não precisam de contexto: quem escreve isto está
 * dizendo que a resposta anterior não serviu.
 */
const FORTES: RegExp[] = [
  /\bvoce nao (entendeu|fez|trouxe|respondeu|leu|consegu)/,
  /\bnao (e|eh) isso\b/,
  /\bnao foi isso\b/,
  /\bnao (pedi|falei isso|disse isso|quero isso)\b/,
  /\bde novo\?/,
  /\bnovamente\b.*\b(errad|branco|vazi|mesm)/,
  /\b(esta|ta) errad[oa]\b/,
  /\bcontinua (errad|igual|sem|em branco)/,
  /\bnada a ver\b/,
  /\bnao (era|e|eh) (isso|o que)\b/,
  // Contraste + afirmação sobre si: "Mas eu SOU gestor", "Mas eu QUERO no geral".
  // A pessoa está corrigindo a premissa que o agente usou. Medido nos 1.424 turnos:
  // marca 3, os 3 são correção legítima, nenhum falso positivo.
  /\bmas eu (sou|nao sou|quero|preciso|falei|pedi)\b/,
];

/**
 * Reafirmação do pedido. Sozinhas são fracas — "eu quero X" é um pedido novo
 * normal. Só contam quando vêm com marca de contraste ("mas", "já", "de novo"),
 * que é o que separa "pedindo" de "pedindo DE NOVO".
 */
const REAFIRMA: RegExp[] = [
  /\beu (pedi|disse|falei|quis)\b/,
  /\bestou (falando|dizendo|pedindo)\b/,
  /\b(ja|ja te) (disse|falei|pedi)\b/,
];
const CONTRASTE: RegExp[] = [/^mas\b/, /\bmas eu\b/, /\bde novo\b/, /\bnovamente\b/, /\?{2,}/];

/**
 * A mensagem corrige o turno anterior?
 *
 * @param mensagem  o que a pessoa escreveu agora
 * @param houveAnterior  false no primeiro turno — não há o que corrigir
 */
export function ehCorrecao(mensagem: string, houveAnterior = true): boolean {
  if (!houveAnterior) return false;
  const q = normalizar(mensagem);
  if (!q || q.length < 4) return false;
  if (FORTES.some((r) => r.test(q))) return true;
  return REAFIRMA.some((r) => r.test(q)) && CONTRASTE.some((r) => r.test(q));
}

/** Rótulo curto do sinal, para a coluna. Null quando não há sinal. */
export function sinalDoTurnoSeguinte(mensagem: string, houveAnterior = true): string | null {
  return ehCorrecao(mensagem, houveAnterior) ? "corrigido_pelo_usuario" : null;
}
