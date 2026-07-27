import "server-only";
import { generateText } from "ai";
import { languageModel, aiTimeout, ehTimeout } from "@/lib/ai/config";
import type { BlockDoc } from "@/lib/blocks/schema";
import { sanitizeDoc } from "./rich-blocks";

/**
 * Núcleo COMPARTILHADO de geração de blocos ricos — o MESMO mecanismo para a
 * importação (Fase B, `generateArticle`) e para o "Melhorar layout" do editor
 * (`improveLayout`). Saída em JSON LIVRE, coercida por `sanitizeDoc`: não passa
 * pela grade rígida da saída estruturada (que tem limite de 16 uniões na
 * Anthropic) e destrava todo o catálogo do editor — aninhamento, marcas inline,
 * tabs, mermaid, mídia. Cada caller aplica sua própria política de falha
 * (importação degrada para parágrafos fiéis; o editor recusa e não altera nada).
 */

type Model = Awaited<ReturnType<typeof languageModel>>;

/** Extrai o objeto JSON de uma resposta com cerca ```json ou prosa em volta. */
export function parseLoose(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const cru = (fence ? fence[1]! : text).trim();
  const i = cru.indexOf("{");
  const j = cru.lastIndexOf("}");
  const alvo = i >= 0 && j > i ? cru.slice(i, j + 1) : cru;
  return JSON.parse(alvo);
}

/**
 * Reformata UM segmento de texto em blocos ricos. Duas tentativas (a 2ª reforça
 * "só JSON"). Devolve `null` se esgotar as tentativas; RE-LANÇA o timeout para o
 * caller decidir (degradar vs. recusar). `fallbackText` alimenta o `sanitizeDoc`
 * quando o JSON vem vazio.
 */
export async function gerarSegmentoRico(
  model: Model,
  cabecalho: string,
  segmento: string,
  opts?: { temperature?: number },
): Promise<BlockDoc | null> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const reforco =
        tentativa > 0
          ? "\n\nATENÇÃO: devolva SOMENTE o JSON { \"blocks\": [...] }, sem cerca nem comentários."
          : "";
      const { text } = await generateText({
        model,
        prompt: cabecalho + reforco + "\n\nTEXTO:\n" + segmento,
        ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
        abortSignal: aiTimeout("import_layout"),
      });
      return sanitizeDoc(parseLoose(text), segmento);
    } catch (e) {
      if (ehTimeout(e)) throw e; // o caller trata (degradar ou recusar)
      if (tentativa === 1) return null; // esgotou — o caller decide o fallback
    }
  }
  return null;
}
