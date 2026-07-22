import { z } from "zod";
import { questionsSchema } from "@/lib/importer/question-schema";

/**
 * Resposta estruturada de UM TURNO do Estúdio IA.
 *
 * O corpo dos artigos NUNCA vem aqui (o schema explodiria): o turno decide a
 * ESTRUTURA (operações) e marca `gerarCorpo`; os corpos saem em chamadas
 * separadas por artigo com o blocksSchema comprovado do layout.
 *
 * Minas de structured output (as mesmas do layout-schema): schema plano,
 * `.nullable()` nunca `.optional()`, sem oneOf. Coberto por regression test.
 */
export const studioTurnSchema = z.object({
  /** Fala do "editor sênior" ao autor — sempre presente. */
  mensagem: z.string().max(2000),
  /** Perguntas com opções+exemplo (mesmo formato do Melhorar layout). */
  perguntas: questionsSchema.shape.perguntas.nullable(),
  /** Operações ESTRUTURAIS sobre a proposta, aplicadas em ordem. */
  operacoes: z
    .array(
      z.object({
        op: z.enum(["criar_no", "renomear", "remover", "mover"]),
        tmpId: z.string().max(40),
        paiTmpId: z.string().max(40).nullable(),
        /** Irmão APÓS o qual inserir; null = fim da lista do pai. */
        aposTmpId: z.string().max(40).nullable(),
        tipo: z.enum(["folder", "article"]).nullable(),
        titulo: z.string().max(160).nullable(),
      }),
    )
    .max(40),
  /** tmpIds de artigos cujo corpo deve ser (re)gerado após as operações. */
  gerarCorpo: z.array(z.string().max(40)).max(30),
  /** Diretivas de estilo/formato acumuladas para a geração dos corpos. */
  diretivasCorpo: z.string().max(1500).nullable(),
});

export type StudioTurn = z.infer<typeof studioTurnSchema>;
