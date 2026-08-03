/**
 * Modelo de metadados de OBJETOS DE BANCO Oracle (tabelas, colunas, views, triggers,
 * procedures, functions, packages) — a "documentação técnica parruda" (Fase D). Fonte:
 * `pkg_db_meta` (catálogo ALL_*) ou DDL/source colado. Puro/testável.
 */

export type DbColumn = { name: string; type: string | null; nullable: boolean; comment: string | null };
export type DbTable = { name: string; comment: string | null; columns: DbColumn[] };
export type DbView = { name: string; comment: string | null; text: string | null };
export type DbCodeKind = "trigger" | "procedure" | "function" | "package";
export type DbCodeObject = { name: string; kind: DbCodeKind; table: string | null; source: string | null };
export type DbMeta = { tables: DbTable[]; views: DbView[]; code: DbCodeObject[] };

const s = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown): boolean => v === true || v === "Y" || v === "YES" || v === 1 || v === "1";

const CODE_KINDS = new Set<DbCodeKind>(["trigger", "procedure", "function", "package"]);

/** Normaliza o JSON de `pkg_db_meta` (ou equivalente) para o modelo interno. `null` se vazio. */
export function normalizarDbJson(raw: unknown): DbMeta | null {
  const r = o(raw);
  if (r.ok === false) return null;
  const tables: DbTable[] = arr(r.tables).map((x) => {
    const t = o(x);
    return {
      name: String(t.name ?? "").toUpperCase(),
      comment: s(t.comment),
      columns: arr(t.columns).map((y) => {
        const c = o(y);
        return { name: String(c.name ?? "").toUpperCase(), type: s(c.type), nullable: bool(c.nullable), comment: s(c.comment) };
      }),
    };
  }).filter((t) => t.name);
  const views: DbView[] = arr(r.views).map((x) => { const v = o(x); return { name: String(v.name ?? "").toUpperCase(), comment: s(v.comment), text: s(v.text) }; }).filter((v) => v.name);
  const code: DbCodeObject[] = arr(r.code).map((x) => {
    const c = o(x);
    const k = String(c.kind ?? "procedure").toLowerCase() as DbCodeKind;
    return { name: String(c.name ?? "").toUpperCase(), kind: CODE_KINDS.has(k) ? k : "procedure", table: s(c.table), source: s(c.source) };
  }).filter((c) => c.name);
  if (!tables.length && !views.length && !code.length) return null;
  return { tables, views, code };
}

/** Contexto textual de UM objeto de banco (para a documentação técnica por IA). */
export function contextoObjetoDb(meta: DbMeta, kind: string, name: string): string {
  if (kind === "table") {
    const t = meta.tables.find((x) => x.name === name);
    if (!t) return "";
    const cols = t.columns.map((c) => `- ${c.name} ${c.type ?? ""}${c.nullable ? "" : " NOT NULL"}${c.comment ? ` — ${c.comment}` : ""}`).join("\n");
    return `TABELA ${t.name}${t.comment ? ` — ${t.comment}` : ""}\nCOLUNAS:\n${cols}`.slice(0, 8000);
  }
  if (kind === "view") {
    const v = meta.views.find((x) => x.name === name);
    return v ? `VIEW ${v.name}${v.comment ? ` — ${v.comment}` : ""}\nSQL:\n${v.text ?? ""}`.slice(0, 8000) : "";
  }
  const c = meta.code.find((x) => x.name === name && x.kind === kind);
  return c ? `${c.kind.toUpperCase()} ${c.name}${c.table ? ` (tabela ${c.table})` : ""}\nCÓDIGO:\n${c.source ?? ""}`.slice(0, 8000) : "";
}
