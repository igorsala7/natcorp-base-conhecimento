import { describe, it, expect } from "vitest";
import { newRegistry, registrarDataset, injetarDataset, expandirTabela } from "./datasets";

const linhas = (n: number) => Array.from({ length: n }, (_, i) => ({ matricula: 100 + i, nome: "Fulano " + i, salario: 1000 + i }));

describe("registrarDataset", () => {
  it("detecta lista em `items` e infere colunas", () => {
    const reg = newRegistry();
    const meta = registrarDataset(reg, { items: linhas(300), hasMore: true });
    expect(meta).toEqual({ id: "ds1", total: 300, colunas: ["matricula", "nome", "salario"] });
    expect(reg.list[0]!.rows).toHaveLength(300);
  });

  it("detecta array direto e ids sequenciais", () => {
    const reg = newRegistry();
    registrarDataset(reg, { items: linhas(2) });
    const meta = registrarDataset(reg, linhas(5));
    expect(meta?.id).toBe("ds2");
    expect(meta?.total).toBe(5);
  });

  it("ignora chaves de metadado `_*` nas colunas", () => {
    const reg = newRegistry();
    const meta = registrarDataset(reg, { itens: [{ a: 1, _x: 2, b: 3 }] });
    expect(meta?.colunas).toEqual(["a", "b"]);
  });

  it("retorna null quando não há lista de registros", () => {
    const reg = newRegistry();
    expect(registrarDataset(reg, { erro: "falhou" })).toBeNull();
    expect(registrarDataset(reg, { total: 5 })).toBeNull();
    expect(registrarDataset(reg, "texto")).toBeNull();
  });
});

describe("injetarDataset", () => {
  it("adiciona _dataset/_total/_colunas mantendo os itens (objeto)", () => {
    const reg = newRegistry();
    const out = injetarDataset(reg, { items: linhas(3), hasMore: false }) as Record<string, unknown>;
    expect(out._dataset).toBe("ds1");
    expect(out._total).toBe(3);
    expect(Array.isArray(out.items)).toBe(true);
  });

  it("envelopa array em { itens } com o metadado", () => {
    const reg = newRegistry();
    const out = injetarDataset(reg, linhas(4)) as Record<string, unknown>;
    expect(out._dataset).toBe("ds1");
    expect((out.itens as unknown[]).length).toBe(4);
  });

  it("não mexe em resultado sem lista (ex.: {erro})", () => {
    const reg = newRegistry();
    const err = { erro: "x" };
    expect(injetarDataset(reg, err)).toBe(err);
  });

  it("sem registry, devolve intacto", () => {
    const x = { items: linhas(2) };
    expect(injetarDataset(undefined, x)).toBe(x);
  });
});

describe("expandirTabela", () => {
  it("expande TODAS as linhas com os campos e cabeçalhos pedidos", () => {
    const reg = newRegistry();
    registrarDataset(reg, { items: linhas(250) });
    const t = expandirTabela(reg, "ds1", ["nome", "salario"], ["Colaborador", "Salário"]);
    expect(t?.total).toBe(250);
    expect(t?.truncado).toBe(false);
    expect(t?.colunas).toEqual(["Colaborador", "Salário"]);
    expect(t?.linhas).toHaveLength(250);
    expect(t?.linhas[0]).toEqual(["Fulano 0", "1000"]);
  });

  it("sem campos, usa todas as colunas inferidas", () => {
    const reg = newRegistry();
    registrarDataset(reg, { items: linhas(3) });
    const t = expandirTabela(reg, "ds1");
    expect(t?.colunas).toEqual(["matricula", "nome", "salario"]);
    expect(t?.linhas[1]).toEqual(["101", "Fulano 1", "1001"]);
  });

  it("respeita o teto `max` e marca truncado", () => {
    const reg = newRegistry();
    registrarDataset(reg, { items: linhas(10) });
    const t = expandirTabela(reg, "ds1", ["nome"], ["Nome"], 4);
    expect(t?.linhas).toHaveLength(4);
    expect(t?.truncado).toBe(true);
  });

  it("dataset inexistente → null", () => {
    expect(expandirTabela(newRegistry(), "dsX")).toBeNull();
  });
});
