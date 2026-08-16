/**
 * O DUMP DAS VIEWS DO APEX, traduzido para o formato do `pkg_apex_meta`.
 *
 * Existem dois jeitos de extrair o metadado de uma aplicação APEX, e este
 * projeto só entendia um deles:
 *
 *  · `pkg_apex_meta.f_app_json` devolve `{app, pages, regions, items, …}` com
 *    chaves minúsculas — é o que o normalizador esperava;
 *  · consultar as views do dicionário (`APEX_APPLICATION_PAGES`,
 *    `APEX_APPLICATION_PAGE_ITEMS`…) devolve os nomes NATIVOS das colunas, em
 *    MAIÚSCULA, numa coleção por view.
 *
 * O `f200.json` real é o segundo. E o defeito era silencioso da pior forma: o
 * array `pages` existe nos dois formatos, então o normalizador casava os 281
 * registros e lia todos os CAMPOS vazios — `id: ""`, `name: null`. O job
 * terminava com status `done` e zero achados, sem erro nenhum. Parecia que a
 * aplicação não tinha conteúdo.
 *
 * ── O que se perdia ─────────────────────────────────────────────────────────
 * Justamente o que se queria: `database_items` (1.229 no arquivo real) é a
 * única coleção que liga ITEM DE TELA a COLUNA e TABELA. Sem ela, o dicionário
 * fica com o nome do banco e sem o vocabulário humano — a metade que o APEX
 * tinha para dar.
 *
 * Puro e sem IO.
 */

type Bruto = Record<string, unknown>;

const txt = (v: unknown): string => (v == null ? "" : String(v));
const nulo = (v: unknown): string | null => {
  const s = txt(v).trim();
  return s === "" ? null : s;
};
const lista = (v: unknown): Bruto[] => (Array.isArray(v) ? (v as Bruto[]) : []);

/**
 * É o dump de views?
 *
 * Duas condições, e as duas importam. A presença de uma coleção com nome de
 * view (`page_items`, `database_items`) diz que veio de lá. E a AUSÊNCIA de
 * `items` evita converter um arquivo que já está no formato certo e por acaso
 * carrega as duas coisas.
 */
export function ehDumpDeViews(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Bruto;
  if (Array.isArray(r.items)) return false;
  return Array.isArray(r.page_items) || Array.isArray(r.database_items) || Array.isArray(r.interactive_report_columns);
}

/**
 * Converte para a forma que `normalizarApexJson` entende.
 *
 * O `region_id` é a chave que amarra item a região, e as views o expõem com
 * nomes diferentes conforme a origem — `REGION_ID` nas colunas de IR, só
 * `REGION` (o nome, não o id) nos itens de banco. Onde só há o nome, ele é o
 * que temos, e serve: o normalizador o usa como rótulo de agrupamento.
 */
