import { z } from "zod";
import { leafOptions, chartLeaf, flowLeaf } from "@/lib/importer/layout-schema";
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
        /** Blocos novos (folhas + diagrama/gráfico/fluxograma); null p/ remover/estilizar. */
        blocks: z
          .array(z.union([...leafOptions, mermaidLeaf, chartLeaf, flowLeaf]))
          .max(20)
          .nullable(),
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
  /**
   * Proposta de NOVA ESTRUTURA (pastas/artigos) para organizar melhor o
   * conteúdo — como o Estúdio faz. Criada só se o autor CONFIRMAR na tela.
   * Lista plana com `pai` referenciando o `tmp` de uma pasta da própria lista.
   */
  estrutura: z
    .array(
      z.object({
        /** id temporário desta proposta (para aninhar). */
        tmp: z.string().max(20),
        tipo: z.enum(["folder", "article"]),
        titulo: z.string().max(120),
        /** `tmp` de uma PASTA desta lista (aninha dentro dela); null = irmão do artigo atual. */
        pai: z.string().max(20).nullable(),
      }),
    )
    .max(12)
    .nullable(),
});

export type EditorChatTurn = z.infer<typeof editorChatSchema>;
export type EditorChatOp = NonNullable<EditorChatTurn["ops"]>[number];
export type EditorChatEstilo = NonNullable<EditorChatOp["estilo"]>;

/**
 * VARIANTE COMPACTA — para provedores com CONSTRAINED DECODING (Google, e o
 * limite gêmeo da Anthropic). Eles rejeitam a saída estruturada com MAIS DE 16
 * parâmetros de tipo-união ("too many parameters with union types"); o schema
 * completo tem ~25. Mesma estratégia do Estúdio (`estudio/actions.ts`): OpenAI
 * usa o schema rico; os demais, este.
 *
 * Três reduções encolhem o schema para caber nos DOIS tetos dos provedores
 * (contagem de uniões do Google E tamanho de gramática compilada da Anthropic):
 *  - `estilo` vira UMA STRING "chave:valor; …" (não um objeto com 7 campos
 *    anuláveis) — `parseEstiloDsl` reconstrói o objeto no servidor;
 *  - sem `perguntas` nem `estrutura` (a IA pergunta/sugere em prosa na "mensagem");
 *  - vocabulário de blocos ENXUTO (8 blocos-núcleo, sem contêiner/diagrama/
 *    gráfico) — a união grande de blocos é o maior custo de gramática; diagrama
 *    e gráfico continuam disponíveis nas ferramentas (melhorar layout/estúdio).
 * Assim o schema fica MENOR que o `blocksSchemaCompacto` (comprovado na Anthropic).
 * A saída é normalizada para `EditorChatTurn` por `normalizarTurnoCompacto`,
 * então o consumidor no cliente não muda.
 */
export const editorChatSchemaCompacto = z.object({
  mensagem: z.string().max(2000),
  ops: z
    .array(
      z.object({
        op: z.enum(["substituir", "inserir_apos", "inserir_topo", "remover", "estilizar"]),
        blockId: z.string().max(40).nullable(),
        /** Blocos-núcleo: parágrafo, título, callout, passos, lista, código, tabela, citação. */
        blocks: z
          .array(
            z.union([
              leafOptions[0], leafOptions[1], leafOptions[2], leafOptions[3],
              leafOptions[4], leafOptions[5], leafOptions[6], leafOptions[9],
            ]),
          )
          .max(20)
          .nullable(),
        /** Estilo como TEXTO "bg:purple; largura:metade; posicao:centro". null = não estilizar. */
        estilo: z.string().max(240).nullable(),
      }),
    )
    .max(15)
    .nullable(),
  ferramenta: z.enum(["melhorar_layout", "melhorar_texto"]).nullable(),
});

export type EditorChatTurnCompacto = z.infer<typeof editorChatSchemaCompacto>;

// Valores válidos por chave do estilo (espelham `estiloField`). O que não casar é
// descartado; `icone` é texto livre (validado depois contra o catálogo de ícones).
const ESTILO_VALORES: Record<string, readonly string[]> = {
  bg: ["purple", "pink", "blue", "gray", "dark", "nenhum"],
  largura: ["cheia", "metade", "terco", "dois-tercos", "tres-quartos", "auto"],
  posicao: ["esquerda", "centro", "direita", "nenhuma"],
  alinhamento: ["esquerda", "centro", "direita", "nenhum"],
  margemVertical: ["nenhuma", "pequena", "media", "grande"],
  tamanhoFonte: ["xs", "sm", "base", "lg", "xl", "2xl", "normal"],
};
// Sinônimos aceitos para as chaves (a IA às vezes abrevia).
const ESTILO_ALIAS: Record<string, string> = {
  fundo: "bg", background: "bg", cor: "bg",
  width: "largura", largura: "largura",
  posicao: "posicao", posição: "posicao", position: "posicao",
  alinhamento: "alinhamento", align: "alinhamento",
  margem: "margemVertical", margemvertical: "margemVertical", marginy: "margemVertical",
  fonte: "tamanhoFonte", tamanhofonte: "tamanhoFonte", fontsize: "tamanhoFonte",
  icone: "icone", ícone: "icone", icon: "icone",
};

/** "bg:purple; largura:metade; icone:alert" → objeto de estilo (ou null se vazio). */
export function parseEstiloDsl(dsl: string | null): EditorChatEstilo | null {
  if (!dsl || !dsl.trim()) return null;
  const out: EditorChatEstilo = {
    bg: null, largura: null, posicao: null, alinhamento: null,
    margemVertical: null, tamanhoFonte: null, icone: null,
  };
  let algum = false;
  for (const par of dsl.split(/[;\n]+/)) {
    const m = par.split(/[:=]/);
    if (m.length < 2) continue;
    const chaveBruta = (m[0] ?? "").trim().toLowerCase();
    const valor = m.slice(1).join(":").trim();
    if (!chaveBruta || !valor) continue;
    const chave = ESTILO_ALIAS[chaveBruta] ?? chaveBruta;
    if (chave === "icone") {
      out.icone = valor.slice(0, 40);
      algum = true;
    } else if (chave in ESTILO_VALORES) {
      const v = valor.toLowerCase();
      if (ESTILO_VALORES[chave]!.includes(v)) {
        (out as Record<string, string | null>)[chave] = v;
        algum = true;
      }
    }
  }
  return algum ? out : null;
}

/** Converte a saída compacta na forma canônica `EditorChatTurn` (consumidor não muda). */
export function normalizarTurnoCompacto(o: EditorChatTurnCompacto): EditorChatTurn {
  return {
    mensagem: o.mensagem,
    ops:
      o.ops?.map((op) => ({
        op: op.op,
        blockId: op.blockId,
        blocks: (op.blocks ?? null) as EditorChatOp["blocks"],
        estilo: parseEstiloDsl(op.estilo),
      })) ?? null,
    ferramenta: o.ferramenta,
    perguntas: null,
    estrutura: null,
  };
}
