import { normalizeDoc } from "./convert";
import { blocksToText } from "./serialize";
import type { Block } from "./schema";

/**
 * Um documento (content_json) tem CONTEÚDO real? Serve para não criar/deixar
 * artigos vazios (título sem corpo) — o artefato da estruturação da IA que
 * duplica o título num artigo sem conteúdo. Puro/client-safe.
 *
 * Vazio = sem NENHUM texto E sem NENHUM bloco não-textual. Blocos que só
 * carregam texto (parágrafo/heading/divisor) vazios não contam; qualquer outro
 * bloco (imagem, tabela, código, callout, gráfico, mídia…) conta como conteúdo.
 */
const BLOCOS_TEXTUAIS = new Set(["paragraph", "heading", "divider"]);

export function docTemConteudo(docInput: unknown): boolean {
  const { blocks } = normalizeDoc(docInput);
  // 1) Algum bloco NÃO-textual (imagem, tabela, código, callout, gráfico, mídia…)
  //    já é conteúdo — sem precisar serializar (evita custo e blocos malformados).
  const temNaoTextual = (bs: Block[]): boolean =>
    bs.some((b) => {
      if (!BLOCOS_TEXTUAIS.has(b.type)) return true;
      const kids = (b as { children?: Block[] }).children;
      return Array.isArray(kids) && temNaoTextual(kids);
    });
  if (temNaoTextual(blocks)) return true;
  // 2) Só há blocos textuais — tem algum texto?
  try {
    return blocksToText(blocks).trim().length > 0;
  } catch {
    return false;
  }
}
