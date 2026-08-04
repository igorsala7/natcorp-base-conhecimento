import { describe, it, expect } from "vitest";
import { pareceTutorial } from "./form-fields";

describe("pareceTutorial", () => {
  it("reconhece 'programa' e 'como se usa' (não só 'tela'/'como uso')", () => {
    expect(pareceTutorial("O que é esse programa e como se usa?")).toBe(true);
    expect(pareceTutorial("como se usa isso?")).toBe(true);
    expect(pareceTutorial("para que serve esse sistema")).toBe(true);
    expect(pareceTutorial("como funciona essa página")).toBe(true);
  });

  it("mantém os gatilhos antigos (tela)", () => {
    expect(pareceTutorial("o que é esta tela?")).toBe(true);
    expect(pareceTutorial("como uso essa tela")).toBe(true);
    expect(pareceTutorial("me ensina a usar")).toBe(true);
    expect(pareceTutorial("tutorial")).toBe(true);
  });

  it("NÃO marca perguntas de DADOS/conceito como tutorial (evita falso-positivo)", () => {
    expect(pareceTutorial("quantos colaboradores tem a empresa?")).toBe(false);
    expect(pareceTutorial("me mostra o relatório de férias")).toBe(false);
    expect(pareceTutorial("qual o total de horas extras do mês?")).toBe(false);
    expect(pareceTutorial("como se faz o cálculo de rescisão")).toBe(false);
  });
});
