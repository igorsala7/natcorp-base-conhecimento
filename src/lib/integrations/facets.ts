/**
 * FACETAS de uma pergunta — as intenções distintas dentro de uma mensagem só.
 *
 * Motivo (caso real, 05/08/2026): "Quantos colaboradores por centro de custo… quero
 * os dados deles, salários, avaliações, últimos 5 cargos, férias desde 2000 e o valor
 * de horas normais de março/2025" — 7 intenções em 333 caracteres. Embeddadas como UM
 * texto só, cada intenção fica borrada: `bi_avaliacoes` cai de 0.769 (1º lugar quando
 * a faceta é embeddada sozinha) para 0.625 (28º na pergunta inteira), abaixo do piso
 * do top-K. O modelo recebeu 12 ferramentas, nenhuma de avaliações/cargos/férias/folha,
 * e respondeu — corretamente, dado o que tinha — que a ferramenta não existia.
 *
 * A quebra é DETERMINÍSTICA (sem ida ao modelo): pontuação forte primeiro, depois
 * enumeração por vírgula quando a lista tem 3+ itens — que é justamente o formato
 * "dados, salários, avaliações, últimos 5 cargos, férias e horas normais".
 *
 * A pergunta INTEIRA é sempre a primeira faceta: o que a seleção acha hoje continua
 * sendo achado, e as facetas só ACRESCENTAM cobertura. Pergunta simples devolve uma
 * faceta só — nenhum custo novo.
 */

/** Teto de facetas fragmentadas (fora a pergunta inteira). Cada uma custa 1 embedding. */
export const MAX_FACETAS = 8;

/** Conectivos e verbos de pedido que sozinhos não são intenção nenhuma. */
const VAZIAS =
  /^(e|ou|também|tambem|ainda|quero|queria|gostaria|preciso|me\s+d[êe]|mostre|liste|traga|informe|qual|quais|quanto|quantos|deles|delas|dele|dela|isso|também\s+quero)$/i;

/** Fragmento com sinal? Precisa de conteúdo além de conectivo/pontuação. */
function util(frag: string): boolean {
  const t = frag.trim().replace(/^[\s,;.:•\-–—]+|[\s,;.:•\-–—]+$/g, "");
  if (t.length < 3) return false;
  if (VAZIAS.test(t)) return false;
  // Só números/pontuação (ex.: "2000", "(salário)") não é intenção.
  return /[a-zà-ú]{3,}/i.test(t);
}

/** Normaliza um fragmento para virar consulta de embedding. */
function limpar(frag: string): string {
  return frag
    .trim()
    .replace(/^[\s,;.:•\-–—]+|[\s,;.:•\-–—?!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Divide a pergunta em facetas. A posição 0 é SEMPRE a pergunta inteira (normalizada);
 * as demais são os fragmentos, sem repetição e limitadas a `MAX_FACETAS`.
 *
 * Pergunta simples → `[pergunta]`, e o chamador segue no caminho de sempre.
 */
export function dividirFacetas(pergunta: string): string[] {
  const inteira = limpar(String(pergunta ?? ""));
  if (!inteira) return [];

  // 1) Fronteiras FORTES: fim de pergunta/frase, quebra de linha, ponto-e-vírgula,
  //    marcador de lista. Aqui a separação de assunto é inequívoca.
  const sentencas = inteira
    .split(/(?<=[?!])\s+|\n+|;|(?:^|\s)[•\-–—]\s+/g)
    .map(limpar)
    .filter(Boolean);

  const frags: string[] = [];
  for (const s of sentencas) {
    // 2) ENUMERAÇÃO: "A, B, C e D". Só quando há 2+ vírgulas — com uma vírgula só o
    //    risco de picar uma oração ao meio ("Quem são os colaboradores do CC, já que…")
    //    supera o ganho. O " e " final também separa, que é onde mora o último item.
    const virgulas = (s.match(/,/g) ?? []).length;
    if (virgulas >= 2) {
      for (const parte of s.split(/,|\s+e\s+(?=\S)/g)) if (util(parte)) frags.push(limpar(parte));
    } else if (sentencas.length > 1) {
      // Sentença única dentro de uma pergunta com várias: já é uma faceta por si.
      if (util(s)) frags.push(s);
    }
  }

  // Dedup preservando a ordem, sem repetir a pergunta inteira, e com teto.
  const vistas = new Set([inteira.toLowerCase()]);
  const out = [inteira];
  for (const f of frags) {
    const k = f.toLowerCase();
    if (vistas.has(k)) continue;
    vistas.add(k);
    out.push(f);
    if (out.length > MAX_FACETAS) break;
  }
  return out;
}
