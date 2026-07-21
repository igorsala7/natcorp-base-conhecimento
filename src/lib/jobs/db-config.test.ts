import { describe, it, expect } from "vitest";
import { parseDbConfig } from "./db-config";

describe("parseDbConfig", () => {
  it("host direto do Supabase (o caso que já funcionava)", () => {
    expect(
      parseDbConfig("postgresql://postgres:senha@db.abcdef.supabase.co:5432/postgres"),
    ).toEqual({
      host: "db.abcdef.supabase.co",
      port: 5432,
      user: "postgres",
      password: "senha",
      database: "postgres",
      ssl: { rejectUnauthorized: false },
    });
  });

  it("connection pooler — quebrava com o marcador '@db.'", () => {
    const c = parseDbConfig(
      "postgresql://postgres.abcdef:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres",
    );
    expect(c.host).toBe("aws-0-sa-east-1.pooler.supabase.com");
    expect(c.port).toBe(6543);
    expect(c.user).toBe("postgres.abcdef");
  });

  it("senha com @ e # — a razão de o parse ser manual", () => {
    const c = parseDbConfig("postgresql://postgres:p@ss#w0rd@db.xyz.supabase.co:5432/postgres");
    expect(c.password).toBe("p@ss#w0rd");
    expect(c.host).toBe("db.xyz.supabase.co");
  });

  it("Postgres local: sem SSL", () => {
    const c = parseDbConfig("postgresql://postgres:postgres@localhost:54322/postgres");
    expect(c.host).toBe("localhost");
    expect(c.ssl).toBeUndefined();
  });

  it("porta omitida cai em 5432", () => {
    expect(parseDbConfig("postgresql://u:p@meuhost.com/meubanco").port).toBe(5432);
  });

  it("banco omitido cai em postgres", () => {
    expect(parseDbConfig("postgresql://u:p@meuhost.com:5432/").database).toBe("postgres");
    expect(parseDbConfig("postgresql://u:p@meuhost.com:5432").database).toBe("postgres");
  });

  it("querystring não vaza para o nome do banco", () => {
    expect(parseDbConfig("postgresql://u:p@h.com:5432/app?sslmode=require").database).toBe("app");
  });

  it("aceita o esquema postgres:// além de postgresql://", () => {
    expect(parseDbConfig("postgres://u:p@h.com:5432/db").host).toBe("h.com");
  });

  it("IPv6 entre colchetes não confunde host com porta", () => {
    const c = parseDbConfig("postgresql://u:p@[2001:db8::1]:5432/db");
    expect(c.host).toBe("[2001:db8::1]");
    expect(c.port).toBe(5432);
  });

  it("erros dizem o que está faltando", () => {
    expect(() => parseDbConfig("")).toThrow(/não definido/);
    expect(() => parseDbConfig("postgresql://semarroba/db")).toThrow(/credenciais/);
    expect(() => parseDbConfig("postgresql://usuario@host.com/db")).toThrow(/senha/);
  });
});
