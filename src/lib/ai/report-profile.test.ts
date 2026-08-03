import { describe, it, expect } from "vitest";
import { chaveRelatorio, comporPersona, selecionarPerfil, type PerfilAnalise } from "./report-profile-core";

const base: PerfilAnalise = {
  id: "1",
  titulo: "Analista SESMT",
  nome: "Nati",
  descricao: "Especialista em segurança do trabalho.",
  cargo: "Engenheira de Segurança do Trabalho",
  comportamento: null,
  acoes: [],
  prompt_refino: "",
  requires_perfil: null,
  priority: 0,
  modulos: [{ modulo: "SEGURANÇA DO TRABALHO", submodulo: null }],
};

describe("chaveRelatorio", () => {
  it("é estável à ORDEM das colunas", () => {
    const a = chaveRelatorio("Espelho de Ponto", ["Colaborador", "Data", "Entrada"], "v1");
    const b = chaveRelatorio("Espelho de Ponto", ["Entrada", "Colaborador", "Data"], "v1");
    expect(a).toBe(b);
  });
  it("muda com título, colunas OU vocabulário diferentes", () => {
    const a = chaveRelatorio("Espelho de Ponto", ["Colaborador", "Data"], "v1");
    expect(chaveRelatorio("Benefícios", ["Colaborador", "Data"], "v1")).not.toBe(a); // título
    expect(chaveRelatorio("Espelho de Ponto", ["Colaborador"], "v1")).not.toBe(a); // colunas
    expect(chaveRelatorio("Espelho de Ponto", ["Colaborador", "Data"], "v2")).not.toBe(a); // vocab
  });
});

describe("comporPersona", () => {
  it("usa comportamento livre quando presente", () => {
    const s = comporPersona({ ...base, comportamento: "Dê um parecer técnico curto." });
    expect(s).toContain("Você é Nati, Engenheira de Segurança do Trabalho.");
    expect(s).toContain("Especialista em segurança do trabalho.");
    expect(s).toContain("Dê um parecer técnico curto.");
  });
  it("gera a partir das ações quando não há comportamento", () => {
    const s = comporPersona({ ...base, acoes: ["sugestoes", "pontos_atencao", "alertas"] });
    expect(s).toContain("entregue sugestões, pontos de atenção e alertas");
  });
  it("acrescenta o prompt de refino", () => {
    const s = comporPersona({ ...base, prompt_refino: "Seja objetiva." });
    expect(s.endsWith("Seja objetiva.")).toBe(true);
  });
  it("cai para o título quando não há nome", () => {
    const s = comporPersona({ ...base, nome: null });
    expect(s.startsWith("Você é Analista SESMT")).toBe(true);
  });
});

describe("selecionarPerfil", () => {
  const p1: PerfilAnalise = { ...base, id: "1", priority: 1, modulos: [{ modulo: "BENEFÍCIOS", submodulo: null }] };
  const p2: PerfilAnalise = { ...base, id: "2", priority: 5, modulos: [{ modulo: "SEGURANÇA DO TRABALHO", submodulo: null }] };
  const sesmt = [{ modulo: "SEGURANÇA DO TRABALHO", submodulo: null }];

  it("escolhe o de maior prioridade que casa o módulo", () => {
    expect(selecionarPerfil([p1, p2], sesmt, undefined)?.id).toBe("2");
  });
  it("retorna null quando nenhum módulo casa", () => {
    expect(selecionarPerfil([p1, p2], [{ modulo: "FINANCEIRO", submodulo: null }], undefined)).toBeNull();
  });
  it("retorna null com lista de módulos vazia", () => {
    expect(selecionarPerfil([p1, p2], [], undefined)).toBeNull();
  });
  it("respeita requires_perfil (gating)", () => {
    const pReq: PerfilAnalise = { ...p2, requires_perfil: "GESTOR" };
    expect(selecionarPerfil([pReq], sesmt, "COLABORADOR")).toBeNull();
    expect(selecionarPerfil([pReq], sesmt, "GESTOR")?.id).toBe("2");
    expect(selecionarPerfil([pReq], sesmt, undefined)).toBeNull(); // exige perfil
  });
});
