import { describe, it, expect } from "vitest";
import { normalizarApexJson } from "./metadata";
import { colunasParaResolver, construirLinhasDicionario, type ResolucaoColunas } from "./ingest";

const meta = normalizarApexJson({
  app: { id: 100, name: "RH", alias: "RH" },
  pages: [{ id: 10, name: "Empresas", title: "Cadastro de Empresas" }],
  regions: [
    { page_id: 10, id: 1, name: "Empresa", type: "FORM", sql: "empresas" },
    { page_id: 20, id: 5, name: "Colab", type: "IR", sql: "select e.cod_empresa, e.nome, f.id_colab, f.nome_colab from empresas e, dados_funcionais f where e.cod_empresa = f.cod_empresa" },
  ],
  items: [{ page_id: 10, region_id: 1, name: "P10_COD_EMPRESA", label: "Id. Empresa", source_type: "DB Column", source: "COD_EMPRESA" }],
  buttons: [{ page_id: 10, name: "SALVAR", label: "Salvar" }],
  report_columns: [
    { kind: "ir", page_id: 20, region_id: 5, alias: "COD_EMPRESA", label: "Id. Empresa" },
    { kind: "ir", page_id: 20, region_id: 5, alias: "NOME_COLAB", label: "Nome do Colaborador" },
  ],
})!;

describe("colunasParaResolver", () => {
  it("agrupa por região as colunas/aliases a resolver + a SQL da região", () => {
    const r = colunasParaResolver(meta);
    const reg5 = r.find((x) => x.regionId === "5")!;
    expect(reg5.sql).toContain("dados_funcionais");
    expect(reg5.entradas.map((e) => e.entrada).sort()).toEqual(["COD_EMPRESA", "NOME_COLAB"]);
    const reg1 = r.find((x) => x.regionId === "1")!;
    expect(reg1.entradas[0]).toMatchObject({ entrada: "COD_EMPRESA", label: "Id. Empresa" });
  });
});

describe("origem que já diz tabela E coluna", () => {
  /**
   * O dump das views traz `DB_TABLE_NAME`+`DB_COLUMN_NAME`, e `dump-views.ts` os
   * junta em `TABELA.COLUNA`. Sem partir de volta, o job gravava
   * `db_table: null` e `db_column: "PE_RESULTADO_APURACAO.TIPO_EVENTO"` — a
   * coluna inteira dentro do campo da coluna. No f200.json real isso era 0 de
   * 2.481 colunas com tabela; depois do conserto, 1.163.
   */
  const comPonto = normalizarApexJson({
    app: { id: 1, name: "X", alias: "X" },
    pages: [{ id: 4, name: "Apuração", title: "Apuração" }],
    regions: [{ page_id: 4, id: 9, name: "Evento", type: "FORM", sql: null }],
    items: [
      { page_id: 4, region_id: 9, name: "P4_TIPO", label: "Tipo de Evento", source_type: "Database Column", source: "PE_RESULTADO_APURACAO.TIPO_EVENTO" },
    ],
    report_columns: [],
  })!;

  it("parte TABELA.COLUNA sem precisar da IA", () => {
    const col = construirLinhasDicionario("sp1", comPonto, new Map()).find((l) => l.kind === "column")!;
    expect(col).toMatchObject({ db_table: "PE_RESULTADO_APURACAO", db_column: "TIPO_EVENTO", label: "Tipo de Evento" });
  });

  it("a resolução da IA continua vencendo quando existe", () => {
    // Quem leu o SQL da região sabe mais que o ponto do alias.
    const r: ResolucaoColunas = new Map([["9", new Map([["PE_RESULTADO_APURACAO.TIPO_EVENTO", { table: "OUTRA", column: "TIPO" }]])]]);
    const col = construirLinhasDicionario("sp1", comPonto, r).find((l) => l.kind === "column")!;
    expect(col).toMatchObject({ db_table: "OUTRA", db_column: "TIPO" });
  });

  it("alias sem origem fica intacto, e não vira metade vazia", () => {
    const semOrigem = normalizarApexJson({
      app: { id: 1, name: "X", alias: "X" },
      pages: [{ id: 4, name: "P", title: "P" }],
      regions: [{ page_id: 4, id: 9, name: "R", type: "IR", sql: null }],
      items: [],
      report_columns: [{ kind: "ir", page_id: 4, region_id: 9, alias: "MATRICULA", label: "Matrícula" }],
    })!;
    const col = construirLinhasDicionario("sp1", semOrigem, new Map()).find((l) => l.kind === "column")!;
    expect(col).toMatchObject({ db_table: null, db_column: "MATRICULA" });
  });
});

describe("construirLinhasDicionario", () => {
  const resolvido: ResolucaoColunas = new Map([
    ["1", new Map([["COD_EMPRESA", { table: "EMPRESAS", column: "COD_EMPRESA" }]])],
    ["5", new Map([
      ["COD_EMPRESA", { table: "EMPRESAS", column: "COD_EMPRESA" }],
      ["NOME_COLAB", { table: "DADOS_FUNCIONAIS", column: "NOME_COLAB" }],
    ])],
  ]);

  it("gera catálogo de componentes + dicionário de colunas agregado", () => {
    const linhas = construirLinhasDicionario("sp1", meta, resolvido);
    // componentes
    expect(linhas.some((l) => l.kind === "apex_app")).toBe(true);
    expect(linhas.some((l) => l.kind === "apex_item" && l.name === "P10_COD_EMPRESA" && l.db_table === "EMPRESAS")).toBe(true);
    expect(linhas.some((l) => l.kind === "apex_button" && l.label === "Salvar")).toBe(true);
    // colunas agregadas: COD_EMPRESA (label "Id. Empresa") e NOME_COLAB
    const colunas = linhas.filter((l) => l.kind === "column");
    const cod = colunas.find((c) => c.db_column === "COD_EMPRESA")!;
    expect(cod).toMatchObject({ db_table: "EMPRESAS", label: "Id. Empresa" });
    expect(colunas.find((c) => c.db_column === "NOME_COLAB")).toMatchObject({ db_table: "DADOS_FUNCIONAIS", label: "Nome do Colaborador" });
  });

  it("sem resolução, cai para o alias como coluna (table nula)", () => {
    const linhas = construirLinhasDicionario("sp1", meta, new Map());
    const cod = linhas.find((l) => l.kind === "column" && l.db_column === "COD_EMPRESA");
    expect(cod?.db_table).toBeNull();
  });
});
