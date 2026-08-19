import { describe, it, expect } from "vitest";
import {
  normalizarPanelScope,
  escopoDoPainel,
  ehParamMatricula,
  ehParamEmpresa,
  ehParamCandidato,
  aplicarEscopoParams,
  loopSobEscopo,
  filtrarProprioDosResultados,
} from "./panel-scope";
import type { ToolParam } from "./tools";

const P = (over: Partial<ToolParam>): ToolParam => ({
  nome: "x",
  descricao: "",
  tipo: "string",
  origem: "modelo",
  obrigatorio: false,
  local: "query",
  ...over,
});

describe("normalizarPanelScope", () => {
  it("mantém só painéis/escopos válidos e ignora lixo", () => {
    expect(normalizarPanelScope({ PO: "todos", PG: "equipe", PC: "proprios" })).toEqual({
      PO: "todos",
      PG: "equipe",
      PC: "proprios",
    });
    expect(normalizarPanelScope({ PO: "TODOS", PC: "  Proprios " })).toEqual({ PO: "todos", PC: "proprios" });
    expect(normalizarPanelScope({ PO: "banana", ZZ: "todos" })).toBeNull();
    expect(normalizarPanelScope(null)).toBeNull();
    expect(normalizarPanelScope("x")).toBeNull();
  });
});

describe("escopoDoPainel", () => {
  const ps = { PO: "todos", PG: "equipe", PC: "proprios" } as const;
  it("resolve pelo painel do usuário", () => {
    expect(escopoDoPainel(ps, "PO")).toBe("todos");
    expect(escopoDoPainel(ps, "pg")).toBe("equipe");
    expect(escopoDoPainel(ps, "PC")).toBe("proprios");
  });
  it("sem config = todos (retrocompatível)", () => {
    expect(escopoDoPainel(null, "PC")).toBe("todos");
    expect(escopoDoPainel(undefined, "PO")).toBe("todos");
  });
  it("painel desconhecido cai para PC (mais seguro)", () => {
    expect(escopoDoPainel(ps, "")).toBe("proprios");
    expect(escopoDoPainel(ps, "XX")).toBe("proprios");
    expect(escopoDoPainel({ PC: "nenhum" }, undefined)).toBe("nenhum");
  });
  it("painel sem entrada explícita = todos", () => {
    expect(escopoDoPainel({ PC: "proprios" }, "PO")).toBe("todos");
  });
});

describe("detecção de parâmetro", () => {
  it("matrícula-alvo (não a do usuário)", () => {
    expect(ehParamMatricula(P({ nome: "matricula" }))).toBe(true);
    expect(ehParamMatricula(P({ nome: "p_matricula" }))).toBe(true);
    expect(ehParamMatricula(P({ nome: "matriculas" }))).toBe(true);
    expect(ehParamMatricula(P({ nome: "x", campoIdentidade: "matricula", origem: "identidade" }))).toBe(true);
    expect(ehParamMatricula(P({ nome: "matricula_user" }))).toBe(false);
  });
  it("empresa (filtro)", () => {
    expect(ehParamEmpresa(P({ nome: "cod_empresa" }))).toBe(true);
    expect(ehParamEmpresa(P({ nome: "empresa" }))).toBe(true);
    expect(ehParamEmpresa(P({ nome: "emp" }))).toBe(true);
    expect(ehParamEmpresa(P({ nome: "empresa_user" }))).toBe(false);
  });
  it("candidato (recrutamento)", () => {
    expect(ehParamCandidato(P({ nome: "cod_candidato" }))).toBe(true);
    expect(ehParamCandidato(P({ nome: "candidato" }))).toBe(true);
    expect(ehParamCandidato(P({ nome: "x", campoIdentidade: "cod_candidato", origem: "identidade" }))).toBe(true);
    expect(ehParamCandidato(P({ nome: "candidato_user" }))).toBe(false);
    expect(ehParamCandidato(P({ nome: "cod_empresa" }))).toBe(false);
  });
});

describe("aplicarEscopoParams", () => {
  const params = [
    P({ nome: "matricula", origem: "modelo" }),
    P({ nome: "cod_empresa", origem: "modelo" }),
    P({ nome: "cod_candidato", origem: "modelo" }),
    P({ nome: "competencia", origem: "modelo" }),
  ];
  it("próprios: força matrícula, empresa E cod_candidato à identidade", () => {
    const r = aplicarEscopoParams(params, "proprios");
    expect(r.find((p) => p.nome === "matricula")).toMatchObject({ origem: "identidade", campoIdentidade: "matricula" });
    expect(r.find((p) => p.nome === "cod_empresa")).toMatchObject({ origem: "identidade", campoIdentidade: "cod_empresa" });
    expect(r.find((p) => p.nome === "cod_candidato")).toMatchObject({ origem: "identidade", campoIdentidade: "cod_candidato" });
    expect(r.find((p) => p.nome === "competencia")?.origem).toBe("modelo");
  });
  it("equipe: NÃO mexe nos parâmetros (matrícula do modelo; guard valida a equipe)", () => {
    expect(aplicarEscopoParams(params, "equipe")).toBe(params);
  });
  it("todos/nenhum: não mexe", () => {
    expect(aplicarEscopoParams(params, "todos")).toBe(params);
    expect(aplicarEscopoParams(params, "nenhum")).toBe(params);
  });
});

