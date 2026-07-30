import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";
import { promptField } from "@/lib/ai/prompts";

/**
 * Extração de TERMOS DE DOMÍNIO de um lote de texto dos artigos — o "cérebro"
 * da varredura de ontologia. Usa a MESMA IA configurada no **Chat** (Sistema →
 * IA), não um provedor fixo. Schema pequeno de propósito.
 */
const schema = z.object({
  terms: z.array(
    z.object({
      term: z.string(),
      kind: z.enum(["conceito", "entidade", "acao", "sigla", "outro"]),
      description: z.string(),
      aliases: z.array(z.string()),
    }),
  ),
});

export type TermoExtraido = {
  term: string;
  kind: "conceito" | "entidade" | "acao" | "sigla" | "outro";
  description: string | null;
  aliases: string[];
};

/** Extrai termos+sinônimos de um lote de texto. `[]` se não há IA de Chat. */
export async function extrairTermos(texto: string): Promise<TermoExtraido[]> {
  if (!texto.trim() || !(await hasAiKey("chat"))) return [];
  const model = await languageModel("chat");
  const prompt = await promptField("ontologia", "prompt");
  const { object } = await generateObject({
    model,
    schema,
    prompt: prompt + "\n\nDOCUMENTAÇÃO:\n" + texto,
    abortSignal: aiTimeout("ontology_scan"),
  });
  return object.terms
    .map((t) => ({
      term: t.term.trim(),
      kind: t.kind,
      description: t.description.trim() || null,
      aliases: [...new Set(t.aliases.map((a) => a.trim()).filter(Boolean))],
    }))
    .filter((t) => t.term.length >= 2);
}

/**
 * Dada uma LISTA de termos fornecida pelo usuário (importação por arquivo),
 * gera para cada um o termo canônico + tipo + descrição curta + SINÔNIMOS.
 * Ao contrário de `extrairTermos` (que garimpa termos de um texto), aqui os
 * termos JÁ SÃO os da lista — a IA só normaliza e ENRIQUECE com sinônimos,
 * incluindo os fornecidos. NÃO deve inventar termos fora da lista.
 */
export async function sinonimosDeTermos(
  entradas: { term: string; aliases: string[] }[],
): Promise<TermoExtraido[]> {
  const limpos = entradas
    .map((e) => ({ term: e.term.trim(), aliases: [...new Set(e.aliases.map((a) => a.trim()).filter(Boolean))] }))
    .filter((e) => e.term.length >= 2);
  if (!limpos.length || !(await hasAiKey("chat"))) return [];
  const model = await languageModel("chat");

  const lista = limpos
    .map((e) => (e.aliases.length ? `- ${e.term} (sinônimos dados: ${e.aliases.join(", ")})` : `- ${e.term}`))
    .join("\n");
  const instrucao =
    "Você recebe uma LISTA de termos de domínio de um produto (cada linha é UM termo, " +
    "podendo trazer sinônimos já informados). Para CADA termo da lista devolva: o termo " +
    "canônico (corrija capitalização/acento óbvios, mas mantenha o sentido), o tipo " +
    "(conceito/entidade/acao/sigla/outro), uma descrição curta (1 frase; pode ficar vazia " +
    "se não souber) e uma lista de SINÔNIMOS/variações comuns — INCLUA os sinônimos dados e " +
    "acrescente outros do mesmo domínio (abreviações, plural/singular, termos equivalentes). " +
    "NÃO invente termos que não estejam na lista. Responda apenas com os termos da lista.\n\nLISTA:\n" +
    lista;

  const { object } = await generateObject({
    model,
    schema,
    prompt: instrucao,
    abortSignal: aiTimeout("ontology_scan"),
  });
  return object.terms
    .map((t) => ({
      term: t.term.trim(),
      kind: t.kind,
      description: t.description.trim() || null,
      aliases: [...new Set(t.aliases.map((a) => a.trim()).filter(Boolean))],
    }))
    .filter((t) => t.term.length >= 2);
}
