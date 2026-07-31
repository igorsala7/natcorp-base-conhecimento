import { describe, it, expect } from "vitest";
import { circuitoAberto, registrarSucesso, registrarFalha, ehFalhaDeProvedor } from "./circuit-breaker";

describe("ehFalhaDeProvedor", () => {
  it("reconhece 429/5xx e timeouts/rede", () => {
    expect(ehFalhaDeProvedor({ statusCode: 429 })).toBe(true);
    expect(ehFalhaDeProvedor({ status: 503 })).toBe(true);
    expect(ehFalhaDeProvedor({ message: "fetch failed: ECONNRESET" })).toBe(true);
    expect(ehFalhaDeProvedor({ name: "TimeoutError", message: "timed out" })).toBe(true);
  });
  it("ignora erros de payload/validação", () => {
    expect(ehFalhaDeProvedor({ statusCode: 400, message: "invalid schema" })).toBe(false);
    expect(ehFalhaDeProvedor({ message: "campo obrigatório ausente" })).toBe(false);
    expect(ehFalhaDeProvedor(null)).toBe(false);
  });
});

describe("disjuntor", () => {
  it("abre após 5 falhas de provedor e reseta no sucesso", () => {
    const k = "test:modelo-a";
    expect(circuitoAberto(k)).toBe(false);
    for (let i = 0; i < 4; i++) registrarFalha(k, { statusCode: 500 });
    expect(circuitoAberto(k)).toBe(false); // ainda abaixo do limite
    registrarFalha(k, { statusCode: 500 }); // 5ª → abre
    expect(circuitoAberto(k)).toBe(true);
    registrarSucesso(k);
    expect(circuitoAberto(k)).toBe(false);
  });
  it("falhas que não são de provedor não abrem o circuito", () => {
    const k = "test:modelo-b";
    for (let i = 0; i < 10; i++) registrarFalha(k, { statusCode: 400 });
    expect(circuitoAberto(k)).toBe(false);
  });
});
