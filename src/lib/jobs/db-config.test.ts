import { describe, it, expect } from "vitest";
import { parseDbConfig } from "./db-config";

describe("parse da SUPABASE_DB_URL", () => {
  it("decodifica a senha percent-encoded — o defeito de 16/08", () => {
    // `Senha%21%40%23Exemplo` é a grafia CORRETA de `Senha!@#Exemplo` numa URI. Sem
    // decodificar, o Postgres recebia os sinais de porcentagem literais e
    // recusava a credencial — e a mensagem apontava para a senha estar errada,
    // que era o único lugar onde ela não estava.
    const c = parseDbConfig(
      "postgresql://postgres.abc:Senha%21%40%23Exemplo@aws-1-sa-east-1.pooler.supabase.com:5432/postgres",
    );
    expect(c.password).toBe("Senha!@#Exemplo");
    expect(c.user).toBe("postgres.abc");
    expect(c.host).toBe("aws-1-sa-east-1.pooler.supabase.com");
    expect(c.port).toBe(5432);
  });

  it("senha CRUA com @ e # continua funcionando", () => {
    // É como o projeto vinha operando, e o parse manual existe justamente para
    // isso: separar no ÚLTIMO @, porque a senha pode conter @ e o host não.
    const c = parseDbConfig("postgresql://postgres:Senha!@#Exemplo@db.abc.supabase.co:5432/postgres");
    expect(c.password).toBe("Senha!@#Exemplo");
    expect(c.host).toBe("db.abc.supabase.co");
  });

  it("percent solto não quebra — cai no valor cru", () => {
    // `decodeURIComponent` LANÇA em sequência malformada. Uma senha com `%` que
    // não foi codificada é exatamente esse caso, e o valor cru é o certo.
    const c = parseDbConfig("postgresql://u:100%pass@host:5432/postgres");
    expect(c.password).toBe("100%pass");
  });

  it("mantém o que já funcionava: porta, banco e querystring", () => {
    const c = parseDbConfig("postgresql://u:p@host:6543/outro?sslmode=require");
    expect(c.port).toBe(6543);
    expect(c.database).toBe("outro");
  });

  it("sem porta assume 5432; sem banco assume postgres", () => {
    const c = parseDbConfig("postgresql://u:p@host");
    expect(c.port).toBe(5432);
    expect(c.database).toBe("postgres");
  });

  it("host local dispensa TLS; remoto exige", () => {
    expect(parseDbConfig("postgresql://u:p@localhost:5432/postgres").ssl).toBeUndefined();
    expect(parseDbConfig("postgresql://u:p@db.abc.supabase.co:5432/postgres").ssl).toEqual({
      rejectUnauthorized: false,
    });
  });

  it("IPv6 entre colchetes não confunde a separação de porta", () => {
    const c = parseDbConfig("postgresql://u:p@[2600:1f1e::1]:5432/postgres");
    expect(c.host).toBe("[2600:1f1e::1]");
    expect(c.port).toBe(5432);
  });

  it("recusa URL sem credenciais, em vez de conectar como anônimo", () => {
    expect(() => parseDbConfig("postgresql://host:5432/postgres")).toThrow(/sem senha|credenciais/i);
    expect(() => parseDbConfig(undefined)).toThrow(/não definido/i);
  });
});
