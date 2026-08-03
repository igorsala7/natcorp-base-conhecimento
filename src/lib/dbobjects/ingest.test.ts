import { describe, it, expect } from "vitest";
import { normalizarDbJson, contextoObjetoDb } from "./metadata";
import { construirLinhasDb } from "./ingest";

const meta = normalizarDbJson({
  tables: [
    { name: "empresas", comment: "Cadastro de empresas", columns: [
      { name: "cod_empresa", type: "NUMBER", nullable: "N", comment: "Código da empresa" },
      { name: "nome", type: "VARCHAR2(100)", nullable: "Y", comment: "Razão social" },
    ] },
  ],
  views: [{ name: "vw_colab", comment: "Colaboradores ativos", text: "select * from dados_funcionais where situacao='A'" }],
  code: [{ name: "TRG_EMPRESAS_BI", kind: "trigger", table: "EMPRESAS", source: "begin :new.cod := seq.nextval; end;" }],
})!;

describe("normalizarDbJson", () => {
  it("normaliza tabelas/colunas/views/code (nomes em MAIÚSCULO, nullable Y/N)", () => {
    expect(meta.tables[0]).toMatchObject({ name: "EMPRESAS", comment: "Cadastro de empresas" });
    expect(meta.tables[0]!.columns[0]).toMatchObject({ name: "COD_EMPRESA", nullable: false, comment: "Código da empresa" });
    expect(meta.tables[0]!.columns[1]!.nullable).toBe(true);
    expect(meta.views[0]!.name).toBe("VW_COLAB");
    expect(meta.code[0]).toMatchObject({ name: "TRG_EMPRESAS_BI", kind: "trigger", table: "EMPRESAS" });
  });
  it("vazio → null", () => {
    expect(normalizarDbJson({ tables: [], views: [], code: [] })).toBeNull();
  });
});

describe("construirLinhasDb", () => {
  it("gera table + column (com db_table/db_column e label) + view + trigger", () => {
    const linhas = construirLinhasDb("sp1", meta);
    expect(linhas.find((l) => l.kind === "table" && l.name === "EMPRESAS")).toBeTruthy();
    const col = linhas.find((l) => l.kind === "column" && l.db_column === "COD_EMPRESA")!;
    expect(col).toMatchObject({ db_table: "EMPRESAS", label: "Código da empresa" });
    expect(linhas.find((l) => l.kind === "view" && l.name === "VW_COLAB")).toBeTruthy();
    expect(linhas.find((l) => l.kind === "trigger" && l.name === "TRG_EMPRESAS_BI")).toBeTruthy();
  });
});

describe("contextoObjetoDb", () => {
  it("monta o contexto de uma tabela com as colunas e comentários", () => {
    const ctx = contextoObjetoDb(meta, "table", "EMPRESAS");
    expect(ctx).toContain("TABELA EMPRESAS");
    expect(ctx).toContain("COD_EMPRESA");
    expect(ctx).toContain("Código da empresa");
  });
});
