import { ICONS, ICON_KEYWORDS } from "./icons";

/**
 * Sugestão de ÍCONE para um diretório pelo CONTEXTO (título da pasta + títulos
 * dos itens dentro dela), sem IA. Serve de fallback quando não há IA configurada
 * ou quando a IA não resolveu um diretório. Pura e testável.
 *
 * O casamento é por palavra inteira contra o dicionário `ICON_KEYWORDS` (o
 * "significado" em português de cada ícone). O título do diretório pesa mais que
 * os títulos dos filhos.
 */

/** Minúsculas, sem acento. */
function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Palavras com 3+ letras/dígitos de um texto. */
function palavras(s: string): string[] {
  return semAcento(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

// Índice palavra→chave, montado uma vez, SÓ para chaves que existem em ICONS
// (uma chave fora de ICONS renderiza como pasta genérica — não serve).
const INDICE: { key: string; palavra: string }[] = (() => {
  const out: { key: string; palavra: string }[] = [];
  for (const [key, kws] of Object.entries(ICON_KEYWORDS)) {
    if (!(key in ICONS)) continue;
    for (const p of palavras(kws)) out.push({ key, palavra: p });
  }
  return out;
})();

/**
 * Chave de ícone (de `ICONS`) que melhor casa com o contexto, ou `null` se nada
 * casar de forma clara. O título do diretório vale 3; cada filho vale 1.
 */
export function iconePorContexto(titulo: string, filhos: string[] = []): string | null {
  const doTitulo = new Set(palavras(titulo));
  const dosFilhos = new Set(filhos.flatMap((f) => palavras(f)));
  if (!doTitulo.size && !dosFilhos.size) return null;

  const pontos = new Map<string, number>();
  for (const { key, palavra } of INDICE) {
    let p = 0;
    if (doTitulo.has(palavra)) p += 3;
    if (dosFilhos.has(palavra)) p += 1;
    if (p) pontos.set(key, (pontos.get(key) ?? 0) + p);
  }
  if (!pontos.size) return null;

  let melhor: string | null = null;
  let max = 0;
  for (const [key, p] of pontos) {
    if (p > max) {
      max = p;
      melhor = key;
    }
  }
  return melhor;
}
