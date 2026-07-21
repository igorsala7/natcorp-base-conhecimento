/**
 * Segmentação do texto para o "Melhorar layout".
 *
 * Módulo PURO de propósito (sem `server-only`, sem SDK): a versão anterior
 * mandava `plainText.slice(0, 12000)` para a IA e o excedente sumia sem aviso —
 * e `applyImprove` substitui TODOS os blocos, então o artigo perdia o final.
 * O CLAUDE.md (Parte 5.2, etapa 4) sempre pediu processar por seções.
 *
 * Mesmo motivo de `tree.ts` ter saído de `structure.ts`: com `server-only` no
 * arquivo, nada aqui poderia ser testado.
 */

/** Teto de caracteres por chamada. Abaixo disso quase todo artigo cabe em uma. */
export const LIMITE_SEGMENTO = 10_000;

/**
 * Quebra o texto em segmentos de até `limite` caracteres, sempre em fronteira
 * de parágrafo — nunca no meio de uma frase.
 *
 * Parágrafo sozinho maior que o limite vira um segmento próprio, INTEIRO: cortar
 * perderia conteúdo, e o contrato aqui é não perder. Se a IA recusar por
 * tamanho, o erro sobe para a tela em vez de virar texto sumido.
 */
export function segmentarTexto(text: string, limite = LIMITE_SEGMENTO): string[] {
  const corpo = text.trim();
  if (!corpo) return [];
  if (corpo.length <= limite) return [corpo];

  const paragrafos = corpo.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const segmentos: string[] = [];
  let atual: string[] = [];
  let tamanho = 0;

  for (const p of paragrafos) {
    const custo = p.length + (atual.length ? 2 : 0); // 2 = o "\n\n" que reinsere
    if (atual.length && tamanho + custo > limite) {
      segmentos.push(atual.join("\n\n"));
      atual = [];
      tamanho = 0;
    }
    atual.push(p);
    tamanho += atual.length === 1 ? p.length : custo;
  }
  if (atual.length) segmentos.push(atual.join("\n\n"));

  return segmentos;
}

/**
 * Palavras de verdade (ignora marcadores de imagem e pontuação solta). Base da
 * rede de segurança contra a IA que resume em vez de reformatar — o prompt
 * manda "reformatar, não reescrever", mas prompt não é garantia.
 */
export function contarPalavras(text: string): number {
  return text
    .replace(/⟦IMG:\d+⟧/g, " ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Fração mínima de palavras que a saída precisa manter em relação à entrada.
 * Reformatar preserva o texto; 0,8 dá folga para a IA fundir rótulos soltos
 * ("Atenção:" virando o título de um callout) sem deixar passar um resumo.
 */
export const MINIMO_PALAVRAS = 0.8;

/**
 * Fração das palavras do ORIGINAL preservadas (com multiplicidade) no
 * resultado. É a guarda de "reformata, não reescreve": contagem de palavras
 * pega resumo, mas não pega PARÁFRASE — texto reescrito troca as palavras
 * mantendo o tamanho. Comparação sem acento/caixa/pontuação; os marcadores
 * ⟦IMG:n⟧ saem antes (o resultado os converte em blocos de imagem).
 */
export function contencaoDePalavras(original: string, resultado: string): number {
  const tokenizar = (t: string) =>
    t
      .replace(/⟦IMG:\d+⟧/g, " ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  const orig = tokenizar(original);
  if (orig.length === 0) return 1;
  const disponiveis = new Map<string, number>();
  for (const w of tokenizar(resultado)) disponiveis.set(w, (disponiveis.get(w) ?? 0) + 1);
  let mantidas = 0;
  for (const w of orig) {
    const n = disponiveis.get(w) ?? 0;
    if (n > 0) {
      mantidas++;
      disponiveis.set(w, n - 1);
    }
  }
  return mantidas / orig.length;
}

/**
 * Piso de contenção: abaixo disto, a IA reescreveu — recusa. O prompt permite
 * descartar ruído de extração (número de página, cabeçalho repetido), então o
 * piso não é 1.0.
 */
export const MINIMO_CONTENCAO = 0.85;
