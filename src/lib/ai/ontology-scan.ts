import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";
import { promptField } from "@/lib/ai/prompts";

/**
 * Extração de TERMOS DE DOMÍNIO de um lote de texto dos artigos — o "cérebro"
 * da varredura de ontologia. Usa a MESMA IA configurada no **Chat** (Sistema →
 * IA), não um provedor fixo. Schema pequeno de propósito.
 */
const schema = z.object({
  terms: z.array(
    z.object({
      term: z.string(),
      kind: z.enum(["conceito", "entidade", "acao", "sigla", "outro"]),
      description: z.string(),
      aliases: z.array(z.string()),
    }),
  ),
});

export type TermoExtraido = {
  term: string;
  kind: "conceito" | "entidade" | "acao" | "sigla" | "outro";
  description: string | null;
  aliases: string[];
};

/** Extrai termos+sinônimos de um lote de texto. `[]` se não há IA de Chat. */
export async function extrairTermos(texto: string): Promise<TermoExtraido[]> {
  if (!texto.trim() || !(await hasAiKey("chat"))) return [];
  const model = await languageModel("chat");
  const prompt = await promptField("ontologia", "prompt");
  const { object } = await generateObject({
    model,
    schema,
    prompt: prompt + "\n\nDOCUMENTAÇÃO:\n" + texto,
    abortSignal: aiTimeout("ontology_scan"),
  });
  return object.terms
    .map((t) => ({
      term: t.term.trim(),
      kind: t.kind,
      description: t.description.trim() || null,
      aliases: [...new Set(t.aliases.map((a) => a.trim()).filter(Boolean))],
    }))
    .filter((t) => t.term.length >= 2);
}
