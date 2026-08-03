import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";
import type { ApexAppMeta, ApexPage } from "./metadata";

/**
 * Gera, para UMA página APEX, dois artigos em HTML: um para o USUÁRIO final (o que a
 * página faz, campos, ações, regras — linguagem simples) e um TÉCNICO para os analistas
 * de sistemas/programadores (itens+coluna do banco, regiões+SQL, validações, processes,
 * dynamic actions, fluxo). Usa a IA do Chat. `null` sem IA.
 */
const schema = z.object({ usuario: z.string(), tecnico: z.string() });

/** Monta o contexto textual da página a partir do metadado da app. */
export function contextoPagina(meta: ApexAppMeta, page: ApexPage): string {
  const pid = page.id;
  const linhas: string[] = [];
  linhas.push(`PÁGINA ${pid}: ${page.name ?? ""}${page.title ? ` — "${page.title}"` : ""} (modo: ${page.mode ?? "?"})`);
  const regs = meta.regions.filter((r) => r.pageId === pid);
  if (regs.length) {
    linhas.push("REGIÕES:");
    for (const r of regs) linhas.push(`- ${r.name ?? r.id} [${r.type ?? "?"}]${r.sql ? ` — SQL: ${r.sql.slice(0, 400)}` : ""}`);
  }
  const itens = meta.items.filter((i) => i.pageId === pid);
  if (itens.length) {
    linhas.push("CAMPOS (item · label · origem):");
    for (const i of itens) linhas.push(`- ${i.name} · "${i.label ?? ""}" · ${i.displayAs ?? ""}${i.source ? ` · coluna ${i.source}` : ""}`);
  }
  const btns = meta.buttons.filter((b) => b.pageId === pid);
  if (btns.length) linhas.push("BOTÕES: " + btns.map((b) => `${b.name} ("${b.label ?? ""}")`).join(", "));
  const cols = meta.reportColumns.filter((c) => c.pageId === pid);
  if (cols.length) linhas.push("COLUNAS DE RELATÓRIO: " + cols.map((c) => `${c.alias} ("${c.label ?? ""}")`).join(", "));
  const vals = meta.validations.filter((v) => v.pageId === pid);
  if (vals.length) { linhas.push("VALIDAÇÕES:"); for (const v of vals) linhas.push(`- ${v.name}${v.message ? `: ${v.message}` : ""}`); }
  const procs = meta.processes.filter((p) => p.pageId === pid);
  if (procs.length) linhas.push("PROCESSES: " + procs.map((p) => `${p.name} [${p.type ?? "?"}${p.point ? `/${p.point}` : ""}]`).join(", "));
  const das = meta.dynamicActions.filter((d) => d.pageId === pid);
  if (das.length) linhas.push("DYNAMIC ACTIONS: " + das.map((d) => `${d.name} (evento: ${d.event ?? "?"})`).join(", "));
  return linhas.join("\n").slice(0, 8000);
}

export async function gerarDocsPagina(meta: ApexAppMeta, page: ApexPage): Promise<{ usuario: string; tecnico: string } | null> {
  if (!(await hasAiKey("chat"))) return null;
  const model = await languageModel("chat");
  const ctx = contextoPagina(meta, page);
  const prompt =
    `Você documenta uma página de uma aplicação Oracle APEX de RH a partir dos METADADOS abaixo. Gere DOIS ` +
    `documentos em HTML SIMPLES (use apenas <h2>, <h3>, <p>, <ul>, <li>, <strong>, <table>/<tr>/<td> — sem CSS, ` +
    `sem <html>/<body>). Baseie-se SOMENTE nos metadados; não invente comportamento.\n\n` +
    `1) "usuario" — para o ANALISTA/USUÁRIO FINAL: o que a página faz, os campos (pela LABEL, não pelo nome técnico), ` +
    `as ações (botões), as regras/validações e o que esperar. Linguagem simples e direta, sem jargão técnico.\n` +
    `2) "tecnico" — para os ANALISTAS DE SISTEMAS/PROGRAMADORES da Natcorp: itens e a COLUNA do banco de cada um, as ` +
    `regiões e suas consultas SQL, validações, processes (tipo/ponto), dynamic actions (evento) e o FLUXO de ` +
    `funcionamento/dados. Objetivo e completo.\n\nMETADADOS:\n${ctx}`;
  try {
    const { object } = await generateObject({ model, schema, prompt, abortSignal: aiTimeout("import_layout") });
    return { usuario: object.usuario.trim(), tecnico: object.tecnico.trim() };
  } catch {
    return null;
  }
}
