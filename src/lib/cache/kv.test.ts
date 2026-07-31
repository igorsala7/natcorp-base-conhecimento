import { describe, it, expect } from "vitest";
import { kvGet, kvSet, kvGetJson, kvSetJson, hashKey, kvBackend } from "./kv";

describe("kv (fallback em memória)", () => {
  it("usa o backend de memória quando não há Upstash", () => {
    expect(kvBackend()).toBe("memoria");
  });
  it("set/get string", async () => {
    await kvSet("k1", "abc", 60);
    expect(await kvGet("k1")).toBe("abc");
    expect(await kvGet("inexistente")).toBeNull();
  });
  it("set/get JSON", async () => {
    await kvSetJson("k2", { a: 1, b: [2, 3] }, 60);
    expect(await kvGetJson<{ a: number; b: number[] }>("k2")).toEqual({ a: 1, b: [2, 3] });
  });
  it("expira pelo TTL", async () => {
    await kvSet("k3", "x", -1); // já expirado
    expect(await kvGet("k3")).toBeNull();
  });
  it("hashKey é estável e prefixado", () => {
    const a = hashKey("emb:", "mesma pergunta");
    const b = hashKey("emb:", "mesma pergunta");
    const c = hashKey("emb:", "outra");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith("emb:")).toBe(true);
  });
});
