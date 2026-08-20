import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";

/**
 * Mapeia colunas/aliases de uma REGIÃO APEX para a TABELA e COLUNA reais do banco,
 * lendo o SQL da região (resolve o alias da tabela no FROM/JOIN, ex.:
 * `select f.nome_colab ... from dados_funcionais f` → nome_colab está em DADOS_FUNCIONAIS).
 * Usa a IA do Chat. `Map` vazio sem IA.
 */
const schema = z.object({
  colunas: z.array(z.object({ entrada: z.string(), table: z.string().nullable(), column: z.string().nullable() })),
});

export async function resolverColunasRegiao(
  sql: string | null,
  entradas: string[],
): Promise<Map<string, { table: string | null; column: string | null }>> {
  const out = new Map<string, { table: string | null; column: string | null }>();
  if (!entradas.length || !(await hasAiKey("chat"))) return out;
  const model = await languageModel("chat", { rotulo: "apex_resolve" });
  const prompt =
    `Você mapeia colunas/aliases de uma REGIÃO Oracle APEX para a TABELA e COLUNA reais do banco, a partir ` +
    `da consulta SQL da região. Para cada ENTRADA (um alias de coluna de relatório, ou o nome de coluna de um ` +
    `item de formulário), devolva: table (a tabela de origem — RESOLVA o alias da tabela no FROM/JOIN) e column ` +
    `(o nome real da coluna). Regras: se a entrada é uma EXPRESSÃO/derivada sem coluna única, ponha column = a ` +
    `própria entrada e table = null. Se o "SQL" for apenas o NOME de uma tabela (região de formulário), use-o como ` +
    `table e a entrada como column. NUNCA invente tabelas que não estejam no SQL. Responda em MAIÚSCULAS.\n\n` +
    `SQL DA REGIÃO:\n${(sql ?? "").slice(0, 3500)}\n\nENTRADAS:\n${entradas.join("\n")}`;
  try {
    const { object } = await generateObject({ model, schema, prompt, abortSignal: aiTimeout("ontology_scan") });
    const validas = new Set(entradas);
    for (const c of object.colunas) {
      if (!validas.has(c.entrada)) continue;
      out.set(c.entrada, {
        table: c.table?.trim().toUpperCase() || null,
        column: c.column?.trim().toUpperCase() || c.entrada.toUpperCase(),
      });
    }
  } catch {
    /* sem resolução → o chamador cai para a entrada como coluna */
  }
  return out;
}
