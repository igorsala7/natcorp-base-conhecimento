import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";
import { idiomaNome } from "@/lib/i18n/languages";

/**
 * TRADUÇÃO CONTEXTUAL da ontologia — replica um termo do glossário (PT canônico)
 * para outro idioma SEM traduzir ao pé da letra: usa o termo/sinônimos que um
 * falante nativo usaria NO CONTEXTO de RH/folha/ponto. Usa a MESMA IA do Chat
 * (Sistema → IA). Espelha `ontology-scan.ts`.
 */
const schema = z.object({
  termos: z.array(
    z.object({
      id: z.string(), // eco do id do termo PT (para casar a resposta)
      term: z.string(), // termo canônico no idioma-alvo
      description: z.string(), // descrição traduzida (curta; pode ficar vazia)
      aliases: z.array(z.string()), // sinônimos/variações no idioma-alvo
    }),
  ),
});

export type TermoParaTraduzir = { id: string; term: string; description: string | null; aliases: string[] };
export type TermoTraduzido = { id: string; term: string; description: string | null; aliases: string[] };

/**
 * Traduz um LOTE de termos para `lang`. Devolve só os que a IA casou pelo id.
 * `[]` se não há IA de Chat ou o idioma é inválido. Puro do ponto de vista de IO
 * (só chama a IA); a persistência fica no job.
 */
export async function traduzirTermos(termos: TermoParaTraduzir[], lang: string): Promise<TermoTraduzido[]> {
  const alvo = idiomaNome(lang);
  if (!alvo || !termos.length || !(await hasAiKey("chat"))) return [];
  const model = await languageModel("chat", { rotulo: "ontologia_traducao" });

  const lista = termos
    .map((t) => {
      const desc = t.description ? ` | descrição: ${t.description}` : "";
      const sin = t.aliases.length ? ` | sinônimos: ${t.aliases.join(", ")}` : "";
      return `[${t.id}] ${t.term}${desc}${sin}`;
    })
    .join("\n");

  const instrucao =
    `Você traduz termos de um GLOSSÁRIO/ontologia de um produto de RH do português para ${alvo}. ` +
    `NÃO traduza ao pé da letra: use o termo que um FALANTE NATIVO de ${alvo} usaria NO CONTEXTO de RH, folha de ` +
    `pagamento e ponto (ex.: "férias" → em inglês "vacation"/"PTO", não "holidays"; "holerite" → "pay stub"/"payslip"). ` +
    `Para CADA termo da lista, ECOE o mesmo id entre colchetes e devolva: term (o termo canônico em ${alvo}), ` +
    `description (a descrição traduzida e curta; deixe vazia se a original estiver vazia) e aliases (os sinônimos/` +
    `variações equivalentes em ${alvo} — plural/singular, abreviações, termos correntes; inclua o equivalente dos ` +
    `sinônimos dados). Traduza TODOS os termos da lista, mantendo o id. Nomes próprios e siglas sem equivalente ficam ` +
    `como estão.\n\nLISTA:\n` +
    lista;

  const { object } = await generateObject({
    model,
    schema,
    prompt: instrucao,
    abortSignal: aiTimeout("ontology_scan"),
  });

  const validos = new Set(termos.map((t) => t.id));
  return object.termos
    .filter((t) => validos.has(t.id))
    .map((t) => ({
      id: t.id,
      term: t.term.trim(),
      description: t.description.trim() || null,
      aliases: [...new Set(t.aliases.map((a) => a.trim()).filter(Boolean))],
    }))
    .filter((t) => t.term.length >= 1);
}
