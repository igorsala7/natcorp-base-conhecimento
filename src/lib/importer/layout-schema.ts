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
 * ⚠️ LIMITE DE UNIÕES da Anthropic (mina 4): a saída estruturada rejeita
 * schemas com MAIS DE 16 parâmetros de tipo-união (cada `.nullable()` vira
 * `["X","null"]`, uma união). Este schema vive perto do teto — some com um
 * campo `.nullable()` antes de somar outro. Por isso table/stats NÃO carregam
 * mais largura/posição aqui: o ajuste de largura vive no inspetor do editor.
 */

// Blocos "folha" (não-contêineres). Reaproveitados dentro de painel/colunas.
export const leafOptions = [
  z.object({ kind: z.literal("paragraph"), text: z.string() }),
  z.object({ kind: z.literal("heading"), level: z.number().min(2).max(3), text: z.string() }),
  z.object({
    kind: z.literal("callout"),
    variant: z.enum(["info", "warning", "success", "danger", "note"]),
    /** Título ESPECÍFICO do aviso ("Limite de importação"); null = rótulo do tipo. */
    titulo: z.string().nullable(),
    text: z.string(),
    icon: iconField,
  }),
  z.object({
    kind: z.literal("steps"),
    /** titulo = rótulo CURTO do passo (palavras do próprio texto); null se o passo não tiver. */
    items: z.array(z.object({ titulo: z.string().nullable(), texto: z.string() })),
  }),
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
  }),
  // Divisória: separa blocos de assunto dentro do artigo.
  z.object({ kind: z.literal("divider") }),
  // Lista de verificação (pré-requisitos, conferências).
  z.object({ kind: z.literal("checklist"), items: z.array(z.string()) }),
  // Citação/depoimento em destaque (vira o cartão de citação).
  z.object({
    kind: z.literal("quote"),
    text: z.string(),
    /** Autor/fonte da citação quando o texto indicar (ex.: nome após travessão "—" ou "segundo Fulano"); senão null. */
    autor: z.string().nullable(),
  }),
  // Respiro vertical deliberado entre assuntos — use com parcimônia.
  z.object({ kind: z.literal("spacer"), size: z.enum(["sm", "md", "lg"]) }),
  // Botão/CTA — a URL PRECISA constar do texto original (guarda descarta).
  z.object({ kind: z.literal("button"), label: z.string(), url: z.string() }),
  // Indicadores/KPIs: valor + rótulo por cartão.
  z.object({
    kind: z.literal("stats"),
    items: z.array(z.object({ value: z.string(), label: z.string() })),
  }),
] as const;

export type LeafBlock = z.infer<(typeof leafOptions)[number]>;

/**
 * GRÁFICO e FLUXOGRAMA como STRING: a IA descreve o gráfico com `chartType` +
 * CSV e o fluxograma em sintaxe Mermaid — grammar minúscula (cabe em Anthropic/
 * Google) e reaproveita os parsers (ai-data-blocks.ts). `blocksToDoc` converte.
 */
export const chartLeaf = z.object({
  kind: z.literal("chart"),
  chartType: z.enum([
    "column", "bar", "line", "area", "stackedColumn", "stackedArea",
    "combo", "pie", "donut", "scatter", "bubble", "radar",
  ]),
  // CSV/TSV: 1ª linha = cabeçalhos, 1ª coluna = categorias (eixo X).
  dataCsv: z.string(),
  title: z.string().nullable(),
});
export const flowLeaf = z.object({
  kind: z.literal("flow"),
  // Sintaxe Mermaid `flowchart TD` (id[Etapa], id{Decisão}, a -->|Sim| b).
  mermaid: z.string(),
});
export const mindmapLeaf = z.object({
  kind: z.literal("mindmap"),
  // Outline indentado: 1ª linha = tema central; 2 espaços = um nível de sub-ramo.
  outline: z.string(),
});

export const blocksSchema = z.object({
  blocks: z.array(
    z.union([
      ...leafOptions,
      chartLeaf,
      flowLeaf,
      mindmapLeaf,
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

/**
 * Versão COMPACTA — só os 10 blocos essenciais de documentação (os `leafOptions`
 * 0..9: parágrafo, título, callout, passos, lista, código, tabela, divisória,
 * checklist, citação), SEM contêineres (painel/colunas/hero/cards/acordeão/
 * toggle) nem extras (spacer/button/stats).
 *
 * Por quê: provedores com CONSTRAINED DECODING (Anthropic, e provável Google)
 * recusam o schema completo com "compiled grammar is too large". Este subconjunto
 * cabe na gramática deles. A saída é um SUBCONJUNTO de `LayoutBlock`, então
 * `blocksToDoc` continua valendo. O OpenAI segue com o schema completo (mais rico).
 */
export const blocksSchemaCompacto = z.object({
  blocks: z.array(
    z.union([
      leafOptions[0],
      leafOptions[1],
      leafOptions[2],
      leafOptions[3],
      leafOptions[4],
      leafOptions[5],
      leafOptions[6],
      leafOptions[7],
      leafOptions[8],
      leafOptions[9],
      chartLeaf,
      flowLeaf,
      mindmapLeaf,
    ]),
  ),
});
