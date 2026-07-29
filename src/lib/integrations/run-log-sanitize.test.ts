import { describe, it, expect } from "vitest";
import { sanitizarUrl, sanitizarBody, previewSaida } from "./run-log-sanitize";
import type { ToolParam } from "./tools";

const sessionKeyParam: ToolParam = {
  nome: "key",
  descricao: "",
  tipo: "string",
  origem: "credencial",
  obrigatorio: true,
  local: "query",
  campoCredencial: "session_key",
};

describe("sanitizarUrl", () => {
  it("mascara params sensíveis por nome (token, api_key)", () => {
    const url = "https://api.x.com/v1/dados?empresa=700&token=abc123&api_key=zzz";
    const out = sanitizarUrl(url, []);
    expect(out).toContain("empresa=700");
    expect(out).toContain("token=***");
    expect(out).toContain("api_key=***");
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("zzz");
  });

  it("mascara params de origem=credencial mesmo com nome incomum", () => {
    const url = "https://api.x.com/v1/saque?key=SESSION_SECRET&matricula=1";
    const out = sanitizarUrl(url, [sessionKeyParam]);
    expect(out).not.toContain("SESSION_SECRET");
    expect(out).toContain("matricula=1");
  });

  it("URL inválida volta como veio (não quebra)", () => {
    expect(sanitizarUrl("(não é url)", [])).toBe("(não é url)");
  });
});

describe("sanitizarBody", () => {
  it("redige campos sensíveis recursivamente e preserva o resto", () => {
    const body = JSON.stringify({ saque: [{ matricula: 9, client_secret: "SH", nested: { password: "p" } }] });
    const out = sanitizarBody(body, []) as { saque: { matricula: number; client_secret: string; nested: { password: string } }[] };
    expect(out.saque[0]!.matricula).toBe(9);
    expect(out.saque[0]!.client_secret).toBe("***");
    expect(out.saque[0]!.nested.password).toBe("***");
  });

  it("corpo não-JSON não vira exceção", () => {
    expect(sanitizarBody("<xml/>", [])).toBe("(corpo não-JSON)");
  });

  it("sem corpo = undefined", () => {
    expect(sanitizarBody(undefined, [])).toBeUndefined();
  });
});

describe("previewSaida", () => {
  it("passa curto inteiro", () => {
    const p = previewSaida({ a: 1 });
    expect(p.truncated).toBe(false);
    expect(p.preview).toBe('{"a":1}');
  });

  it("trunca saída grande e marca truncated", () => {
    const p = previewSaida("x".repeat(5000));
    expect(p.truncated).toBe(true);
    expect(p.bytes).toBe(5000);
    expect(p.preview.endsWith("…")).toBe(true);
    expect(p.preview.length).toBeLessThan(5000);
  });
});
