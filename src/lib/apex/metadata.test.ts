import { describe, it, expect } from "vitest";
import { normalizarApexJson, labelsDeApex, mapaColunaLabelDireto } from "./metadata";

const RAW = {
  app: { id: 100, name: "RH NATCORP", alias: "RH" },
  pages: [{ id: 10, name: "Empresas", title: "Cadastro de Empresas", mode: "NORMAL" }],
  regions: [{ page_id: 10, id: 1, name: "Empresa", type: "FORM", sql: "select cod_empresa, nome from empresas" }],
  items: [
    { page_id: 10, region_id: 1, name: "P10_COD_EMPRESA", label: "Id. Empresa", display_as: "TEXT", source_type: "DB Column", source: "COD_EMPRESA" },
    { page_id: 10, region_id: 1, name: "P10_NOME", label: "Nome da Empresa", display_as: "TEXT", source_type: "DB Column", source: "NOME" },
    { page_id: 10, region_id: null, name: "P10_BUSCA", label: "Buscar", display_as: "TEXT", source_type: "Static", source: null },
  ],
  buttons: [{ page_id: 10, name: "SALVAR", label: "Salvar" }],
  report_columns: [{ kind: "ir", page_id: 20, region_id: 5, alias: "NOME_COLAB", label: "Nome do Colaborador" }],
  breadcrumbs: [{ page_id: 10, label: "Empresas" }],
  list_entries: [{ list: "MENU", label: "Início" }],
  validations: [{ page_id: 10, name: "V_NOME", message: "Informe o nome." }],
  processes: [{ page_id: 10, name: "SALVA", type: "DML", point: "SUBMIT" }],
  dynamic_actions: [{ page_id: 10, name: "DA_MOSTRA", event: "change" }],
};

describe("normalizarApexJson", () => {
  it("normaliza o JSON do pacote para o modelo interno", () => {
    const m = normalizarApexJson(RAW)!;
    expect(m.app).toEqual({ id: "100", name: "RH NATCORP", alias: "RH" });
    expect(m.pages).toHaveLength(1);
    expect(m.items).toHaveLength(3);
    expect(m.items[0]).toMatchObject({ name: "P10_COD_EMPRESA", label: "Id. Empresa", source: "COD_EMPRESA", sourceType: "DB Column" });
    expect(m.reportColumns[0]).toMatchObject({ kind: "ir", alias: "NOME_COLAB", label: "Nome do Colaborador" });
  });
  it("erro do pacote ({ok:false}) → null", () => {
    expect(normalizarApexJson({ ok: false, erro: "x" })).toBeNull();
  });
});

describe("labelsDeApex", () => {
  it("reúne TODAS as labels traduzíveis com id estável, deduplicando", () => {
    const labels = labelsDeApex(normalizarApexJson(RAW)!);
    const map = Object.fromEntries(labels.map((l) => [l.id, l.source]));
    expect(map["item.10.P10_COD_EMPRESA"]).toBe("Id. Empresa");
    expect(map["button.10.SALVAR"]).toBe("Salvar");
    expect(map["col.20.5.NOME_COLAB"]).toBe("Nome do Colaborador");
    expect(map["page.10.title"]).toBe("Cadastro de Empresas");
    // itens sem label não entram
    expect(labels.some((l) => l.id === "item.10.P10_BUSCA")).toBe(true); // tem label "Buscar"
  });
});

describe("mapaColunaLabelDireto", () => {
  it("mapeia itens com source de COLUNA do banco → coluna + label", () => {
    const mapa = mapaColunaLabelDireto(normalizarApexJson(RAW)!);
    expect(mapa).toHaveLength(2); // só os 2 DB Column (P10_BUSCA é Static)
    expect(mapa[0]).toMatchObject({ item: "P10_COD_EMPRESA", column: "COD_EMPRESA", label: "Id. Empresa" });
  });
});
