import { describe, it, expect } from "vitest";
import { getCachedExec, cacheArgsKey, normalizar, filtrarPorTermo, dedupItems } from "./tool-cache";
import type { ExecResult } from "./executor";

describe("dedupItems", () => {
  it("remove linhas idênticas (a API repete registros)", () => {
    const data = { items: [{ c: 700, n: "X" }, { c: 700, n: "X" }, { c: 1, n: "Y" }, { c: 700, n: "X" }] };
    const r = dedupItems(data) as { items: unknown[] };
    expect(r.items.length).toBe(2);
  });
  it("sem duplicata → mesmo objeto; sem items → inalterado", () => {
    const d = { items: [{ a: 1 }, { a: 2 }] };
    expect(dedupItems(d)).toBe(d);
    expect(dedupItems({ saque: [] })).toEqual({ saque: [] });
  });
});

describe("normalizar", () => {
  it("minúsculas, sem acento, aparado", () => {
    expect(normalizar("  São João ")).toBe("sao joao");
    expect(normalizar("NATCORP DO BRASIL")).toBe("natcorp do brasil");
  });
});

describe("filtrarPorTermo", () => {
  const data = {
    items: [
      { cod_empresa: 700, nome_empresa: "NATCORP DO BRASIL" },
      { cod_empresa: 99, nome_empresa: "ALIMAC CONSULTÓRIA" },
      { cod_empresa: 106, nome_empresa: "NATCORP" },
    ],
  };

  it("casa por qualquer campo *nome*, sem acento/caixa", () => {
    const r = filtrarPorTermo(data, "natcorp") as { items: unknown[] };
    expect(r.items.length).toBe(2);
    const r2 = filtrarPorTermo({ items: [{ nome_filial: "NATCORP - MATRIZ" }, { nome_filial: "LOJA 02" }] }, "matriz") as {
      items: unknown[];
    };
    expect(r2.items.length).toBe(1);
  });

  it("sem casar nada → devolve a lista ORIGINAL (não esconde)", () => {
    expect((filtrarPorTermo(data, "xyz") as { items: unknown[] }).items.length).toBe(3);
  });

  it("termo vazio ou dado não-lista → inalterado", () => {
    expect((filtrarPorTermo(data, "") as { items: unknown[] }).items.length).toBe(3);
    expect(filtrarPorTermo("texto", "x")).toBe("texto");
  });
});

describe("cacheArgsKey", () => {
  it("ignora `termo` e inclui a identidade", () => {
    const k1 = cacheArgsKey({ empresa: "700", termo: "Natcorp" }, { usuario: "365785" });
    const k2 = cacheArgsKey({ empresa: "700", termo: "Redeflex" }, { usuario: "365785" });
    expect(k1).toBe(k2);
    expect(cacheArgsKey({ empresa: "700" }, { usuario: "999" })).not.toBe(k1);
  });
});

describe("getCachedExec", () => {
  it("cacheia resultado OK; erro não cacheia", async () => {
    let ok = 0;
    const fOk = async (): Promise<ExecResult> => ({ ok: true, status: 200, data: { n: ++ok } });
    const a = await getCachedExec("tc-k1", 60, fOk);
    const b = await getCachedExec("tc-k1", 60, fOk);
    expect(ok).toBe(1);
    expect(b).toEqual(a);

    let err = 0;
    const fErr = async (): Promise<ExecResult> => ({ ok: false, status: 500, data: (++err, {}) });
    await getCachedExec("tc-k2", 60, fErr);
    await getCachedExec("tc-k2", 60, fErr);
    expect(err).toBe(2);
  });
});
