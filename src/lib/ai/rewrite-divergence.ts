/**
 * A reescrita da consulta APAGOU o que o usuário disse?
 *
 * `interpretarConsulta` reescreve a mensagem no vocabulário da documentação
 * antes do RAG, e isso é bom para o RAG: "quanto ganho" vira "remuneração",
 * "bater ponto" vira "marcação de frequência". Só que a mesma reescrita
 * alimenta a SELEÇÃO DE FERRAMENTAS — o classificador de assunto e o embedding
 * — e aí ela pode custar caro:
 *
 *   "Quais são meus compromissos desse mês?"  →  "Minha linha do tempo"
 *
 * (natcorp, 12/08/2026). "Linha do tempo" é uma funcionalidade do RH, e o
 * classificador escolheu DADOS DO COLABORADOR/DADOS HISTÓRICOS. A ferramenta de
 * agenda do Microsoft 365 — cadastrada, habilitada e com a conta conectada —
 * nunca chegou ao modelo, que respondeu "não tenho acesso ao seu calendário".
 *
 * O sinal é grosseiro de propósito: NENHUMA palavra de conteúdo em comum. Uma
 * reescrita que troca uma palavra ou outra continua sendo a mesma pergunta e
 * segue valendo sozinha; a que não deixa nenhum vestígio virou outra pergunta,
 * e aí a original precisa continuar no jogo — custa um embedding a mais só
 * neste caso, e não em todo turno.
 */

/** Palavras curtas e de ligação não distinguem assunto nenhum. */
const VAZIAS = new Set([
  "para", "pelo", "pela", "como", "quais", "qual", "meus", "minha", "minhas", "meu",
  "esse", "essa", "este", "esta", "isso", "dele", "dela", "deles", "delas", "onde",
  "quando", "quero", "preciso", "pode", "podes", "poderia", "favor", "sobre", "todos",
  "todas", "mais", "menos", "muito", "estao", "estou", "tenho", "temos", "seja", "sera",
  "mesmo", "mesma", "ainda", "entao", "porque", "meses", "mes", "ano", "anos", "dia", "dias",
]);

/** Minúsculas, sem acento, só palavras de 4+ letras que carreguem assunto. */
function conteudo(texto: string): Set<string> {
  const limpo = String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const out = new Set<string>();
  for (const palavra of limpo.split(/[^a-z0-9]+/)) {
    if (palavra.length < 4 || VAZIAS.has(palavra)) continue;
    out.add(palavra);
  }
  return out;
}

/**
 * `true` quando a reescrita não guarda NENHUMA palavra de conteúdo da original
 * — o caso em que confiar só nela troca a pergunta do usuário por outra.
 *
 * Textos sem palavra de conteúdo (saudação, "e daí?") devolvem `false`: não há
 * o que preservar, e o caminho normal já lida com eles.
 */
export function reescritaDivergente(original: string, reescrita: string): boolean {
  const a = conteudo(original);
  const b = conteudo(reescrita);
  if (a.size === 0 || b.size === 0) return false;
  for (const p of a) {
    if (b.has(p)) return false;
    // Radical comum ("compromisso" × "compromissos", "ferias" × "feriado" não):
    // 6 letras iniciais iguais é conservador o bastante para não casar por acaso.
    if (p.length >= 6) {
      for (const q of b) if (q.length >= 6 && q.slice(0, 6) === p.slice(0, 6)) return false;
    }
  }
  return true;
}
