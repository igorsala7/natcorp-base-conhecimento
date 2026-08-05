import "server-only";
import { generateText } from "ai";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";

/**
 * Desambiguação FERRAMENTA × FERRAMENTA — apoio ao gate do chat (route.ts). Para o
 * usuário LEIGO em RH, o nome técnico da tool ("Requisição de Vaga") confunde; o que
 * ajuda é dizer O QUE ele vai OBTER, em linguagem simples.
 *
 * `rotulosAmigaveisTools` reescreve cada candidata num rótulo curto e leigo — atrás da
 * CHAVINHA `CLARIFY_TOOL_AI_LABELS=1` (desligada por padrão, para testar depois). Custa
 * 1 chamada de IA rápida; degrada para [] (o gate usa a descrição/nome).
 */
export type CandTool = { key: string; name: string; description?: string | null };

/** Chavinha (env `CLARIFY_TOOL_AI_LABELS=1`) — lê em runtime, sem const de módulo. */
export function aiLabelsLigado(): boolean {
  return process.env.CLARIFY_TOOL_AI_LABELS === "1";
}

export async function rotulosAmigaveisTools(cands: CandTool[]): Promise<string[]> {
  if (!aiLabelsLigado() || cands.length === 0) return [];
  if (!(await hasAiKey("query_rewrite"))) return [];
  try {
    const lista = cands.map((c, i) => `${i + 1}. ${c.name}${c.description ? ` — ${c.description}` : ""}`).join("\n");
    const { text } = await generateText({
      model: await languageModel("query_rewrite"), // modelo RÁPIDO (fallback → Chat)
      abortSignal: aiTimeout("query_rewrite"), // curto: está no caminho da pergunta
      prompt: `Reescreva cada opção abaixo como um rótulo CURTO (no máximo 6 palavras) que diga, em linguagem simples para quem NÃO entende de RH, O QUE a pessoa vai OBTER ao escolher aquela opção. Sem jargão, sem repetir o nome técnico. Responda APENAS um array JSON de strings, na MESMA ordem, nada além disso.

OPÇÕES:
${lista}

JSON:`,
    });
    const bruto = JSON.parse((text.match(/\[[\s\S]*\]/) || ["[]"])[0]);
    if (!Array.isArray(bruto)) return [];
    // Mantém o alinhamento por índice; vazio onde não veio string válida.
    return cands.map((_, i) => (typeof bruto[i] === "string" ? String(bruto[i]).trim().slice(0, 60) : ""));
  } catch {
    return [];
  }
}
