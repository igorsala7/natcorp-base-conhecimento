import { describe, it, expect } from "vitest";
import { computeSignature, verifySignature, safeEqual } from "./verify";

describe("verifySignature (webhook da Meta)", () => {
  const raw = '{"entry":[{"changes":[]}]}';
  const secret = "app-secret-123";

  it("aceita a assinatura correta do corpo cru", () => {
    const sig = computeSignature(raw, secret);
    expect(sig.startsWith("sha256=")).toBe(true);
    expect(verifySignature(raw, secret, sig)).toBe(true);
  });

  it("rejeita corpo adulterado", () => {
    const sig = computeSignature(raw, secret);
    expect(verifySignature(raw + " ", secret, sig)).toBe(false);
  });

  it("rejeita segredo errado e header ausente", () => {
    const sig = computeSignature(raw, secret);
    expect(verifySignature(raw, "outro", sig)).toBe(false);
    expect(verifySignature(raw, secret, null)).toBe(false);
  });

  it("safeEqual é seguro para tamanhos diferentes", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
