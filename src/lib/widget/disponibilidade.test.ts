import { describe, it, expect } from "vitest";
import { widgetLiberado, normalizarPaineis, ehPainel } from "./disponibilidade";

describe("widgetLiberado", () => {
  it("NULL = todos os painéis — é o que toda base já cadastrada tem", () => {
    // A migration não pode adivinhar a intenção de quem já existe.
    expect(widgetLiberado(null, "PO")).toBe(true);
    expect(widgetLiberado(undefined, "PC")).toBe(true);
  });

  it("lista recorta por painel", () => {
    expect(widgetLiberado(["PG", "PO"], "PG")).toBe(true);
    expect(widgetLiberado(["PG", "PO"], "PC")).toBe(false);
  });

  it("lista vazia desliga o widget da base inteira", () => {
    expect(widgetLiberado([], "PO")).toBe(false);
  });

  it("base inativa manda, aconteça o que acontecer na lista", () => {
    expect(widgetLiberado(["PO"], "PO", false)).toBe(false);
  });

  it("sem painel identificado, aparece", () => {
    // Portal público e instalação sem rastreio não estão em painel nenhum;
    // bloquear ali derrubaria o widget por uma regra que não fala dele.
    expect(widgetLiberado(["PG"], null)).toBe(true);
    expect(widgetLiberado(["PG"], "")).toBe(true);
    expect(widgetLiberado(["PG"], "XX")).toBe(true);
  });

  it("caixa e espaço não decidem acesso", () => {
    expect(widgetLiberado(["pg"], " Pg ")).toBe(true);
  });
});

describe("normalizarPaineis", () => {
  it("descarta lixo e repetição, e mantém a ordem PO/PG/PC", () => {
    expect(normalizarPaineis(["pc", "PO", "PO", "banana"])).toEqual(["PO", "PC"]);
  });

  it("null continua null — não vira lista vazia", () => {
    // Confundir os dois trocaria "todos" por "nenhum" em toda base existente.
    expect(normalizarPaineis(null)).toBeNull();
    expect(normalizarPaineis("PO")).toBeNull();
    expect(normalizarPaineis([])).toEqual([]);
  });

  it("ehPainel só aceita os três", () => {
    expect(ehPainel("PO")).toBe(true);
    expect(ehPainel("PCAND")).toBe(false);
  });
});
