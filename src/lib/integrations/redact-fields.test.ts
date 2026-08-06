import { describe, it, expect } from "vitest";
import { campoSensivel, redigirCredenciais, MARCA } from "./redact-fields";

/**
 * Regressão do achado real: /documents/v1/emps devolvia `cert_file` e `cert_password`
 * (certificado digital da empresa e a senha dele) junto do cadastro — indo para o
 * contexto do modelo e para o log de execução.
 */
describe("campoSensivel", () => {
  it("pega os campos do caso real", () => {
    for (const c of ["cert_file", "cert_password", "cert_charset", "cert_mimetype"]) {
      expect(campoSensivel(c)).toBe(true);
    }
  });

  it("pega as variações comuns", () => {
    for (const c of ["senha", "password", "PASSWD", "client_secret", "api_key", "private_key", "token"]) {
      expect(campoSensivel(c)).toBe(true);
    }
  });

  it("NÃO pega campo legítimo com nome parecido", () => {
    // O falso positivo aqui apagaria dado que o usuário precisa.
    for (const c of ["certidao", "tokenizacao", "nome", "cpf", "salario", "cert_expiration_date", "matricula"]) {
      expect(campoSensivel(c)).toBe(false);
    }
  });
});

describe("redigirCredenciais", () => {
  it("substitui o valor e mantém o resto intacto", () => {
    const api = {
      items: [
        { id: 1, name: "TESTE NATCORP", company_id: "31.254.402/0001-46", cert_file: "MIIKr...", cert_password: "s3nh4", cert_expiration_date: "2027-01-01" },
      ],
    };
    const out = redigirCredenciais(api);
    expect(out.items[0]!.cert_file).toBe(MARCA);
    expect(out.items[0]!.cert_password).toBe(MARCA);
    expect(out.items[0]!.name).toBe("TESTE NATCORP");
    expect(out.items[0]!.company_id).toBe("31.254.402/0001-46");
    // Data de validade não é segredo — é informação útil.
    expect(out.items[0]!.cert_expiration_date).toBe("2027-01-01");
  });

  it("campo vazio continua vazio (não vira ruído)", () => {
    const out = redigirCredenciais({ items: [{ cert_password: "", cert_file: null }] });
    expect(out.items[0]!.cert_password).toBe("");
    expect(out.items[0]!.cert_file).toBeNull();
  });

  it("desce em objeto aninhado", () => {
    const out = redigirCredenciais({ empresa: { config: { api_key: "abc123" } } });
    expect(out.empresa.config.api_key).toBe(MARCA);
  });

  it("aninhamento absurdo não estoura", () => {
    let n: Record<string, unknown> = { senha: "x" };
    for (let i = 0; i < 30; i++) n = { dentro: n };
    expect(() => redigirCredenciais(n)).not.toThrow();
  });

  it("array de objetos é percorrido", () => {
    const out = redigirCredenciais([{ token: "t1" }, { token: "t2" }]);
    expect(out.map((o) => o.token)).toEqual([MARCA, MARCA]);
  });
});
