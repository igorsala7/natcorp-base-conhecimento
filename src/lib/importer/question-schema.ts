import { z } from "zod";

/**
 * Schema das PERGUNTAS DE LAYOUT — o passe interativo do "Melhorar layout":
 * a IA lê o texto, aponta os pontos de formatação ambíguos e pergunta ao
 * autor, com um exemplo aplicado por opção. A `diretiva` da opção escolhida
 * vira instrução no prompt da reformatação.
 *
 * Mesmas três minas do layout-schema (structured output):
 * - schema PLANO (limite de gramática da Anthropic);
 * - `.nullable()` nunca `.optional()` (modo estrito da OpenAI);
 * - sem discriminatedUnion (oneOf é rejeitado). Aqui nem união há.
 * Coberto por question-schema.test.ts com o conversor real do SDK.
 */
export const questionsSchema = z.object({
  perguntas: z
    .array(
      z.object({
        /** Identificador curto e estável ("titulos", "status-tabela"). */
        id: z.string().max(64),
        pergunta: z.string().max(600),
        /** Trecho do texto a que a pergunta se refere; null no modo genérico. */
        trecho: z.string().max(1000).nullable(),
        opcoes: z
          .array(
            z.object({
              rotulo: z.string().max(160),
              /** Demonstração aplicada da opção (como ficaria); null se não couber. */
              exemplo: z.string().max(1200).nullable(),
              /**
               * PRÉVIA VISUAL: chave de um tipo de bloco do catálogo de layout
               * (`callout`, `steps`, `table`, `columns`, `cardGrid`, `bullets`,
               * `checklist`, `quote`, `code`, `accordion`, `toggle`, `hero`,
               * `panel`, `stats`, `heading`). A UI renderiza um exemplo real do
               * bloco. `null` quando a pergunta não é sobre um tipo de bloco.
               */
              preview: z.string().max(60).nullable(),
              /** Instrução IMPERATIVA de formato para o prompt final. */
              diretiva: z.string().max(600),
            }),
          )
          .min(2)
          .max(4),
      }),
    )
    .max(5),
});

export type LayoutQuestions = z.infer<typeof questionsSchema>;
export type LayoutQuestion = LayoutQuestions["perguntas"][number];

/** Junta as diretivas escolhidas na "direção do autor" do improveLayout. */
export function diretivasParaDirecao(diretivas: string[]): string | undefined {
  const limpas = diretivas.map((d) => d.trim()).filter(Boolean);
  return limpas.length ? limpas.map((d) => `- ${d}`).join("\n") : undefined;
}
