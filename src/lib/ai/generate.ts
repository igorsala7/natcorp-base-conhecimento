import "server-only";
import { generateObject } from "ai";
import type { z } from "zod";
import { ehTimeout } from "./config";
import type { languageModel } from "./config";

type Model = Awaited<ReturnType<typeof languageModel>>;

const REFORCO =
  "\n\nFORMATO OBRIGATÓRIO: responda com UM ÚNICO objeto JSON válido que siga EXATAMENTE o schema, com TODOS os campos presentes. Para valores vazios ou não aplicáveis use null (ou [] em listas) — NUNCA omita uma chave nem crie campos fora do schema. Seja CONCISO nos textos. Não escreva nada fora do JSON.";

/**
 * `generateObject` com uma 2ª tentativa quando a 1ª sai fora do schema.
 *
 * Provedores não-OpenAI (Anthropic, Google) IGNORAM os limites de tamanho e
 * `required` do schema na geração, mas o Zod os cobra na hora de validar — daí
 * o "No object generated: response did not match schema" quando o modelo é
 * prolixo ou omite uma chave anulável. O reforço da 2ª tentativa lembra o
 * modelo de devolver o objeto COMPLETO e conciso.
 *
 * O timeout é RE-LANÇADO (o caller degrada/recusa); os demais erros esgotam as
 * duas tentativas e re-lançam o último — o caller mostra a mensagem de falha.
 */
export async function generateObjectResiliente<T extends z.ZodTypeAny>(args: {
  model: Model;
  schema: T;
  prompt: string;
  abortSignal?: AbortSignal;
  temperature?: number;
}): Promise<{ object: z.infer<T> }> {
  let ultimo: unknown;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const { object } = await generateObject({
        model: args.model,
        schema: args.schema,
        prompt: tentativa === 0 ? args.prompt : args.prompt + REFORCO,
        ...(args.abortSignal ? { abortSignal: args.abortSignal } : {}),
        ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
      });
      return { object: object as z.infer<T> };
    } catch (e) {
      if (ehTimeout(e)) throw e; // caller decide (degradar/recusar)
      ultimo = e;
    }
  }
  throw ultimo;
}
