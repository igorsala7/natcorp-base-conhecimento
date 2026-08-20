import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";
import { idiomaNome } from "@/lib/i18n/languages";

/**
 * Tradução dos RÓTULOS/TEXTOS de interface do sistema APEX (para o assistente de
 * XLIFF, Fase 2). Usa a IA do Chat e o GLOSSÁRIO da ontologia (mesmo termo → mesma
 * tradução), para a UI e o chatbot falarem a mesma língua. Devolve id→tradução.
 */
const schema = z.object({
  textos: z.array(z.object({ id: z.string(), target: z.string() })),
});
const LOTE = 40;

export async function traduzirTextosUI(
  textos: { id: string; source: string }[],
  lang: string,
  glossario: { pt: string; alvo: string }[] = [],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const alvo = idiomaNome(lang);
  if (!alvo || !textos.length || !(await hasAiKey("chat"))) return out;
  const model = await languageModel("chat", { rotulo: "ui_traducao" });
  const glos = glossario.slice(0, 80).map((g) => `- "${g.pt}" → "${g.alvo}"`).join("\n");

  for (let i = 0; i < textos.length; i += LOTE) {
    const lote = textos.slice(i, i + LOTE);
    const lista = lote.map((t) => `[${t.id}] ${t.source}`).join("\n");
    const prompt =
      `Traduza os RÓTULOS/TEXTOS de interface de um sistema de RH (Oracle APEX) do português para ${alvo}. ` +
      `São textos de UI (botões, títulos, mensagens, colunas): traduza de forma NATURAL e CURTA, no tom de interface. ` +
      `MANTENHA intactos placeholders/variáveis (ex.: &P1_X., #NOME#, %s, {0}), pontuação, e o padrão de maiúsculas. ` +
      `Para CADA item ECOE o mesmo id entre colchetes e devolva só o texto traduzido.` +
      (glos ? `\n\nGLOSSÁRIO (use EXATAMENTE estas traduções para estes termos, por consistência com o chatbot):\n${glos}` : "") +
      `\n\nTEXTOS:\n${lista}`;
    try {
      const { object } = await generateObject({ model, schema, prompt, abortSignal: aiTimeout("ontology_scan") });
      const validos = new Set(lote.map((t) => t.id));
      for (const r of object.textos) {
        if (validos.has(r.id) && r.target.trim()) out.set(r.id, r.target.trim());
      }
    } catch {
      /* pula o lote; os não traduzidos ficam para revisão manual */
    }
  }
  return out;
}
