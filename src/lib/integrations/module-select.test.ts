import { describe, it, expect } from "vitest";
import { toolNoRecorte, vocabularioDeModulos, filtrarContraVocab, pareceComposta, type ModuleTag } from "./module-match";

const tag = (modulo: string, submodulo: string | null = null): ModuleTag => ({ modulo, submodulo });

describe("pareceComposta (rede do recorte p/ pergunta com vários assuntos)", () => {
  it("detecta 2+ perguntas (2 '?')", () => {
    expect(pareceComposta("Esses colaboradores estão com férias desde 2023? E quais os últimos 5 cargos de cada um?")).toBe(true);
  });
  it("detecta conectivo de adição", () => {
    expect(pareceComposta("Traga o saldo de horas e também o histórico de cargos")).toBe(true);
    expect(pareceComposta("Quero as férias, além disso os últimos afastamentos")).toBe(true);
  });
  it("pergunta simples (1 assunto) → false", () => {
    expect(pareceComposta("Qual o saldo de horas do colaborador 345?")).toBe(false);
    expect(pareceComposta("Liste as férias de 2023")).toBe(false);
    expect(pareceComposta("")).toBe(false);
  });
});

describe("vocabularioDeModulos", () => {
  it("agrupa submódulos por módulo e deduplica (case/acento-insensível na chave)", () => {
    const v = vocabularioDeModulos([
      tag("Frequência", "Consultas"),
      tag("FREQUÊNCIA", "Lançamentos"),
      tag("Frequência", "Consultas"),
      tag("Folha", null),
    ]);
    expect(v).toHaveLength(2);
    const freq = v.find((x) => x.modulo.toLowerCase() === "frequência")!;
    expect(freq.submodulos).toEqual(["Consultas", "Lançamentos"]);
    const folha = v.find((x) => x.modulo === "Folha")!;
    expect(folha.submodulos).toEqual([]);
  });

  it("ignora módulo vazio", () => {
    expect(vocabularioDeModulos([tag("  ", "x"), tag("Folha")])).toHaveLength(1);
  });
});

describe("toolNoRecorte", () => {
  const tags = [tag("Frequência", "Frequência > Consultas")];

  it("casa quando o módulo inteiro é selecionado (submódulo null)", () => {
    expect(toolNoRecorte(tags, [tag("Frequência", null)])).toBe(true);
  });

  it("casa submódulo exato (ignorando caixa/espaços)", () => {
    expect(toolNoRecorte(tags, [tag("frequência", "frequência  >  consultas")])).toBe(true);
  });

  it("casa quando o selecionado é ANCESTRAL do caminho da tool", () => {
    expect(toolNoRecorte(tags, [tag("Frequência", "Frequência")])).toBe(true);
  });

  it("casa quando o selecionado é DESCENDENTE (tool serve o pai)", () => {
    const toolPai = [tag("Frequência", "Frequência")];
    expect(toolNoRecorte(toolPai, [tag("Frequência", "Frequência > Consultas")])).toBe(true);
  });

  it("tool que serve o módulo inteiro (submódulo null) casa qualquer submódulo dele", () => {
    expect(toolNoRecorte([tag("Frequência", null)], [tag("Frequência", "Frequência > X")])).toBe(true);
  });

  it("NÃO casa módulo diferente", () => {
    expect(toolNoRecorte(tags, [tag("Folha", null)])).toBe(false);
  });

  it("NÃO casa submódulo irmão (mesmo módulo, ramo diferente)", () => {
    expect(toolNoRecorte(tags, [tag("Frequência", "Frequência > Lançamentos")])).toBe(false);
  });

  it("sem seleção → não casa (o chamador trata [] como fallback)", () => {
    expect(toolNoRecorte(tags, [])).toBe(false);
  });
});

describe("filtrarContraVocab", () => {
  const vocab = [tag("Frequência", "Frequência > Consultas"), tag("Folha", "Folha > Férias")];

  it("descarta módulo alucinado", () => {
    expect(filtrarContraVocab([tag("Inexistente", null)], vocab)).toEqual([]);
  });

  it("rebaixa submódulo desconhecido para o módulo inteiro (widening seguro)", () => {
    const r = filtrarContraVocab([tag("Frequência", "Frequência > Nao Existe")], vocab);
    expect(r).toEqual([{ modulo: "Frequência", submodulo: null }]);
  });

  it("mantém submódulo conhecido e deduplica", () => {
    const r = filtrarContraVocab(
      [tag("Frequência", "Frequência > Consultas"), tag("Frequência", "Frequência > Consultas")],
      vocab,
    );
    expect(r).toEqual([{ modulo: "Frequência", submodulo: "Frequência > Consultas" }]);
  });
});