export function converterDumpDeViews(raw: unknown): Record<string, unknown> {
  const r = (raw ?? {}) as Bruto;
  const app = lista(r.application)[0] ?? {};

  /**
   * O rótulo do item de tela.
   *
   * As views de item não trazem label — ele vive nas colunas de relatório
   * (`REPORT_LABEL`/`FORM_LABEL`) e nas de grade (`LABEL`). O casamento é por
   * ALIAS: a coluna `COD_CCUSTO` do relatório é o mesmo campo que o item
   * `P10_COD_CCUSTO` da tela. Sem esse cruzamento, o APEX entrega estrutura sem
   * vocabulário — que é o oposto do que ele tem de melhor a oferecer.
   */
  const labelPorAlias = new Map<string, string>();
  const registra = (alias: unknown, label: unknown) => {
    const a = txt(alias).trim().toUpperCase();
    const l = nulo(label);
    if (a && l && !labelPorAlias.has(a)) labelPorAlias.set(a, l);
  };
  for (const c of lista(r.interactive_report_columns)) registra(c.COLUMN_ALIAS, c.REPORT_LABEL ?? c.FORM_LABEL);
  for (const c of lista(r.classic_report_columns)) registra(c.COLUMN_ALIAS, c.HEADING);
  for (const c of lista(r.interactive_grid_columns)) registra(c.NAME, c.LABEL);

  /** Item → coluna/tabela, pelo nome do item. É o que `database_items` sabe. */
  const bancoPorItem = new Map<string, { coluna: string | null; tabela: string | null }>();
  for (const d of lista(r.database_items)) {
    const nome = txt(d.ITEM_NAME).trim().toUpperCase();
    if (nome) bancoPorItem.set(nome, { coluna: nulo(d.DB_COLUMN_NAME), tabela: nulo(d.DB_TABLE_NAME) });
  }

  /** O sufixo do item (`P10_COD_CCUSTO` → `COD_CCUSTO`) é o alias provável. */
  const aliasDoItem = (nome: string): string => nome.replace(/^P\d+_/i, "").toUpperCase();

  const items = lista(r.page_items).map((i) => {
    const nome = txt(i.ITEM_NAME);
    const db = bancoPorItem.get(nome.toUpperCase());
    return {
      page_id: txt(i.PAGE_ID),
      region_id: nulo(i.REGION),
      name: nome,
      // O label vem do relatório que mostra a mesma coluna; sem ele, nada —
      // inventar a partir do nome do item produziria "P10 COD CCUSTO", que é
      // ruído com aparência de informação.
      label: labelPorAlias.get(aliasDoItem(nome)) ?? null,
      display_as: nulo(i.DISPLAY_AS),
      source_type: nulo(i.ITEM_SOURCE_TYPE),
      source: db?.tabela && db?.coluna ? `${db.tabela}.${db.coluna}` : nulo(i.ITEM_SOURCE),
    };
  });

  // Itens de banco que não aparecem em `page_items` (é comum) entram assim
  // mesmo: eles são a razão de ser desta conversão.
  const jaTem = new Set(items.map((i) => i.name.toUpperCase()));
  for (const d of lista(r.database_items)) {
    const nome = txt(d.ITEM_NAME);
    if (!nome || jaTem.has(nome.toUpperCase())) continue;
    items.push({
      page_id: txt(d.PAGE_ID),
      region_id: nulo(d.REGION),
      name: nome,
      label: labelPorAlias.get(aliasDoItem(nome)) ?? null,
      display_as: nulo(d.DISPLAY_AS),
      source_type: null,
      source: nulo(d.DB_TABLE_NAME) && nulo(d.DB_COLUMN_NAME) ? `${txt(d.DB_TABLE_NAME)}.${txt(d.DB_COLUMN_NAME)}` : null,
    });
  }

  const reportColumns = [
    ...lista(r.interactive_report_columns).map((c) => ({
      kind: "ir",
      page_id: txt(c.PAGE_ID),
      region_id: nulo(c.REGION_ID) ?? nulo(c.REGION_NAME),
      alias: txt(c.COLUMN_ALIAS),
      label: nulo(c.REPORT_LABEL) ?? nulo(c.FORM_LABEL),
    })),
    ...lista(r.classic_report_columns).map((c) => ({
      kind: "classic",
      page_id: txt(c.PAGE_ID),
      region_id: nulo(c.REGION_NAME),
      alias: txt(c.COLUMN_ALIAS),
      label: nulo(c.HEADING),
    })),
    ...lista(r.interactive_grid_columns).map((c) => ({
      kind: "ig",
      page_id: txt(c.PAGE_ID),
      region_id: nulo(c.REGION_ID) ?? nulo(c.REGION_NAME),
      alias: txt(c.NAME),
      label: nulo(c.LABEL),
    })),
  ];

  return {
    app: {
      id: txt(app.APPLICATION_ID ?? r.application_id),
      name: nulo(app.APPLICATION_NAME),
      alias: nulo(app.ALIAS),
    },
    pages: lista(r.pages).map((p) => ({
      id: txt(p.PAGE_ID),
      name: nulo(p.PAGE_NAME),
      title: nulo(p.PAGE_TITLE),
      mode: nulo(p.PAGE_MODE),
    })),
    regions: lista(r.regions).map((g) => ({
      page_id: txt(g.PAGE_ID),
      id: txt(g.REGION_ID ?? g.REGION_NAME),
      name: nulo(g.REGION_NAME),
      type: nulo(g.SOURCE_TYPE ?? g.TEMPLATE),
      sql: nulo(g.REGION_SOURCE),
    })),
    items,
    report_columns: reportColumns,
    processes: lista(r.page_processes).map((p) => ({
      page_id: txt(p.PAGE_ID),
      name: txt(p.PROCESS_NAME),
      type: nulo(p.PROCESS_TYPE),
      point: nulo(p.PROCESS_POINT),
    })),
  };
}
