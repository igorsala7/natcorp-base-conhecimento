import { describe, it, expect } from "vitest";
import { escopoDoPainel, aplicarEscopoParams } from "./panel-scope";
import type { ToolParam } from "./tools";

/**
 * O Painel do Candidato manda o MESMO p_portal e p_perfil do colaborador
 * (12/08/2026): quem separa é `tipoDeAcesso`. Como o catálogo de RH foi
 * cadastrado quando candidato não existia, silêncio no cadastro precisa
 * significar NÃO para ele — o contrário do que vale para os outros painéis.
 */
describe("escopoDoPainel — candidato", () => {
  it("sem PCAND no cadastro, a ferramenta é bloqueada", () => {
    expect(escopoDoPainel({ PO: "todos", PG: "equipe", PC: "proprios" }, "PC", true)).toBe("nenhum");
    expect(escopoDoPainel(null, "PC", true)).toBe("nenhum");
  });

  it("com PCAND, vale o que o cadastro declarou", () => {
    expect(escopoDoPainel({ PCAND: "proprios" }, "PC", true)).toBe("proprios");
  });

  it("o portal do token não afrouxa o candidato", () => {
    // Mesmo chegando como Operador (o painel manda o perfil do colaborador, e
    // ele pode ser MASTER), candidato continua preso ao PCAND.
    expect(escopoDoPainel({ PO: "todos", PCAND: "proprios" }, "PO", true)).toBe("proprios");
  });

  it("para quem não é candidato, nada muda", () => {
    expect(escopoDoPainel({ PC: "proprios" }, "PC", false)).toBe("proprios");
    expect(escopoDoPainel({ PO: "todos" }, "PO")).toBe("todos");
    expect(escopoDoPainel({ PC: "proprios" }, "PO")).toBe("todos"); // ausente = todos
  });
});

describe("aplicarEscopoParams — o código do candidato vem da identidade", () => {
  it("'proprios' tira o cod_candidato das mãos do modelo", () => {
    const params = [
      { nome: "cod_candidato", origem: "modelo", local: "query", tipo: "string", obrigatorio: false },
    ] as unknown as ToolParam[];
    const [p] = aplicarEscopoParams(params, "proprios");
    expect(p?.origem).toBe("identidade");
    expect(p?.campoIdentidade).toBe("cod_candidato");
  });
});
