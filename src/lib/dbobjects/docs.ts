import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";
import { contextoObjetoDb, type DbMeta } from "./metadata";

/**
 * Documentação TÉCNICA de um objeto de banco (tabela/view/trigger/procedure/function/
 * package) para os analistas de sistemas/programadores da Natcorp. HTML simples. `null`
 * sem IA. É a "documentação técnica parruda" da Fase D.
 */
const schema = z.object({ html: z.string() });

export async function gerarDocObjetoDb(meta: DbMeta, kind: string, name: string): Promise<string | null> {
  const ctx = contextoObjetoDb(meta, kind, name);
  if (!ctx || !(await hasAiKey("chat"))) return null;
  const model = await languageModel("chat", { rotulo: "ingestao_banco" });
  const prompt =
    `Documente TECNICAMENTE um objeto de banco Oracle a partir dos metadados abaixo, para os ANALISTAS DE ` +
    `SISTEMAS e PROGRAMADORES da Natcorp. Gere HTML SIMPLES (apenas <h2>,<h3>,<p>,<ul>,<li>,<strong>,<table>/<tr>/` +
    `<td> — sem CSS, sem <html>/<body>). Baseie-se SOMENTE nos metadados; não invente.\n` +
    `- TABELA: propósito, cada coluna (tipo, obrigatoriedade, significado) e os relacionamentos aparentes ` +
    `(chaves/colunas que referenciam outras tabelas).\n` +
    `- VIEW: o que retorna e a lógica do SQL.\n` +
    `- TRIGGER/PROCEDURE/FUNCTION/PACKAGE: o que faz, quando dispara / como é chamado, e o PASSO A PASSO do código ` +
    `(regras de negócio embutidas).\n\nMETADADOS:\n${ctx}`;
  try {
    const { object } = await generateObject({ model, schema, prompt, abortSignal: aiTimeout("import_layout") });
    return object.html.trim();
  } catch {
    return null;
  }
}
