import { describe, it, expect } from "vitest";
import { consolidarChamadas, type ChamadaHttp } from "./curl-step";

const c = (params: unknown, status: number | null, ms: number, curl?: string, cache = false): ChamadaHttp => ({
  params, status, ms, cache, curl,
});
const CURL = "curl -X GET 'https://api/rh?mes=2026-01'";

describe("consolidarChamadas", () => {
  it("uma requisição vira o passo simples de sempre", () => {
    const r = consolidarChamadas("bi_headcount", [c({ empresa: "1" }, 200, 840, CURL)])!;
    expect(r).toMatchObject({ tool: "bi_headcount", params: { empresa: "1" }, status: 200, ms: 840, curl: CURL });
    expect(r.requisicoes).toBeUndefined();
  });

  it("marca o cache só quando houve", () => {
    expect(consolidarChamadas("t", [c({}, 200, 5, CURL, true)])!.cache).toBe(true);
    expect(consolidarChamadas("t", [c({}, 200, 5, CURL)])!.cache).toBeUndefined();
  });

  it("colapsa o loop de 12 meses num passo só, listando o que variou", () => {
    const chamadas = Array.from({ length: 12 }, (_, i) =>
      c({ empresa: "1", competencia: `2026-${String(i + 1).padStart(2, "0")}` }, 200, 700, CURL),
    );
    const r = consolidarChamadas("historico_financeiro", chamadas)!;
    expect(r.requisicoes).toBe(12);
    expect(r.variou).toEqual(["competencia"]);
    expect(r.valores).toHaveLength(10); // teto de 10 na listagem
    expect(r.valores_omitidos).toBe(2);
    expect(r.status).toBe(200);
    expect(r.ms).toBe(12 * 700); // tempo TOTAL do loop
    expect(r.curl).toBe(CURL);
  });

  it("guarda os status distintos quando o loop falha parcialmente", () => {
    const r = consolidarChamadas("t", [c({ m: "1" }, 200, 10, CURL), c({ m: "2" }, 404, 10, CURL)])!;
    expect(r.status).toEqual([200, 404]);
  });

  it("devolve null só quando NADA foi tentado (guard barrou antes da rede)", () => {
    expect(consolidarChamadas("t", [])).toBeNull();
  });

  it("registra a tentativa mesmo sem cURL — acerto de cache e exceção de rede", () => {
    // Cache: a requisição não aconteceu neste turno, mas a chamada existiu.
    const cache = consolidarChamadas("t", [c({ a: 1 }, 200, 2, undefined, true)])!;
    expect(cache).toMatchObject({ tool: "t", params: { a: 1 }, cache: true });
    expect(cache.curl).toBeUndefined();

    // Exceção (timeout/DNS): sem status e sem cURL, mas precisa aparecer no log.
    const falhou = consolidarChamadas("t", [c({ a: 1 }, null, 15_000, undefined)])!;
    expect(falhou).toMatchObject({ tool: "t", status: null, ms: 15_000 });
    expect(falhou.curl).toBeUndefined();
  });

  it("não inventa 'variou' quando os parâmetros são idênticos", () => {
    const r = consolidarChamadas("t", [c({ a: 1 }, 200, 5, CURL), c({ a: 1 }, 200, 5, CURL)])!;
    expect(r.requisicoes).toBe(2);
    expect(r.variou).toBeUndefined();
    expect(r.valores).toBeUndefined();
  });
});
