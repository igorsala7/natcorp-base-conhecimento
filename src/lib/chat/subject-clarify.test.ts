import { describe, it, expect } from "vitest";
import { pareceAnaforico, deveClassificarSujeito, montarOpcoesSujeito, diretrizReferente } from "./subject-clarify";

describe("pareceAnaforico", () => {
  it("pega mensagens SEM sujeito (anáfora)", () => {
    expect(pareceAnaforico("qual o salário dele?")).toBe(true);
    expect(pareceAnaforico("e a matrícula?")).toBe(true);
    expect(pareceAnaforico("detalha esses")).toBe(true);
    expect(pareceAnaforico("mostra o primeiro")).toBe(true);
    expect(pareceAnaforico("quanto ela ganha")).toBe(true);
  });
  it("NÃO pega mensagens com sujeito explícito", () => {
    expect(pareceAnaforico("qual o salário do João?")).toBe(false);
    expect(pareceAnaforico("colaboradores do cargo supervisor")).toBe(false);
    expect(pareceAnaforico("quantos colaboradores tem a empresa 700?")).toBe(false);
  });
});

describe("deveClassificarSujeito", () => {
  const anaf = "qual o salário dele?";
  it("roda quando parece anáfora E há relatório na tela", () => {
    expect(deveClassificarSujeito(anaf, [], true)).toBe(true);
  });
  it("roda quando há turno anterior do assistente substancial (possível lista)", () => {
    const msgs = [{ role: "assistant", content: "x".repeat(200) }];
    expect(deveClassificarSujeito(anaf, msgs, false)).toBe(true);
  });
  it("NÃO roda sem contexto (sem relatório e sem histórico relevante)", () => {
    expect(deveClassificarSujeito(anaf, [], false)).toBe(false);
    expect(deveClassificarSujeito(anaf, [{ role: "assistant", content: "ok" }], false)).toBe(false);
  });
  it("NÃO roda quando a mensagem não é anafórica (mesmo com contexto)", () => {
    expect(deveClassificarSujeito("qual o salário do João?", [], true)).toBe(false);
  });
});

describe("montarOpcoesSujeito", () => {
  it("agrupa quando há muitos candidatos + inclui relatório e geral", () => {
    const dec = { ambiguo: true, candidatos: ["Ana", "Bia", "Cid", "Dan", "Eva"], refereRelatorio: true };
    const ops = montarOpcoesSujeito(dec, true);
    expect(ops.map((o) => o.id)).toEqual(["listados", "relatorio", "geral"]);
    expect(String(ops[0]!.label)).toContain("Os 5 listados");
  });
  it("sem relatório → só listados + geral", () => {
    const ops = montarOpcoesSujeito({ ambiguo: true, candidatos: ["Ana"], refereRelatorio: false }, false);
    expect(ops.map((o) => o.id)).toEqual(["listados", "geral"]);
    expect(String(ops[0]!.label)).toBe("👥 Ana");
  });
});

describe("diretrizReferente", () => {
  it("listados/geral geram diretriz; vazio p/ o resto", () => {
    expect(diretrizReferente("listados")).toContain("LISTADOS");
    expect(diretrizReferente("geral")).toContain("GERAL");
    expect(diretrizReferente("relatorio")).toBe("");
    expect(diretrizReferente(undefined)).toBe("");
  });
});
