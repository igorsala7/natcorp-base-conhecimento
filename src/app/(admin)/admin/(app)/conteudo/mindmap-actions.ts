"use server";

import { z } from "zod";
import { generateObject } from "ai";
import { requirePermission } from "@/lib/auth/permissions";
import { languageModel, hasAiKey, aiTimeout, ehTimeout } from "@/lib/ai/config";
import { outlineToMindMap } from "@/lib/blocks/ai-data-blocks";
import type { MindMapData } from "@/lib/blocks/schema";

/**
 * "Editar com IA" do MAPA MENTAL: instruções → outline indentado → árvore. Não
 * toca no banco — devolve os dados para o editor aplicar no bloco. A IA descreve
 * o mapa como OUTLINE (grammar minúscula, cabe em qualquer provedor), igual ao
 * fluxograma via Mermaid.
 */
const schema = z.object({ outline: z.string().min(1) });

export type MindMapResult = { ok: true; data: MindMapData } | { ok: false; error: string };

export async function generateMindMap(instrucao: string, atualOutline?: string): Promise<MindMapResult> {
  try {
    await requirePermission("content.edit");
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  if (!(await hasAiKey())) return { ok: false, error: "Configure uma chave de IA em Sistema → IA." };
  const inst = String(instrucao ?? "").trim().slice(0, 4000);
  if (!inst) return { ok: false, error: "Descreva o que o mapa mental deve mostrar." };

  try {
    const { object } = await generateObject({
      model: await languageModel("editor_generate"),
      schema,
      abortSignal: aiTimeout("editor_generate"),
      prompt: `Você monta MAPAS MENTAIS de documentação em português do Brasil, na forma de um OUTLINE INDENTADO.
${atualOutline?.trim() ? `MAPA ATUAL (edite conforme a instrução, preservando o que fizer sentido):\n${atualOutline}\n` : ""}
INSTRUÇÃO DO USUÁRIO: ${inst}

Regras do outline:
- UMA linha por ideia. A 1ª linha, SEM indentação, é o TEMA CENTRAL (a raiz).
- Cada nível de indentação (2 espaços) cria um sub-ramo do tópico da linha de cima.
- Rótulos CURTOS e claros (1–5 palavras). Sem numeração e sem marcadores — só o texto e a indentação.
- Agrupe os subtópicos sob o tópico a que pertencem, com hierarquia lógica.
- NÃO invente conteúdo fora da instrução; seja fiel ao que foi descrito.`,
    });
    const data = outlineToMindMap(object.outline);
    if (!data) return { ok: false, error: "A IA não retornou um mapa." };
    return { ok: true, data };
  } catch (e) {
    if (ehTimeout(e)) return { ok: false, error: "A IA demorou demais." };
    return { ok: false, error: `Falha na IA: ${e instanceof Error ? e.message : "?"}` };
  }
}
