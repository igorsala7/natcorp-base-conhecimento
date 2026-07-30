import { describe, it, expect } from "vitest";
import { parseModulosPayload, dedupModulos } from "./module-parse";

describe("parseModulosPayload", () => {
  it("módulo sem submódulo (sub_modulo null) vira uma linha raiz", () => {
    const r = parseModulosPayload({ items: [{ modulo: "ACESSOS", sub_modulo: null }] });
    expect(r).toEqual([{ modulo: "ACESSOS", submodulo: null }]);
  });

  it("quebra a lista de submódulos por ';' e normaliza o caminho '>'", () => {
    const r = parseModulosPayload({
      items: [{ modulo: "ESOCIAL", sub_modulo: "ARQUIVOS;CADASTROS;IMPORTAÇÃO" }],
    });
    expect(r).toEqual([
      { modulo: "ESOCIAL", submodulo: "ARQUIVOS" },
      { modulo: "ESOCIAL", submodulo: "CADASTROS" },
      { modulo: "ESOCIAL", submodulo: "IMPORTAÇÃO" },
    ]);
  });

  it("preserva e normaliza caminhos hierárquicos multi-nível", () => {
    const r = parseModulosPayload({
      items: [
        {
          modulo: "ADMINISTRAÇÃO DE PESSOAL",
          sub_modulo:
            "CONTROLE DE FREQUENCIA > FREQUENCIA > CONSULTAS;FOLHA DE PAGAMENTO>FÉRIAS",
        },
      ],
    });
    expect(r).toEqual([
      { modulo: "ADMINISTRAÇÃO DE PESSOAL", submodulo: "CONTROLE DE FREQUENCIA > FREQUENCIA > CONSULTAS" },
      { modulo: "ADMINISTRAÇÃO DE PESSOAL", submodulo: "FOLHA DE PAGAMENTO > FÉRIAS" },
    ]);
  });

  it("ignora item sem módulo e partes vazias do split", () => {
    const r = parseModulosPayload({ items: [{ modulo: "", sub_modulo: "X" }, { modulo: "A", sub_modulo: "B;;C;" }] });
    expect(r).toEqual([
      { modulo: "A", submodulo: "B" },
      { modulo: "A", submodulo: "C" },
    ]);
  });

  it("payload sem items → vazio", () => {
    expect(parseModulosPayload({})).toEqual([]);
    expect(parseModulosPayload(null)).toEqual([]);
  });
});

describe("dedupModulos", () => {
  it("remove (modulo, submodulo) repetidos entre páginas/items (case-insensível)", () => {
    const r = dedupModulos([
      { modulo: "APOIO", submodulo: null },
      { modulo: "apoio", submodulo: null },
      { modulo: "APOIO", submodulo: "APLICAÇÕES" },
    ]);
    expect(r).toEqual([
      { modulo: "APOIO", submodulo: null },
      { modulo: "APOIO", submodulo: "APLICAÇÕES" },
    ]);
  });
});
