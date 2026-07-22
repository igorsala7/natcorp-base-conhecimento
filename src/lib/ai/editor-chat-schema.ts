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
/**
 * Estilo aplicável via op `estilizar` — o espelho IA do painel de
 * Propriedades. Sentinela de REMOÇÃO em todo campo ("nenhum"/"auto"/
 * "normal" = apagar a chave); null = não mexer. Só existe AQUI (uma
 * ocorrência na gramática) — anexar ao vocabulário de blocos triplicaria o
 * schema (mina da gramática Anthropic).
 */
const estiloField = z
  .object({
    bg: z.enum(["purple", "pink", "blue", "gray", "dark", "nenhum"]).nullable(),
    largura: z
      .enum(["cheia", "metade", "terco", "dois-tercos", "tres-quartos", "auto"])
      .nullable(),
    posicao: z.enum(["esquerda", "centro", "direita", "nenhuma"]).nullable(),
    alinhamento: z.enum(["esquerda", "centro", "direita", "nenhum"]).nullable(),
    margemVertical: z.enum(["nenhuma", "pequena", "media", "grande"]).nullable(),
    tamanhoFonte: z.enum(["xs", "sm", "base", "lg", "xl", "2xl", "normal"]).nullable(),
    icone: z.string().nullable(),
  })
  .nullable();

/** Fluxograma Mermaid — SÓ no chat (no improve as guardas não se aplicam a diagramas). */
const mermaidLeaf = z.object({ kind: z.literal("mermaid"), code: z.string() });

export const editorChatSchema = z.object({
  /** Resposta do assistente ao autor — sempre presente. */
  mensagem: z.string().max(2000),
  /** Operações de edição sobre blocos de TOPO-NÍVEL do artigo. */
  ops: z
    .array(
      z.object({
        op: z.enum(["substituir", "inserir_apos", "inserir_topo", "remover", "estilizar"]),
        /** Id do bloco-alvo (topo-nível); null só para inserir_topo. */
        blockId: z.string().max(40).nullable(),
        /** Blocos novos (folhas); null para remover/estilizar. */
        blocks: z.array(z.union([...leafOptions, mermaidLeaf])).max(20).nullable(),
        /** Aparência do bloco (só na op estilizar). */
        estilo: estiloField,
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
