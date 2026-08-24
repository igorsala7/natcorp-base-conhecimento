/**
 * ONDE ENTREGAR: no chat ou num arquivo? Perguntar ANTES de produzir.
 *
 * Não é ambiguidade de assunto — é de FORMATO, e o dono a registrou como caso
 * recorrente e de causa própria em `docs/regras-de-negocio-chat.md`, com os dois
 * desfechos opostos medidos:
 *
 *   "traga a lista completa" (96 registros)          → gerou Excel; ele queria VER
 *   "crie em colunas apenas o nome, matrícula…" (25) → gerou Excel sem perguntar
 *
 * Os dois estão no gabarito de cenários e os dois falham hoje: o agente decide
 * sozinho e erra nos dois sentidos. Gerar arquivo quando a pessoa queria ler na
 * tela custa um turno e a paciência dela; despejar 96 linhas no chat quando ela
 * queria a planilha custa a mesma coisa do outro lado.
 *
 * ── Por que um portão, e não uma linha no prompt ────────────────────────────
 * Já foi medido: `DIRETIVA_PERGUNTAR` sozinha moveu o "perguntou de menos" de
 * 10 para 8 em um modelo e nada nos outros dois. O que funcionou foi somar um
 * PORTÃO no servidor (`periodo.ts`) — aí os três melhoraram nos dois eixos. A
 * lição registrada lá vale aqui: onde a regra é enumerável, portão; a diretiva
 * cobre o resto. Esta regra é enumerável.
 *
 * ── Onde ele NÃO pode disparar ──────────────────────────────────────────────
 * Se a pessoa JÁ disse o formato — "gere um excel", "me mostra aqui" — perguntar
 * é o defeito oposto, e igualmente medido. Por isso o portão exige as três
 * coisas juntas: pedido de PRODUZIR uma lista, NENHUM destino declarado, e
 * volume que não caiba confortavelmente numa resposta de chat.
 */

/**
 * Normaliza antes de casar. `\b` em JavaScript é ASCII: a borda antes do `ú` de
 * "última" nunca casa, porque `ú` não é caractere de palavra. Tirando acento,
 * tudo vira ASCII e as bordas passam a valer — mesmo motivo de `periodo.ts`,
 * onde dois defeitos escaparam por isso e só os testes pegaram.
 */
function normalizar(texto: string): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Volume a partir do qual a entrega deixa de ser óbvia.
 *
 * Ancorado nos dois casos medidos: 25 registros JÁ mereceu pergunta, então o
 * teto tem de ficar abaixo disso. 20 é a margem — não é número mágico, é o
 * maior valor que ainda captura o caso de 25. Se o gabarito mostrar pergunta
 * demais, sobe; se mostrar de menos, desce.
 */
export const LINHAS_PARA_PERGUNTAR = 20;

/** Pedido de PRODUZIR uma lista/tabela a partir dos dados já em jogo. */
const RX_PRODUZIR_LISTA =
  /\b(traga|traz|tragam|liste|lista|listar|crie|criar|cria|monte|montar|monta|gere|gerar|gera|faca|fazer|extraia|extrair|organize|organizar)\b/;
/** O objeto do pedido é uma LISTA — sem isto, "crie uma justificativa" casaria. */
const RX_OBJETO_LISTA =
  /\b(lista|listagem|listar|tabela|colunas?|planilha|relacao|todos|todas|completa|completo|registros?|linhas?)\b/;
/** Destino DECLARADO como arquivo. Redundante com `RX_GERA_ARQUIVO`, e de
 *  propósito: o portão precisa ser testável sozinho, sem puxar report-tools. */
const RX_DESTINO_ARQUIVO =
  /\b(arquivo|documento|planilha|excel|xlsx|csv|pdf|word|docx?|ppt|pptx|apresentacao|slides?|anexo|baixar|download|exportar?)\b/;
/** Destino DECLARADO como a própria conversa. */
/**
 * GRÁFICO TAMBÉM É DESTINO DECLARADO.
 *
 * Quem pede "faça um gráfico da evolução salarial" já disse a forma de entrega —
 * perguntar "chat ou arquivo?" ali é o defeito que este arquivo chama de oposto.
 * Aconteceu em produção (23/08, 22:17): a pessoa pediu o gráfico e recebeu
 * "São 10149 registros. Você prefere ver aqui no chat ou receber um arquivo?",
 * sobre uma tabela carregada quinze minutos antes, de outro assunto.
 *
 * Fica separado de ARQUIVO e de CHAT porque não é nenhum dos dois: o gráfico é
 * renderizado NO chat, mas é um artefato próprio, com tipo e exportação.
 */
const RX_DESTINO_VISUAL = /\b(grafico|graficos|dashboard|painel|chart)\b/;

const RX_DESTINO_CHAT =
  /\b(aqui|no chat|na tela|em tela|me mostre|me mostra|mostra ai|na conversa|por aqui|em texto|escrit[oa])\b/;

/**
 * Falta dizer ONDE entregar? PURA — o volume vem de quem chama.
 *
 * `linhas` é o tamanho do maior conjunto em jogo no turno (a tabela da tela ou
 * o dataset já coletado). Zero significa "não há lista à vista", e aí não há
 * entrega a negociar.
 */
export function faltaDestinoDaEntrega(pergunta: string, linhas: number): boolean {
  if (!Number.isFinite(linhas) || linhas < LINHAS_PARA_PERGUNTAR) return false;
  const q = normalizar(pergunta);
  if (!q) return false;
  // Formato já declarado, dos dois lados: a pessoa decidiu, não se pergunta.
  if (RX_DESTINO_ARQUIVO.test(q) || RX_DESTINO_CHAT.test(q) || RX_DESTINO_VISUAL.test(q)) return false;
  return RX_PRODUZIR_LISTA.test(q) && RX_OBJETO_LISTA.test(q);
}

/**
 * A pergunta a fazer — com as opções na mão, que é a forma que o dono exigiu:
 * "perguntar em aberto transfere ao usuário o trabalho de saber o que existe".
 */
export function perguntaDeEntrega(linhas: number): { _perguntar: string; opcoes: string[] } {
  return {
    _perguntar:
      `São ${linhas} registros. Antes de montar: você prefere ver aqui no chat ou receber um arquivo?`,
    opcoes: ["Ver aqui no chat", "Planilha (Excel)", "PDF"],
  };
}
