/**
 * Limpa MARCAÇÃO HTML dos valores devolvidos pelas APIs.
 *
 * Endpoints montados sobre telas APEX às vezes devolvem o valor já renderizado
 * para a interface. Caso real (`requisicoes_req_vaga`):
 *
 *   situacao: '<span aria-hidden="true" class="fa fa-check-circle colorSuccess"></span> Concluida'
 *
 * O que o modelo precisa é "Concluida". O resto é ruído que gasta token, polui o
 * contexto e ainda pode ser lido como conteúdo ("colorSuccess" vira palavra).
 *
 * PURA e sem I/O — o mesmo padrão de `module-match` e `guard-catalog`.
 *
 * Conservadora de propósito: só mexe em string CURTA que tenha marcação de tag.
 * Documento/relatório em HTML (grande) passa intacto — ali a marcação é o conteúdo,
 * não enfeite.
 */

/** Acima disto, a string é conteúdo (documento, relatório) e não rótulo de tela. */
const MAX_VALOR = 500;
/** Profundidade máxima ao descer no JSON — retorno aninhado não pode virar recursão infinita. */
const MAX_NIVEL = 8;

const TAG = /<\/?[a-z][^>]*>/gi;
const ENTIDADES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/** Tem marcação de tag? (`a < b` não conta — precisa parecer tag de verdade.) */
export function pareceHtml(s: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(s);
}

/**
 * Texto limpo de UMA string. Devolve a original quando não há tag, quando é longa
 * demais (conteúdo) ou quando a limpeza não sobra nada além de espaço.
 *
 * `maxValor` existe porque a regra "string longa é conteúdo, não mexe" vale para o
 * retorno de uma API, que pode ser um documento — e NÃO vale para uma célula de
 * tabela, que nunca é. Quem chama pelo caminho de célula passa um teto solto.
 */
export function limparValorHtml(valor: string, maxValor = MAX_VALOR): string {
  if (valor.length > maxValor || !pareceHtml(valor)) return valor;
  let texto = valor.replace(TAG, " ");
  for (const [ent, ch] of Object.entries(ENTIDADES)) texto = texto.split(ent).join(ch);
  texto = texto.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  texto = texto.replace(/\s+/g, " ").trim();
  // Só ícone, sem texto: devolve vazio (honesto) em vez do embrulho — mas se a
  // limpeza comeu tudo E a original tinha texto visível, algo saiu errado: mantém.
  return texto;
}

/**
 * Percorre o resultado da API e limpa a marcação dos valores de texto. Preserva a
 * estrutura (objetos, arrays, tipos) — só troca as strings afetadas.
 */
export function limparMarcacaoHtml<T>(dados: T, nivel = 0): T {
  if (nivel > MAX_NIVEL) return dados;
  if (typeof dados === "string") return limparValorHtml(dados) as unknown as T;
  if (Array.isArray(dados)) return dados.map((d) => limparMarcacaoHtml(d, nivel + 1)) as unknown as T;
  if (dados && typeof dados === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dados as Record<string, unknown>)) out[k] = limparMarcacaoHtml(v, nivel + 1);
    return out as unknown as T;
  }
  return dados;
}
