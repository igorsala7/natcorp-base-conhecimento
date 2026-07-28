import { describe, it, expect } from "vitest";
import { sanitizarUrl } from "./sanitize-url";

describe("sanitizarUrl", () => {
  it("redige parâmetros sensíveis, mantém os demais", () => {
    const out = sanitizarUrl("https://app.cliente/rh?token=abc123&aba=ferias&senha=xyz");
    expect(out).toContain("token=***");
    expect(out).toContain("senha=***");
    expect(out).toContain("aba=ferias");
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("xyz");
  });

  it("remove credenciais do userinfo", () => {
    const out = sanitizarUrl("https://joao:segredo@app.cliente/painel");
    expect(out).not.toContain("segredo");
    expect(out).not.toContain("joao:");
    expect(out).toContain("app.cliente/painel");
  });

  it("cobre variações (api_key, apikey, access_token, cvv)", () => {
    const out = sanitizarUrl("https://x/y?api_key=1&access_token=2&cvv=3&ok=4");
    expect(out).toContain("api_key=***");
    expect(out).toContain("access_token=***");
    expect(out).toContain("cvv=***");
    expect(out).toContain("ok=4");
  });

  it("passa URL limpa sem mexer; trata vazio/não-URL", () => {
    expect(sanitizarUrl("https://app.cliente/rh/ferias")).toBe("https://app.cliente/rh/ferias");
    expect(sanitizarUrl(null)).toBeNull();
    expect(sanitizarUrl("   ")).toBeNull();
    expect(sanitizarUrl("nao-e-url")).toBe("nao-e-url");
  });
});
