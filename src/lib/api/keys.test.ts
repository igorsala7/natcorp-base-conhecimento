import { describe, it, expect } from "vitest";
import { hashKey, generateApiKey, bearerToken, hasScope } from "./keys";

describe("chaves de API (#5)", () => {
  it("generateApiKey: prefixo sk_live_, hash bate com hashKey, hex de 64", () => {
    const k = generateApiKey();
    expect(k.secret.startsWith("sk_live_")).toBe(true);
    expect(k.hash).toBe(hashKey(k.secret));
    expect(k.hash).toHaveLength(64);
    expect(k.prefix.startsWith("sk_live_")).toBe(true);
    expect(generateApiKey().secret).not.toBe(k.secret); // aleatório
  });

  it("hashKey é determinístico e apara espaços", () => {
    expect(hashKey("sk_live_abc")).toBe(hashKey(" sk_live_abc "));
    expect(hashKey("a")).not.toBe(hashKey("b"));
  });

  it("bearerToken extrai o token do header Authorization", () => {
    const req = (h?: string) => new Request("https://x", h ? { headers: { authorization: h } } : undefined);
    expect(bearerToken(req("Bearer sk_live_xyz"))).toBe("sk_live_xyz");
    expect(bearerToken(req("bearer sk_live_xyz "))).toBe("sk_live_xyz");
    expect(bearerToken(req("Basic abc"))).toBeNull();
    expect(bearerToken(req())).toBeNull();
  });

  it("hasScope confere o escopo concedido", () => {
    const ctx = { id: "1", name: "k", scopes: ["content.view", "content.publish"] };
    expect(hasScope(ctx, "content.view")).toBe(true);
    expect(hasScope(ctx, "content.edit")).toBe(false);
  });
});
