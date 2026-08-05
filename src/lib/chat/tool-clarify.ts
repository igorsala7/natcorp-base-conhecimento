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

/**
 * Seleção de tools ADERENTES por IA — numa pergunta COMPOSTA (várias facetas: salário,
 * férias, avaliações, cargos…), o embedding ÚNICO da pergunta BORRA e o top-K do matcher
 * traz tools genéricas ("dados de colaborador": ponto, apuração, equipe) em vez das
 * específicas de cada faceta. Aqui uma IA rápida LÊ a pergunta + nome/descrição/sinônimos
 * de cada candidata e devolve as CHAVES de TODAS as tools cujos dados a pergunta precisa
 * (uma por faceta), descartando as de assunto NÃO mencionado. Devolve `[]` se falhar/off
 * (o chamador cai no top-K do embedding). Custa 1 chamada de modelo RÁPIDO.
 */
export async function selecionarToolsAderentes(query: string, cands: CandTool[]): Promise<string[]> {
  const q = String(query ?? "").trim();
  if (!q || cands.length === 0) return [];
  if (!(await hasAiKey("query_rewrite"))) return [];
  try {
    const lista = cands.map((c) => `- [${c.key}] ${c.name}${c.description ? `: ${c.description}` : ""}`).join("\n");
    const { text } = await generateText({
      model: await languageModel("query_rewrite"),
      abortSignal: aiTimeout("query_rewrite"),
      prompt:
        `Pergunta do usuário (pode pedir VÁRIOS dados distintos numa frase só):\n"""${q}"""\n\n` +
        `Ferramentas de dados disponíveis (a chave está entre colchetes):\n${lista}\n\n` +
        `Devolva as CHAVES de TODAS as ferramentas cujos dados a pergunta REALMENTE precisa — ` +
        `a pergunta costuma precisar de VÁRIAS (ex.: uma para salário, outra para férias, outra ` +
        `para avaliações, outra para cargos). Inclua uma ferramenta por ASSUNTO CITADO; NÃO inclua ` +
        `ferramentas de assuntos que a pergunta NÃO menciona. Responda SÓ as chaves, uma por linha.`,
    });
    const validas = new Set(cands.map((c) => c.key));
    return [...new Set((text.match(/[a-z0-9_]+/gi) || []).map((k) => k.toLowerCase()).filter((k) => validas.has(k)))];
  } catch {
    return [];
  }
}
