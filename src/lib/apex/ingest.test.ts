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