describe("loopSobEscopo", () => {
  const params = [P({ nome: "matriculas", origem: "modelo" })];
  const loop = { unit: "batch" as const, param: "matriculas", max: 20 };
  it("próprios desliga o loop de matrícula (consulta é do próprio)", () => {
    expect(loopSobEscopo(loop, params, "proprios")).toBeNull();
  });
  it("equipe/todos mantêm o loop", () => {
    expect(loopSobEscopo(loop, params, "equipe")).toBe(loop);
    expect(loopSobEscopo(loop, params, "todos")).toBe(loop);
  });
  it("loop de mês não é afetado por próprios", () => {
    const mensal = { unit: "month" as const, param: "competencia", from: "de", to: "ate" };
    const ps = [P({ nome: "competencia" })];
    expect(loopSobEscopo(mensal, ps, "proprios")).toBe(mensal);
  });
});

describe("filtrarProprioDosResultados (exclude_self)", () => {
  it("remove linhas do próprio de um array", () => {
    const dados = [{ matricula: "100", nome: "Eu" }, { matricula: "200", nome: "Outro" }];
    expect(filtrarProprioDosResultados(dados, "100")).toEqual([{ matricula: "200", nome: "Outro" }]);
  });
  it("remove de wrappers comuns (items/dados/...)", () => {
    const dados = { items: [{ matricula_solicitada: "100" }, { matricula_solicitada: "300" }] };
    expect(filtrarProprioDosResultados(dados, "100")).toEqual({ items: [{ matricula_solicitada: "300" }] });
  });
  it("sem matrícula própria não filtra nada", () => {
    const dados = [{ matricula: "100" }];
    expect(filtrarProprioDosResultados(dados, "")).toBe(dados);
  });
});

/**
 * GESTOR DE EQUIPE — o painel decide, o cadastro não pode baixar.
 *
 * A mesma pessoa pode ser gestora de equipe E fazer parte do RH: acessa o
 * Painel do Operador com `gestor=SIM`, e o perfil pode ser GESTOR ou FOLHA
 * (regra do Igor, 18/08/2026). Caso real: "Minha Equipe" tinha `PO="nenhum"` e
 * sumia do catálogo para quem justamente tem equipe — o modelo então pegava a
 * ferramenta vizinha e parecia erro de escolha da IA.
 */
describe("escopoDoPainel — gestor de equipe", () => {
  const minhaEquipe = { PO: "nenhum", PG: "equipe", PC: "nenhum" } as const;

  it("gestor no PO tem alcance TOTAL, mesmo com a tool marcada 'nenhum'", () => {
    expect(escopoDoPainel(minhaEquipe, "PO", false, false)).toBe("nenhum");
    expect(escopoDoPainel(minhaEquipe, "PO", false, true)).toBe("todos");
  });

  it("gestor no PG vê a equipe; no PC, só os próprios", () => {
    expect(escopoDoPainel(minhaEquipe, "PG", false, true)).toBe("equipe");
    expect(escopoDoPainel(minhaEquipe, "PC", false, true)).toBe("proprios");
  });

  it("quem NÃO é gestor segue exatamente o cadastro", () => {
    for (const p of ["PO", "PG", "PC"] as const) {
      expect(escopoDoPainel(minhaEquipe, p, false, false)).toBe(minhaEquipe[p]);
    }
  });

  it("ser gestor NUNCA reduz o alcance", () => {
    // Uma tool liberada como "todos" no PG não pode virar "equipe" só porque
    // quem consulta é gestor — seria menos acesso por ter mais responsabilidade.
    const ampla = { PO: "todos", PG: "todos", PC: "todos" } as const;
    for (const p of ["PO", "PG", "PC"] as const) {
      expect(escopoDoPainel(ampla, p, false, true)).toBe("todos");
    }
  });

  it("candidato não é afetado — silêncio continua sendo NÃO", () => {
    // A inversão do candidato é deliberada: sem ela, o catálogo de RH inteiro
    // passaria a valer para alguém de fora da empresa por omissão.
    expect(escopoDoPainel(minhaEquipe, "PO", true, true)).toBe("nenhum");
    expect(escopoDoPainel({ PCAND: "proprios" }, "PO", true, true)).toBe("proprios");
  });

  it("sem panel_scope nenhum continua 'todos', com ou sem gestor", () => {
    expect(escopoDoPainel(null, "PO", false, true)).toBe("todos");
    expect(escopoDoPainel(undefined, "PC", false, true)).toBe("todos");
  });
});
