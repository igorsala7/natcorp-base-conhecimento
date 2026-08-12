import { describe, it, expect } from "vitest";
import { tipoDeAcesso, ehCandidato } from "./tipo-acesso";

describe("tipoDeAcesso", () => {
  it("com matrícula é colaborador", () => {
    expect(tipoDeAcesso({ matricula: "57292" })).toBe("colaborador");
  });

  it("sem matrícula e com código de candidato é candidato", () => {
    expect(tipoDeAcesso({ codCandidato: "8814" })).toBe("candidato");
    expect(tipoDeAcesso({ matricula: "", codCandidato: "8814" })).toBe("candidato");
    expect(tipoDeAcesso({ matricula: "   ", codCandidato: "8814" })).toBe("candidato");
  });

  // A ordem é a regra: o candidato contratado ganha matrícula e volta a ser
  // colaborador sem ninguém precisar limpar o código de candidato do token.
  it("com os dois preenchidos, matrícula manda", () => {
    expect(tipoDeAcesso({ matricula: "57292", codCandidato: "8814" })).toBe("colaborador");
    expect(ehCandidato({ matricula: "57292", codCandidato: "8814" })).toBe(false);
  });

  it("sem nenhum dos dois é anônimo", () => {
    expect(tipoDeAcesso({})).toBe("anonimo");
    expect(tipoDeAcesso({ matricula: null, codCandidato: null })).toBe("anonimo");
  });
});
