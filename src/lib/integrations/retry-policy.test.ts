import { describe, expect, it } from "vitest";
import { deveTentarDeNovo, ehFalhaDeEspera, recadoDeFalhaDeEspera } from "./retry-policy";

describe("deveTentarDeNovo", () => {
  it("repete a LEITURA que abortou — o caso linha_tempo de 27/08", () => {
    // 15:53:52, duas facetas (Cargo e Salário), 15,0s cada, "This operation was
    // aborted". A ferramenta falha 2 vezes em 43: é intermitência, não defeito
    // fixo — exatamente o que uma segunda tentativa resolve.
    expect(deveTentarDeNovo({ metodo: "GET", erro: "This operation was aborted", tentativas: 1 })).toBe(true);
  });

  it("NUNCA repete escrita, mesmo tendo abortado", () => {
    // Marcar férias duas vezes não tem quem desfaça: o contrato ORDS registra
    // que a operação nasce concluída e sem atomicidade.
    for (const metodo of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(deveTentarDeNovo({ metodo, erro: "This operation was aborted", tentativas: 1 })).toBe(false);
    }
  });

  it("não repete quando a API RESPONDEU que não", () => {
    // 401/403/404/ORA-xxxx são respostas, não ausência de resposta. Repetir só
    // gasta o tempo do usuário para receber o mesmo "não".
    expect(deveTentarDeNovo({ metodo: "GET", erro: "A API retornou HTTP 403.", tentativas: 1 })).toBe(false);
    expect(deveTentarDeNovo({ metodo: "GET", erro: "ORA-06502: character string buffer", tentativas: 1 })).toBe(false);
  });

  it("para no teto de tentativas", () => {
    expect(deveTentarDeNovo({ metodo: "GET", erro: "aborted", tentativas: 2 })).toBe(false);
  });
});

describe("ehFalhaDeEspera", () => {
  it("reconhece as formas que a falta de resposta assume", () => {
    for (const e of ["This operation was aborted", "ETIMEDOUT", "socket hang up", "fetch failed", "ECONNRESET"]) {
      expect(ehFalhaDeEspera(e)).toBe(true);
    }
  });

  it("não confunde resposta negativa com ausência de resposta", () => {
    expect(ehFalhaDeEspera("HTTP 500")).toBe(false);
    expect(ehFalhaDeEspera("Endpoint não configurado para esta base.")).toBe(false);
  });
});

describe("recadoDeFalhaDeEspera", () => {
  it("proíbe trocar de fonte em silêncio — o defeito que o usuário viu", () => {
    const r = recadoDeFalhaDeEspera("histórico de cargos");
    expect(r).toContain("histórico de cargos");
    expect(r).toMatch(/NÃO substitua por outra fonte sem avisar/);
    expect(r).toMatch(/NÃO SIGNIFICA QUE NÃO EXISTEM DADOS/);
  });
});
