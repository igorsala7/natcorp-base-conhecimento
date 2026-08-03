/**
 * Modelo COMUM de metadados de uma aplicação Oracle APEX — alimentado por duas
 * fontes (dicionário via `pkg_apex_meta.f_app_json`, ou parse do export `f*.sql`)
 * e consumido pelos três produtos: dicionário de dados/ontologia, tradução (XLIFF)
 * e documentação por página. Puro/testável.
 */

export type ApexPage = { id: string; name: string | null; title: string | null; mode: string | null };
export type ApexRegion = { pageId: string; id: string; name: string | null; type: string | null; sql: string | null };
export type ApexItem = {
  pageId: string;
  regionId: string | null;
  name: string;
  label: string | null;
  displayAs: string | null;
  sourceType: string | null;
  source: string | null; // coluna do banco quando sourceType = DB Column
};
export type ApexButton = { pageId: string; name: string; label: string | null };
export type ApexReportCol = { kind: "classic" | "ir" | "ig"; pageId: string; regionId: string | null; alias: string; label: string | null };
export type ApexValidation = { pageId: string; name: string; message: string | null };
export type ApexProcess = { pageId: string; name: string; type: string | null; point: string | null };
export type ApexDynamicAction = { pageId: string; name: string; event: string | null };

export type ApexAppMeta = {
  app: { id: string; name: string | null; alias: string | null };
  pages: ApexPage[];
  regions: ApexRegion[];
  items: ApexItem[];
  buttons: ApexButton[];
  reportColumns: ApexReportCol[];
  breadcrumbs: { pageId: string; label: string | null }[];
  lists: { list: string; label: string | null }[];
  validations: ApexValidation[];
  processes: ApexProcess[];
  dynamicActions: ApexDynamicAction[];
};

const s = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Normaliza o JSON de `pkg_apex_meta.f_app_json` para o modelo interno. `null` se inválido. */
export function normalizarApexJson(raw: unknown): ApexAppMeta | null {
  const r = o(raw);
  if (r.ok === false) return null;
  const app = o(r.app);
  if (!app.id && !arr(r.pages).length) return null;
  return {
    app: { id: String(app.id ?? ""), name: s(app.name), alias: s(app.alias) },
    pages: arr(r.pages).map((x) => { const p = o(x); return { id: String(p.id ?? ""), name: s(p.name), title: s(p.title), mode: s(p.mode) }; }),
    regions: arr(r.regions).map((x) => { const g = o(x); return { pageId: String(g.page_id ?? ""), id: String(g.id ?? ""), name: s(g.name), type: s(g.type), sql: s(g.sql) }; }),
    items: arr(r.items).map((x) => { const i = o(x); return { pageId: String(i.page_id ?? ""), regionId: s(i.region_id), name: String(i.name ?? ""), label: s(i.label), displayAs: s(i.display_as), sourceType: s(i.source_type), source: s(i.source) }; }),
    buttons: arr(r.buttons).map((x) => { const b = o(x); return { pageId: String(b.page_id ?? ""), name: String(b.name ?? ""), label: s(b.label) }; }),
    reportColumns: arr(r.report_columns).map((x) => { const c = o(x); const k = String(c.kind ?? "classic"); return { kind: (k === "ir" || k === "ig" ? k : "classic") as "classic" | "ir" | "ig", pageId: String(c.page_id ?? ""), regionId: s(c.region_id), alias: String(c.alias ?? ""), label: s(c.label) }; }),
    breadcrumbs: arr(r.breadcrumbs).map((x) => { const b = o(x); return { pageId: String(b.page_id ?? ""), label: s(b.label) }; }),
    lists: arr(r.list_entries).map((x) => { const l = o(x); return { list: String(l.list ?? ""), label: s(l.label) }; }),
    validations: arr(r.validations).map((x) => { const v = o(x); return { pageId: String(v.page_id ?? ""), name: String(v.name ?? ""), message: s(v.message) }; }),
    processes: arr(r.processes).map((x) => { const p = o(x); return { pageId: String(p.page_id ?? ""), name: String(p.name ?? ""), type: s(p.type), point: s(p.point) }; }),
    dynamicActions: arr(r.dynamic_actions).map((x) => { const d = o(x); return { pageId: String(d.page_id ?? ""), name: String(d.name ?? ""), event: s(d.event) }; }),
  };
}

export type LabelApex = { id: string; source: string; contexto: string };

/** TODAS as labels traduzíveis da app (para a tradução/XLIFF e a ontologia), com um id
 *  estável por componente e um rótulo de contexto legível. Deduplica por id. */
export function labelsDeApex(meta: ApexAppMeta): LabelApex[] {
  const out: LabelApex[] = [];
  const push = (id: string, source: string | null, contexto: string) => {
    if (source && source.trim()) out.push({ id, source: source.trim(), contexto });
  };
  for (const p of meta.pages) push(`page.${p.id}.title`, p.title, `Página ${p.id} (título)`);
  for (const g of meta.regions) push(`region.${g.pageId}.${g.id}`, g.name, `Região (pág. ${g.pageId})`);
  for (const i of meta.items) push(`item.${i.pageId}.${i.name}`, i.label, `Campo ${i.name} (pág. ${i.pageId})`);
  for (const b of meta.buttons) push(`button.${b.pageId}.${b.name}`, b.label, `Botão ${b.name} (pág. ${b.pageId})`);
  for (const c of meta.reportColumns) push(`col.${c.pageId}.${c.regionId ?? "r"}.${c.alias}`, c.label, `Coluna ${c.alias} (${c.kind}, pág. ${c.pageId})`);
  for (const [n, b] of meta.breadcrumbs.entries()) push(`bc.${b.pageId}.${n}`, b.label, `Breadcrumb (pág. ${b.pageId})`);
  for (const [n, l] of meta.lists.entries()) push(`list.${l.list}.${n}`, l.label, `Menu ${l.list}`);
  // Dedup por id (o 1º vence).
  const vistos = new Set<string>();
  return out.filter((x) => (vistos.has(x.id) ? false : (vistos.add(x.id), true)));
}

/** Mapa DIRETO item→coluna→label: itens cujo source é uma coluna do banco (DB Column).
 *  A tabela vem da região (form). Os relatórios (alias→coluna via SELECT) são resolvidos
 *  DEPOIS por IA na ingestão. Determinístico. */
export function mapaColunaLabelDireto(meta: ApexAppMeta): { pageId: string; item: string; column: string; label: string | null; regionId: string | null }[] {
  const ehColuna = (st: string | null) => !!st && /db\s*column|column|coluna/i.test(st);
  return meta.items
    .filter((i) => i.source && ehColuna(i.sourceType))
    .map((i) => ({ pageId: i.pageId, item: i.name, column: i.source!.trim(), label: i.label, regionId: i.regionId }));
}
