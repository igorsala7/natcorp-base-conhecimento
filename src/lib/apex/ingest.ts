import type { ApexAppMeta } from "./metadata";
import type { Database } from "@/lib/database.types";

type LinhaDic = Database["public"]["Tables"]["data_dictionary"]["Insert"];

const ehColuna = (st: string | null | undefined) => !!st && /db\s*column|column|coluna/i.test(st);

/**
 * Por REGIÃO, as colunas/aliases a resolver (de itens DB Column + colunas de
 * relatório) com a(s) label(s). A IA depois mapeia cada `entrada` → tabela.coluna
 * lendo o SQL da região. Determinístico/testável.
 */
export function colunasParaResolver(
  meta: ApexAppMeta,
): { regionId: string; pageId: string; sql: string | null; entradas: { entrada: string; label: string | null }[] }[] {
  const regInfo = new Map(meta.regions.map((r) => [r.id, r]));
  const porReg = new Map<string, { pageId: string; sql: string | null; entradas: Map<string, string | null> }>();
  const add = (regionId: string | null, pageId: string, entrada: string, label: string | null) => {
    if (!regionId || !entrada) return;
    let e = porReg.get(regionId);
    if (!e) {
      const ri = regInfo.get(regionId);
      e = { pageId, sql: ri?.sql ?? null, entradas: new Map() };
      porReg.set(regionId, e);
    }
    if (!e.entradas.has(entrada)) e.entradas.set(entrada, label);
  };
  for (const i of meta.items) if (i.source && ehColuna(i.sourceType)) add(i.regionId, i.pageId, i.source.trim(), i.label);
  for (const c of meta.reportColumns) add(c.regionId, c.pageId, c.alias, c.label);
  return [...porReg.entries()].map(([regionId, e]) => ({
    regionId,
    pageId: e.pageId,
    sql: e.sql,
    entradas: [...e.entradas.entries()].map(([entrada, label]) => ({ entrada, label })),
  }));
}

/** Mapa de resolução: regionId → (entrada → { table, column }). O que a IA devolve. */
export type ResolucaoColunas = Map<string, Map<string, { table: string | null; column: string | null }>>;

/**
 * Constrói as linhas do `data_dictionary` a partir do metadado + a resolução das colunas:
 * (1) catálogo de COMPONENTES (app/página/região/item/botão/coluna de relatório) e
 * (2) o dicionário de COLUNAS agregado (uma linha por tabela·coluna com a label + todas as
 * labels vistas). É o produto p/ a planilha e a ontologia. Determinístico/testável.
 */
export function construirLinhasDicionario(spaceId: string, meta: ApexAppMeta, resolvido: ResolucaoColunas): LinhaDic[] {
  const linhas: LinhaDic[] = [];
  const appId = meta.app.id || null;
  const resolveDe = (regionId: string | null, entrada: string): { table: string | null; column: string | null } =>
    (regionId && resolvido.get(regionId)?.get(entrada)) || { table: null, column: entrada };

  // Componentes (catálogo — base p/ documentação depois).
  linhas.push({ space_id: spaceId, kind: "apex_app", name: meta.app.name || meta.app.id, label: meta.app.name, source: "apex_dict", app_id: appId });
  for (const p of meta.pages)
    linhas.push({ space_id: spaceId, kind: "apex_page", name: p.name || `P${p.id}`, label: p.title, source: "apex_dict", app_id: appId, page_id: p.id, metadata: { mode: p.mode } });
  for (const g of meta.regions)
    linhas.push({ space_id: spaceId, kind: "apex_region", name: g.name || `R${g.id}`, parent_name: g.pageId, label: g.name, source: "apex_dict", app_id: appId, page_id: g.pageId, metadata: { type: g.type, sql: g.sql } });
  for (const i of meta.items) {
    const rc = ehColuna(i.sourceType) && i.source ? resolveDe(i.regionId, i.source.trim()) : { table: null, column: null };
    linhas.push({ space_id: spaceId, kind: "apex_item", name: i.name, parent_name: i.regionId, label: i.label, db_table: rc.table, db_column: rc.column, source: "apex_dict", app_id: appId, page_id: i.pageId, metadata: { displayAs: i.displayAs, sourceType: i.sourceType } });
  }
  for (const b of meta.buttons) linhas.push({ space_id: spaceId, kind: "apex_button", name: b.name, parent_name: b.pageId, label: b.label, source: "apex_dict", app_id: appId, page_id: b.pageId });
  for (const c of meta.reportColumns) {
    const rc = resolveDe(c.regionId, c.alias);
    linhas.push({ space_id: spaceId, kind: "apex_report_col", name: c.alias, parent_name: c.regionId, label: c.label, db_table: rc.table, db_column: rc.column, source: "apex_dict", app_id: appId, page_id: c.pageId, metadata: { report: c.kind } });
  }

  // Dicionário de COLUNAS agregado (tabela·coluna → labels). É a planilha + a ontologia.
  const colKey = (t: string | null, c: string) => `${(t ?? "").toLowerCase()}|${c.toLowerCase()}`;
  const cols = new Map<string, { table: string | null; column: string; labels: Set<string> }>();
  const registrar = (regionId: string | null, entrada: string, label: string | null) => {
    const rc = resolveDe(regionId, entrada);
    const column = rc.column ?? entrada;
    if (!column) return;
    const k = colKey(rc.table, column);
    let e = cols.get(k);
    if (!e) { e = { table: rc.table, column, labels: new Set() }; cols.set(k, e); }
    if (label && label.trim()) e.labels.add(label.trim());
  };
  for (const i of meta.items) if (i.source && ehColuna(i.sourceType)) registrar(i.regionId, i.source.trim(), i.label);
  for (const c of meta.reportColumns) registrar(c.regionId, c.alias, c.label);
  for (const e of cols.values()) {
    const labels = [...e.labels];
    linhas.push({
      space_id: spaceId,
      kind: "column",
      name: e.column,
      parent_name: e.table,
      db_table: e.table,
      db_column: e.column,
      label: labels[0] ?? null,
      source: "apex_dict",
      app_id: appId,
      metadata: { labels },
    });
  }
  return linhas;
}
