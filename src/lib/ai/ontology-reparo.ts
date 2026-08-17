/**
 * OS CRITÉRIOS DO REPARO DA ONTOLOGIA — puros e testáveis.
 *
 * Moram aqui, e não dentro do script, porque a primeira versão deles estava
 * ERRADA e só o ensaio mostrou. Critério de apagar vocabulário precisa de teste:
 * ninguém percebe um sinônimo que sumiu, percebe a busca que parou de achar,
 * semanas depois.
 *
 * ── O erro da primeira versão, que vale registrar ───────────────────────────
 * Eu usei os dados poluídos como prova do que apagar.
 *
 *  · "X é sinônimo de Y, logo são o mesmo conceito" — mas a associação errada é
 *    justamente o defeito. Propunha fundir "Desconto PLR Folha" em "Adiantamento
 *    de PLR", que são coisas diferentes.
 *  · "parece coluna e o dicionário não confirma" — pegava toda SIGLA de domínio
 *    que por acaso é maiúscula. Propunha apagar `CID` de "C.I.D." e `CCH` de
 *    "Centro de Custo Hierárquico", que estão certos.
 *
 * Os critérios abaixo são o conserto: evidência independente da IA.
 */

/** Palavras de ligação não distinguem conceito — entram e saem sem mudar sentido. */
const LIGACAO = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "no", "na", "para", "por", "com"]);

/** Só letras e dígitos, sem acento, minúsculo. `"C.I.D."` e `"CID"` viram o mesmo. */
export function soAlfanum(v: string): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** As palavras significativas de um termo, sem ligação e sem acento. */
export function palavras(v: string): string[] {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 0 && !LIGACAO.has(p));
}

/**
 * Os dois nomes são o MESMO conceito, um sendo expansão do outro?
 *
 * O sinal é contenção de palavras: "Cadastro de Agências" ⊂ "Cadastro de
 * Agências Bancárias" é expansão; "Desconto PLR Folha" × "Adiantamento de PLR"
 * compartilham "plr" e mais nada, e são conceitos distintos.
 *
 * Contenção e não interseção: dois termos que só cruzam uma palavra em comum não
 * são o mesmo — e foi por confiar em "estão ligados" que a primeira versão
 * propôs fundir coisas diferentes.
 */
export function ehExpansaoDe(a: string, b: string): boolean {
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.length === 0 || pb.length === 0) return false;
  const [menor, maior] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  const set = new Set(maior);
  return menor.every((p) => set.has(p));
}

/**
 * Este sinônimo em forma de coluna está colado no termo ERRADO?
 *
 * Três portões, e cada um nasceu de um falso positivo do ensaio:
 *
 *  1. Precisa ser uma coluna QUE EXISTE no dicionário. `CCH` não é coluna
 *     nenhuma — é uma sigla que a IA propôs para "Centro de Custo Hierárquico",
 *     e está certa. Sigla inventada não é contaminação.
 *  2. Não pode ser o próprio termo sem pontuação. `CID` é coluna, mas também é
 *     "C.I.D." escrito de outro jeito — apagá-lo tiraria o vínculo óbvio.
 *  3. Aí sim: se o rótulo dessa coluna, no dicionário, não corresponde a este
 *     termo nem a nenhum sinônimo dele, o vínculo foi a IA que inventou.
 */
export function aliasSemLastro(input: {
  alias: string;
  termo: string;
  sinonimosDoTermo: readonly string[];
  /** Rótulos que o DICIONÁRIO dá a essa coluna. Vazio = coluna não existe. */
  rotulosDaColuna: readonly string[];
}): boolean {
  const { alias, termo, sinonimosDoTermo, rotulosDaColuna } = input;
  if (soAlfanum(alias) === soAlfanum(termo)) return false;    // 2. é o termo disfarçado

  if (rotulosDaColuna.length === 0) {
    /**
     * A coluna não existe no dicionário. Duas coisas muito diferentes cabem aqui,
     * e o UNDERSCORE as separa:
     *
     *  · `CCH`, `CID`, `FGTS` — sigla de domínio. A IA propôs, é boa, fica.
     *  · `PE_FOLGAS`, `TEMP_RESID` — identificador de banco que NÃO EXISTE. A IA
     *    inventou um nome de coluna. Isso é pior que um sinônimo ruim: é nome
     *    técnico falso dentro do vocabulário, e o chat pode repeti-lo como se
     *    fosse campo real.
     *
     * Sigla de negócio não leva underscore; identificador de banco leva.
     */
    return alias.includes("_");
  }

  const conhecidos = new Set([termo, ...sinonimosDoTermo].map(soAlfanum));
  return !rotulosDaColuna.some((r) => conhecidos.has(soAlfanum(r)));
}
