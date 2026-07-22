import { z } from "zod";
import { leafOptions } from "@/lib/importer/layout-schema";
import { questionsSchema } from "@/lib/importer/question-schema";

/**
 * Resposta estruturada de um turno do CHAT DO EDITOR (artigo aberto).
 *
 * Sem campo "tipo": ele é derivável (ops ≠ null → editar; ferramenta ≠ null →
 * ferramenta; senão só resposta) — campo redundante cria estados inconsistentes.
 *
 * `blocks` usa SÓ as FOLHAS do layout-schema (sem hero/columns/cardGrid…):
 * a união completa aninhada um nível mais fundo estoura a gramática do
 * structured output da Anthropic (fallback declarado). Pedido de re-layout
 * roteia para `ferramenta: "melhorar_layout"`, que usa o schema completo no
 * fluxo já comprovado. Mesmas minas: plano, `.nullable()`, sem oneOf.
 */
export const editorChatSchema = z.object({
  /** Resposta do assistente ao autor — sempre presente. */
  mensagem: z.string().max(2000),
  /** Operações de edição sobre blocos de TOPO-NÍVEL do artigo. */
  ops: z
    .array(
      z.object({
        op: z.enum(["substituir", "inserir_apos", "inserir_topo", "remover"]),
        /** Id do bloco-alvo (topo-nível); null só para inserir_topo. */
        blockId: z.string().max(40).nullable(),
        /** Blocos novos (folhas); null para remover. */
        blocks: z.array(z.union(leafOptions)).max(20).nullable(),
      }),
    )
    .max(15)
    .nullable(),
  /** Roteamento para as ferramentas existentes do editor. */
  ferramenta: z.enum(["melhorar_layout", "melhorar_texto"]).nullable(),
  /** Perguntas com opções+exemplo quando faltar contexto/confirmação. */
  perguntas: questionsSchema.shape.perguntas.nullable(),
});

export type EditorChatTurn = z.infer<typeof editorChatSchema>;
export type EditorChatOp = NonNullable<EditorChatTurn["ops"]>[number];
