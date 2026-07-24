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
 *
 * Voltou para 0,85 (jul/2026): o afrouxamento para 0,7 deixou a IA OMITIR
 * parágrafos/títulos na importação (revisão do usuário pegou conteúdo faltando).
 * Preservar o conteúdo vence a folga de reformatação — quando a IA encolhe
 * demais, cai para "parágrafos fiéis", que não perdem nada. Um resumo real cai
 * bem abaixo de 0,85, então a rede continua deixando passar reformatação honesta.
 */
export const MINIMO_PALAVRAS = 0.85;

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
 * Parágrafos do ORIGINAL que sumiram da saída — a IA "esqueceu" um trecho
 * inteiro. É a revisão de completude por parágrafo: a rede de contenção acima
 * é global (85% das palavras), então um único parágrafo solto (10% do texto)
 * passa despercebido. Aqui cada parágrafo é conferido isolado — se quase
 * nenhuma das suas palavras aparece no resultado, ele foi omitido e volta ao
 * artigo (como a rede das imagens em [[reinsertImages]]). Só pega OMISSÃO, não
 * reformatação: parágrafo virado em tabela/passos ainda tem suas palavras na
 * saída, então não é sinalizado.
 */
export function paragrafosAusentes(original: string, resultado: string): string[] {
  const tokenizar = (t: string) =>
    t
      .replace(/⟦IMG:\d+⟧/g, " ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  const naSaida = new Set(tokenizar(resultado));
  return original
    .split(/\n{2,}/)
    .map((p) => p.replace(/⟦IMG:\d+⟧/g, "").trim())
    .filter((p) => {
      const toks = tokenizar(p);
      if (toks.length < 6) return false; // ignora linhas curtas (títulos soltos, "#", legendas)
      const presentes = toks.filter((w) => naSaida.has(w)).length;
      return presentes / toks.length < 0.35; // <35% das palavras na saída → sumiu
    });
}

/**
 * Piso de contenção: abaixo disto, a IA reescreveu — recusa. O prompt permite
 * descartar ruído de extração (número de página, cabeçalho repetido), então o
 * piso não é 1.0.
 *
 * Voltou para 0,85 (jul/2026): junto com MINIMO_PALAVRAS, protege contra a IA
 * que OMITE ou PARAFRASEIA conteúdo na importação. Ver [[MINIMO_PALAVRAS]].
 */
export const MINIMO_CONTENCAO = 0.85;
