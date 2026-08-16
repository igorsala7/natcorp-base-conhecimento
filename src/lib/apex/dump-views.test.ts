import { describe, it, expect } from "vitest";
import { ehDumpDeViews, converterDumpDeViews } from "./dump-views";
import { normalizarApexJson } from "./metadata";

/** Um recorte do f200.json real, com as chaves como as views as entregam. */
const DUMP = {
  application: [{ APPLICATION_ID: 200, APPLICATION_NAME: "Painel do Operador", ALIAS: "PO_NATCORP" }],
  pages: [{ PAGE_ID: 4, PAGE_NAME: "Apuração", PAGE_TITLE: "Apuração - Evento", PAGE_MODE: "Normal" }],
  regions: [{ PAGE_ID: 4, REGION_NAME: "Evento Atual", TEMPLATE: "Standard" }],
  page_items: [
    { PAGE_ID: 4, ITEM_NAME: "P4_TIPO_EVENTO", DISPLAY_AS: "Select List", REGION: "Evento Atual" },
    { PAGE_ID: 4, ITEM_NAME: "P4_SEM_BANCO", DISPLAY_AS: "Text", REGION: "Evento Atual" },
  ],
  database_items: [
    { PAGE_ID: 4, ITEM_NAME: "P4_TIPO_EVENTO", DB_COLUMN_NAME: "TIPO_EVENTO", DB_TABLE_NAME: "PE_RESULTADO_APURACAO", REGION: "Evento Atual" },
    // Item de banco que NÃO aparece em page_items — é comum, e é a razão de ser
    // da conversão: ele carrega a ligação coluna↔tabela.
    { PAGE_ID: 9, ITEM_NAME: "P9_COD", DB_COLUMN_NAME: "COD", DB_TABLE_NAME: "CENTRO_DE_CUSTO", REGION: "Filtro" },
  ],
  interactive_report_columns: [
    { PAGE_ID: 4, COLUMN_ALIAS: "TIPO_EVENTO", REPORT_LABEL: "Tipo de Evento Atual", REGION_ID: 123 },
    { PAGE_ID: 9, COLUMN_ALIAS: "COD", REPORT_LABEL: "Código", REGION_ID: 456 },
  ],
};

describe("dump das views do APEX", () => {
  it("reconhece o dump e não confunde com o formato do pkg_apex_meta", () => {
    expect(ehDumpDeViews(DUMP)).toBe(true);
    // Formato certo: tem `items`, e não deve ser convertido.
    expect(ehDumpDeViews({ app: {}, pages: [], items: [] })).toBe(false);
    expect(ehDumpDeViews(null)).toBe(false);
  });

  it("lê os campos que o normalizador antigo devolvia VAZIOS", () => {
    // O defeito: `pages` existe nos dois formatos, então o normalizador casava
    // os 281 registros e lia id:"" e name:null. Job terminava done, 0 achados.
    const m = normalizarApexJson(DUMP);
    expect(m?.app).toEqual({ id: "200", name: "Painel do Operador", alias: "PO_NATCORP" });
    expect(m?.pages[0]).toMatchObject({ id: "4", name: "Apuração", title: "Apuração - Evento" });
  });

  it("liga o item à TABELA e à COLUNA — o que se perdia por inteiro", () => {
    const m = normalizarApexJson(DUMP);
    const item = m?.items.find((i) => i.name === "P4_TIPO_EVENTO");
    expect(item?.source).toBe("PE_RESULTADO_APURACAO.TIPO_EVENTO");
  });

  it("traz o item de banco que não está em page_items", () => {
    const m = normalizarApexJson(DUMP);
    const cc = m?.items.find((i) => i.name === "P9_COD");
    expect(cc?.source).toBe("CENTRO_DE_CUSTO.COD");
  });

  it("casa o LABEL pelo alias, tirando o prefixo da página", () => {
    // `P4_TIPO_EVENTO` na tela é a coluna `TIPO_EVENTO` no relatório. Sem esse
    // cruzamento o APEX entrega estrutura sem vocabulário.
    const m = normalizarApexJson(DUMP);
    expect(m?.items.find((i) => i.name === "P4_TIPO_EVENTO")?.label).toBe("Tipo de Evento Atual");
    expect(m?.items.find((i) => i.name === "P9_COD")?.label).toBe("Código");
  });

  it("item sem label fica sem label, e não com o nome maquiado", () => {
    // "P4 SEM BANCO" seria ruído com aparência de informação.
    const m = normalizarApexJson(DUMP);
    expect(m?.items.find((i) => i.name === "P4_SEM_BANCO")?.label).toBeNull();
  });

  it("junta as colunas dos três tipos de relatório", () => {
    const m = converterDumpDeViews({
      ...DUMP,
      classic_report_columns: [{ PAGE_ID: 1, COLUMN_ALIAS: "NOME", HEADING: "Nome" }],
      interactive_grid_columns: [{ PAGE_ID: 2, NAME: "VALOR", LABEL: "Valor" }],
    }) as { report_columns: { kind: string }[] };
    expect(m.report_columns.map((c) => c.kind).sort()).toEqual(["classic", "ig", "ir", "ir"]);
  });
});
