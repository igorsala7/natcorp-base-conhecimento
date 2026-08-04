import { generateObject } from "ai";
import { z } from "zod";
import type { TextPart, FilePart, ImagePart } from "ai";
import { languageModel, aiTimeout, ehTimeout } from "../ai/config";
import type { DocInput } from "./doc-input";

/**
 * Interpreta FLUXOGRAMAS que a IA VÊ (páginas do PDF renderizado da planilha), aba por
 * aba: para cada fluxo devolve o GRAFO (nós + ligações), o início/fim e o passo a passo.
 * Espelha `readOutline`, mas a saída é um grafo (não uma árvore de títulos).
 *
 * FIDELIDADE é a regra: a IA descreve exatamente as caixas e as SETAS desenhadas — não
 * inventa etapas nem ligações. Falha/timeout → `{ erro }` (o worker mostra e não quebra).
 */
const nodeSchema = z.object({
  id: z.string().describe("Id curto e ESTÁVEL do nó (ex.: n1, n2)."),
  type: z.enum(["start", "end", "process", "decision", "io", "subroutine"]),
  label: z.string().describe("O texto EXATO da caixa, sem inventar."),
});
const edgeSchema = z.object({
  from: z.string().describe("id do nó de origem"),
  to: z.string().describe("id do nó de destino (siga a direção da SETA)"),
  label: z.string().nullable().describe("Rótulo da seta, se houver (ex.: Sim/Não numa decisão)."),
});
const fluxoSchema = z.object({
  titulo: z.string().describe("Título do fluxo (o nome da aba/página)."),
  resumo: z.string().describe("1 parágrafo: o que este fluxo faz, ONDE inicia e ONDE termina, e como as etapas se integram."),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  passos: z.array(z.object({
    node: z.string().describe("id do nó"),
    explicacao: z.string().describe("1-2 frases explicando esta etapa (o que é / o que faz)."),
  })),
});
const flowSchema = z.object({
  fluxos: z.array(fluxoSchema).describe("UM item por FLUXOGRAMA (aba/página). Não junte fluxos diferentes."),
});

export type FluxoLido = z.infer<typeof fluxoSchema>;
export type ReadFlowchartResult = { fluxos: FluxoLido[] } | { erro: string };

const INSTRUCOES =
  "Você recebe as PÁGINAS de uma planilha renderizada — cada página é um FLUXOGRAMA (uma aba). " +
  "Interprete CADA página como um fluxo separado, com FIDELIDADE ABSOLUTA ao desenho: " +
  "(1) cada CAIXA é um nó — copie o texto EXATO e classifique o tipo (início/fim = pílula; decisão = losango; " +
  "processo = retângulo; entrada/saída = paralelogramo; sub-rotina). " +
  "(2) cada SETA é uma ligação (edge) — siga a DIREÇÃO da seta (from→to); se a seta sai de uma decisão, " +
  "capture o rótulo (Sim/Não, etc.). NÃO invente caixas nem setas que não estão no desenho; NÃO omita nenhuma. " +
  "(3) identifique onde o fluxo INICIA e onde TERMINA. (4) escreva um resumo e um passo a passo por nó. " +
  "Se uma página não for um fluxograma (ex.: uma tabela/checklist), ainda assim descreva-a em `resumo` e deixe nodes/edges como puder.";

export async function readFlowchart(docInput: DocInput): Promise<ReadFlowchartResult> {
  const content: Array<TextPart | FilePart | ImagePart> = [
    { type: "text", text: INSTRUCOES },
    ...(docInput.parts as Array<TextPart | FilePart | ImagePart>),
  ];
  try {
    const { object } = await generateObject({
      model: await languageModel("import_structure"),
      schema: flowSchema,
      messages: [{ role: "user", content }],
      abortSignal: aiTimeout("import_structure"),
    });
    const fluxos = (object.fluxos ?? []).filter((f) => f.nodes.length > 0 || f.resumo?.trim());
    if (!fluxos.length) return { erro: "a IA não identificou nenhum fluxo nas páginas" };
    return { fluxos };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Leitura de fluxograma falhou:", msg);
    if (ehTimeout(e)) return { erro: "a IA não respondeu a tempo" };
    return { erro: msg.slice(0, 300) };
  }
}
