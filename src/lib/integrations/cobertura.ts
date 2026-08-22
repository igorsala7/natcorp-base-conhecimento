/**
 * Chamada do classificador de COBERTURA. O prompt e os tipos vivem em
 * `cobertura-prompt.ts` (puro, testável sem provedor); aqui fica só o IO.
 */
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, aiTimeout, hasAiKey } from "@/lib/ai/config";
import { promptDeCobertura, type CandidataCobertura, type Cobertura } from "./cobertura-prompt";

/**
 * Decide se o catálogo cobre o assunto. FALHA ABERTA: qualquer erro devolve
 * `indefinido`, e quem chama mantém as ferramentas. Um classificador que
 * derruba o turno quando o provedor oscila seria pior que o problema que ele
 * resolve — a resposta é o produto; isto é conferência.
 */
export async function catalogoCobre(
  pergunta: string,
  candidatas: readonly CandidataCobertura[],
): Promise<Cobertura> {
  const q = String(pergunta ?? "").trim();
  const indef: Cobertura = { cobre: true, qual: null, indefinido: true };
  // Sem candidata não há o que conferir; sem pergunta, idem. E pergunta curta
  // demais costuma ser continuação — o assunto está no turno de trás, e julgar
  // cobertura pelo fragmento reprovaria o catálogo por culpa da elipse.
  if (!q || q.length < 12 || !candidatas.length) return indef;
  if (!(await hasAiKey("query_rewrite"))) return indef;

  try {
    const { object } = await generateObject({
      model: await languageModel("query_rewrite"),
      abortSignal: aiTimeout("query_rewrite"),
      schema: z.object({ cobre_assunto: z.boolean(), qual: z.number().nullable() }),
      prompt: promptDeCobertura(q, candidatas),
    });
    const i = object.qual;
    const alvo = typeof i === "number" && i >= 1 && i <= candidatas.length ? candidatas[i - 1]!.key : null;
    return { cobre: object.cobre_assunto === true, qual: alvo, indefinido: false };
  } catch {
    return indef;
  }
}
