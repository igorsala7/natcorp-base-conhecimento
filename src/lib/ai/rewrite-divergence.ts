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

/**
 * A reescrita COPIOU O NOME DA TELA em vez de interpretar a pergunta?
 *
 * `reescritaDivergente` acima é grosseiro de propósito, e por isso não pode
 * mandar descartar sozinho: trocar o vocabulário inteiro é exatamente o que a
 * reescrita existe para fazer. "quanto ganho?" → "salário do colaborador" não
 * guarda nenhuma palavra e está CERTO.
 *
 * O que separa a tradução legítima da contaminação é a origem do texto novo.
 * Numa simulação de uso real (19/08/2026), quatro reescritas de treze eram o
 * TÍTULO DA TELA em que a pessoa estava:
 *
 *   "Mas eu quero no geral"            → "Linha do tempo dos funcionários"
 *   "E o Tony Oliveira?"               → "Folha de Pagamento"
 *   "Então faça pelo total da remuneração" → "Folha de Pagamento"
 *   "Ele está na minha equipe?"        → "Cadastro de Funcionário"
 *
 * A reescrita recebe o título da tela como contexto e, diante de uma frase curta
 * ou de continuação, agarra o título em vez da conversa. O estrago é grande
 * porque a consulta reescrita alimenta o ROTEADOR: em "Mas eu quero no geral" o
 * roteador travou em `linha_tempo` (0.73), o conjunto de ferramentas colapsou
 * para quatro, `listar_colaboradores_resumo` — que tinha acabado de responder o
 * turno anterior — foi cortada, e o agente disse à pessoa que estava "com acesso
 * limitado às ferramentas nesta sessão".
 *
 * Quando a reescrita não guarda NADA da pergunta mas guarda algo do TÍTULO DA
 * TELA, ela não traduziu: copiou. Aí a pergunta original é a fonte da verdade.
 */
export function reescritaCopiouATela(original: string, reescrita: string, tituloDaTela: string): boolean {
  if (!reescritaDivergente(original, reescrita)) return false;
  const tela = conteudo(tituloDaTela);
  if (tela.size === 0) return false;
  for (const p of conteudo(reescrita)) {
    if (tela.has(p)) return true;
    // Mesmo radical: "funcionários" na reescrita × "funcionário" no título.
    if (p.length >= 6) {
      for (const q of tela) if (q.length >= 6 && q.slice(0, 6) === p.slice(0, 6)) return true;
    }
  }
  return false;
}
