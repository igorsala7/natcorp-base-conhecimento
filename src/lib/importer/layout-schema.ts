import { z } from "zod";

/**
 * Schema da saída do "Melhorar layout" — em arquivo próprio (sem
 * `server-only`) para o teste de regressão conseguir importá-lo.
 *
 * ATENÇÃO — três minas conhecidas, todas já pisadas:
 *
 * 1. A saída estruturada da Anthropic tem LIMITE DE GRAMÁTICA. Manter o
 *    schema PLANO — nunca aninhar uniões dentro de arrays de contêiner
 *    (painel/colunas usam texto simples). Campos escalares opcionais
 *    (icon/ratios/divider) são baratos; blocos novos, nem tanto.
 *
 * 2. Use `.nullable()`, NUNCA `.optional()`: o modo estrito da OpenAI exige
 *    que TODA propriedade esteja em `required`, então um campo opcional faz a
 *    chamada inteira falhar com `invalid_json_schema` — só em execução.
 *
 * 3. Use `z.union`, NUNCA `z.discriminatedUnion`: no zod 4, discriminated
 *    union vira `oneOf` no JSON Schema, e o structured output da OpenAI
 *    rejeita `oneOf` ("'oneOf' is not permitted") — union simples vira
 *    `anyOf`, aceito. A validação é idêntica aqui: os `kind` são literais
 *    distintos. Coberto por `layout-schema.test.ts`.
 *
 * Ao mexer, rode o teste E uma chamada real contra o provedor configurado.
 */

/**
 * `icon` é string livre (uma enum com ~75 ícones estouraria a gramática): a
 * chave é validada contra o catálogo no conversor e descartada se não existir.
 */
const iconField = z.string().nullable();

/**
 * Mini-estilo (largura + posição) — SÓ em table/stats. O sistema completo de
 * propriedades vive na op `estilizar` do chat do editor: anexar um objeto de
 * estilo a todas as opções triplicaria a gramática (mina 1 do cabeçalho).
 */
const larguraField = z
  .enum(["cheia", "metade", "terco", "dois-tercos", "tres-quartos"])
  .nullable();
const posicaoField = z.enum(["esquerda", "centro", "direita"]).nullable();

// Blocos "folha" (não-contêineres). Reaproveitados dentro de painel/colunas.
export const leafOptions = [
  z.object({ kind: z.literal("paragraph"), text: z.string() }),
  z.object({ kind: z.literal("heading"), level: z.number().min(2).max(3), text: z.string() }),
  z.object({
    kind: z.literal("callout"),
    variant: z.enum(["info", "warning", "success", "danger", "note"]),
    text: z.string(),
    icon: iconField,
  }),
  z.object({ kind: z.literal("steps"), items: z.array(z.string()) }),
  z.object({ kind: z.literal("bullets"), items: z.array(z.string()) }),
  z.object({
    kind: z.literal("code"),
    language: z.string().nullable(),
    code: z.string(),
    filename: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("table"),
    // primeira linha = cabeçalho; cada linha é um array de células (texto).
    rows: z.array(z.array(z.string())),
    largura: larguraField,
    posicao: posicaoField,
  }),
  // Divisória: separa blocos de assunto dentro do artigo.
  z.object({ kind: z.literal("divider") }),
  // Lista de verificação (pré-requisitos, conferências).
  z.object({ kind: z.literal("checklist"), items: z.array(z.string()) }),
  // Citação/depoimento em destaque (vira o cartão de citação).
  z.object({ kind: z.literal("quote"), text: z.string() }),
  // Respiro vertical deliberado entre assuntos — use com parcimônia.
  z.object({ kind: z.literal("spacer"), size: z.enum(["sm", "md", "lg"]) }),
  // Botão/CTA — a URL PRECISA constar do texto original (guarda descarta).
  z.object({ kind: z.literal("button"), label: z.string(), url: z.string() }),
  // Indicadores/KPIs: valor + rótulo por cartão.
  z.object({
    kind: z.literal("stats"),
    items: z.array(z.object({ value: z.string(), label: z.string() })),
    largura: larguraField,
    posicao: posicaoField,
  }),
] as const;

export type LeafBlock = z.infer<(typeof leafOptions)[number]>;

export const blocksSchema = z.object({
  blocks: z.array(
    z.union([
      ...leafOptions,
      // Painel = caixa colorida de destaque com parágrafos.
      z.object({
        kind: z.literal("panel"),
        bg: z.enum(["purple", "pink", "blue", "gray"]),
        items: z.array(z.string()),
        icon: iconField,
      }),
      // Região dividida em colunas (cada coluna = parágrafos de texto simples).
      // `ratios` dá a proporção (ex.: [1,2] = estreita à esquerda + larga à
      // direita, ideal para imagem + texto); `divider` desenha a linha entre elas.
      z.object({
        kind: z.literal("columns"),
        columns: z.array(z.array(z.string())),
        ratios: z.array(z.number()).nullable(),
        divider: z.boolean().nullable(),
      }),
      // Banner/Hero = cabeçalho de destaque (título + subtítulo).
      z.object({
        kind: z.literal("hero"),
        eyebrow: z.string().nullable(),
        title: z.string(),
        subtitle: z.string().nullable(),
        icon: iconField,
      }),
      // Grade de cards = itens paralelos com título + descrição curta.
      z.object({
        kind: z.literal("cardGrid"),
        cards: z.array(z.object({ title: z.string(), text: z.string(), icon: iconField })),
      }),
      // Acordeão/FAQ = perguntas e respostas dobráveis (título + texto).
      z.object({
        kind: z.literal("accordion"),
        items: z.array(z.object({ titulo: z.string(), texto: z.string() })),
      }),
      // Toggle = bloco recolhível para conteúdo secundário/opcional.
      z.object({
        kind: z.literal("toggle"),
        title: z.string(),
        items: z.array(z.string()),
        icon: iconField,
      }),
    ]),
  ),
});

export type LayoutBlock = z.infer<typeof blocksSchema>["blocks"][number];
