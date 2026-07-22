import "server-only";
import { generateObject } from "ai";
import { languageModel, hasAiKey, aiTimeout, ehTimeout } from "@/lib/ai/config";
import { LAYOUT_INSTRUCTIONS, CABECALHO_PREFERENCIAS } from "./prompts";
import type { BlockDoc } from "@/lib/blocks/schema";
import { blocksToText } from "@/lib/blocks/serialize";
import { blocksToDoc } from "./blocks-to-doc";
import {
  segmentarTexto,
  contarPalavras,
  contencaoDePalavras,
  MINIMO_PALAVRAS,
  MINIMO_CONTENCAO,
} from "./segment";
import { blocksSchema, type LayoutBlock } from "./layout-schema";
import { reinsertImages, type ImageRef } from "./reinsert-images";

/**
 * "Melhorar layout" (Fase 4, etapa 4). Um passe de LLM que REFORMATA texto cru
 * em blocos ricos (callout, passo-a-passo, code, listas) — NÃO reescreve,
 * resume ou inventa. O usuário sempre revê o diff antes de aplicar.
 */
// O schema da saída (e suas três minas conhecidas — Anthropic/gramática,
// OpenAI/.optional e OpenAI/oneOf) mora em `layout-schema.ts`, importável
// pelo teste de regressão.

export type ImproveResult =
  | { ok: true; doc: BlockDoc }
  | { ok: false; error: string };

// A reinserção (com o içamento que garante imagem em largura total) mora em
// `reinsert-images.ts`, puro e coberto por teste.
export type { ImageRef } from "./reinsert-images";

/** Reformata o texto puro em blocos ricos, preservando as imagens. Exige AI_API_KEY. */
export async function improveLayout(
  plainText: string,
  images: ImageRef[] = [],
  /** "Direção do autor": diretivas de FORMATO escolhidas nas perguntas de
   *  layout (uma por linha). Repetida em cada segmento, de propósito. */
  direcao?: string,
): Promise<ImproveResult> {
  if (!await hasAiKey("import_layout")) {
    return { ok: false, error: "Nenhuma IA configurada para \"Melhorar layout\" — cadastre em Sistema → IA." };
  }
  if (!plainText.trim()) return { ok: false, error: "Sem conteúdo para melhorar." };

  const segmentos = segmentarTexto(plainText);
  if (!segmentos.length) return { ok: false, error: "Sem conteúdo para melhorar." };

  const model = await languageModel("import_layout");
  const propostos: LayoutBlock[] = [];

  // Sequencial de propósito: paralelizar aqui estoura o rate limit do provedor
  // no primeiro artigo grande, e a ordem dos segmentos É a ordem do artigo.
  for (const [i, segmento] of segmentos.entries()) {
    try {
      const { object } = await generateObject({
        model,
        schema: blocksSchema,
        prompt:
          LAYOUT_INSTRUCTIONS +
          (direcao ? `\n\n${CABECALHO_PREFERENCIAS}\n${direcao}` : "") +
          "\n\nTEXTO:\n" +
          segmento,
        abortSignal: aiTimeout("import_layout"),
      });
      propostos.push(...object.blocks);
    } catch (e) {
      const onde =
        segmentos.length > 1 ? ` (parte ${i + 1} de ${segmentos.length})` : "";
      if (ehTimeout(e)) {
        return {
          ok: false,
          error: `A IA não respondeu a tempo${onde}. Tente de novo ou configure um modelo mais rápido em Sistema → IA.`,
        };
      }
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `Falha da IA${onde}: ${msg}` };
    }
  }

  const doc = blocksToDoc(propostos);

  // Rede de segurança: a IA deve REFORMATAR, não resumir. Perda grande de
  // palavras é sinal de que ela reescreveu — melhor recusar do que deixar o
  // usuário aplicar por cima do artigo e descobrir depois.
  const antes = contarPalavras(plainText);
  const textoDepois = blocksToText(doc.blocks);
  const depois = contarPalavras(textoDepois);
  if (antes > 0 && depois < antes * MINIMO_PALAVRAS) {
    const perdido = Math.round((1 - depois / antes) * 100);
    return {
      ok: false,
      error: `A IA devolveu ${perdido}% menos texto que o original — parece resumo, não reformatação. Nada foi alterado.`,
    };
  }

  // Contagem não pega PARÁFRASE (mesmo tamanho, palavras trocadas). Esta
  // guarda exige que as palavras do original estejam no resultado — se a IA
  // reescreveu, recusa e o conteúdo fica exatamente como estava.
  const contencao = contencaoDePalavras(plainText, textoDepois);
  if (contencao < MINIMO_CONTENCAO) {
    const trocado = Math.round((1 - contencao) * 100);
    return {
      ok: false,
      error: `A IA alterou ~${trocado}% das palavras do original — reformatar não pode reescrever. Nada foi alterado.`,
    };
  }

  return { ok: true, doc: images.length ? reinsertImages(doc, images) : doc };
}
