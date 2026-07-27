"use server";

import { z } from "zod";
import { generateObject } from "ai";
import { requirePermission } from "@/lib/auth/permissions";
import { languageModel, hasAiKey, aiTimeout, ehTimeout } from "@/lib/ai/config";
import type { FlowData } from "@/lib/blocks/schema";

/**
 * "Editar com IA" do FLUXOGRAMA: instruções → nós + arestas. Não toca no banco —
 * devolve os dados para o editor aplicar no bloco (salvo depois com o artigo).
 * O schema é pequeno (cabe na gramática de Anthropic/Google — ver
 * [[blocks-schema-grammar-limit]]).
 */
const flowSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["start", "end", "process", "decision", "io", "subroutine"]),
        label: z.string(),
      }),
    )
    .min(1)
    .max(60),
  edges: z
    .array(
      z.object({
        id: z.string(),
        from: z.string(),
        to: z.string(),
        label: z.string().optional(),
      }),
    )
    .max(120),
});

export type FlowResult = { ok: true; data: FlowData } | { ok: false; error: string };

/** Garante ids únicos e arestas válidas (apontando para nós existentes). */
function normalizar(raw: z.infer<typeof flowSchema>): FlowData {
  const vistos = new Set<string>();
  const remap = new Map<string, string>();
  const nodes = raw.nodes.map((n, i) => {
    let id = (n.id || `n${i + 1}`).trim() || `n${i + 1}`;
    while (vistos.has(id)) id = `${id}_`;
    vistos.add(id);
    remap.set(n.id, id);
    return { id, type: n.type, label: String(n.label ?? "").slice(0, 120) };
  });
  const ids = new Set(nodes.map((n) => n.id));
  const usadas = new Set<string>();
  const edges = raw.edges
    .map((e, i) => {
      const from = remap.get(e.from) ?? e.from;
      const to = remap.get(e.to) ?? e.to;
      let id = (e.id || `e${i + 1}`).trim() || `e${i + 1}`;
      while (usadas.has(id)) id = `${id}_`;
      usadas.add(id);
      return { id, from, to, label: e.label?.trim() || undefined };
    })
    .filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  return { nodes, edges };
}

export async function generateFlowchart(instrucao: string, atual?: FlowData): Promise<FlowResult> {
  try {
    await requirePermission("content.edit");
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  if (!(await hasAiKey())) return { ok: false, error: "Configure uma chave de IA em Sistema → IA." };
  const inst = String(instrucao ?? "").trim().slice(0, 4000);
  if (!inst) return { ok: false, error: "Descreva o que o fluxograma deve mostrar." };

  try {
    const { object } = await generateObject({
      model: await languageModel("editor_generate"),
      schema: flowSchema,
      abortSignal: aiTimeout("editor_generate"),
      prompt: `Você monta FLUXOGRAMAS de documentação em português do Brasil.
${atual && atual.nodes.length ? `FLUXOGRAMA ATUAL (edite conforme a instrução, preservando o que fizer sentido):\n${JSON.stringify(atual)}\n` : ""}
INSTRUÇÃO DO USUÁRIO: ${inst}

Devolva nós e arestas:
- Tipos de nó: "start" (um único início), "end" (um ou mais fins), "process" (etapa/ação), "decision" (pergunta sim/não — SEMPRE com 2+ arestas de saída rotuladas, ex.: "Sim"/"Não"), "io" (entrada/saída de dados), "subroutine" (sub-processo).
- ids curtos e únicos (n1, n2…); arestas ligam ids existentes (from→to) e podem ter "label" (rótulo do ramo).
- Rótulos CURTOS e claros (2–6 palavras). O fluxo deve ter um "start", pelo menos um "end", e ser conectado (todo nó alcançável a partir do início).
- NÃO invente passos fora da instrução; seja fiel ao processo descrito.`,
    });
    const data = normalizar(object);
    if (!data.nodes.length) return { ok: false, error: "A IA não retornou nós." };
    return { ok: true, data };
  } catch (e) {
    if (ehTimeout(e)) return { ok: false, error: "A IA demorou demais." };
    return { ok: false, error: `Falha na IA: ${e instanceof Error ? e.message : "?"}` };
  }
}
