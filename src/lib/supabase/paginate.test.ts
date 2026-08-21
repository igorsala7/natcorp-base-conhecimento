import { describe, it, expect } from "vitest";
import { fetchAllPaged } from "./paginate";

/**
 * Este helper existe porque o PostgREST corta em 1.000 linhas SEM avisar, e o
 * corte já mordeu duas vezes neste projeto: artigo "subindo para a raiz" na
 * árvore de conteúdo, e 82% da ontologia (4.555 de 5.569 termos) simplesmente
 * não chegando à busca. Nos dois casos o sintoma foi ausência, não erro — o que
 * é exatamente o que ninguém procura.
 *
 * A fronteira de 1.000 é onde laço de paginação erra: um `<=` no lugar de `<`
 * repete a última linha, e parar cedo demais come a última página.
 */

/** Fonte falsa que respeita o teto de 1.000 por resposta, como o PostgREST. */
const fonte = (total: number) => {
  const chamadas: [number, number][] = [];
  const make = async (de: number, ate: number) => {
    chamadas.push([de, ate]);
    const linhas = [];
    for (let i = de; i <= Math.min(ate, total - 1); i++) linhas.push({ id: i });
    return { data: linhas, error: null };
  };
  return { make, chamadas };
};

describe("fetchAllPaged", () => {
  it("traz TODAS as linhas quando passam do teto de 1.000", async () => {
    const { make } = fonte(5569); // o tamanho real da ontologia
    const r = await fetchAllPaged<{ id: number }>(make);
    expect(r).toHaveLength(5569);
    expect(r[0]!.id).toBe(0);
    expect(r[5568]!.id).toBe(5568);
  });

  it("não pula nem repete linha na fronteira das fatias", async () => {
    const { make } = fonte(2500);
    const r = await fetchAllPaged<{ id: number }>(make);
    expect(new Set(r.map((x) => x.id)).size).toBe(2500); // nenhuma repetida
    expect(r.map((x) => x.id)).toEqual([...Array(2500).keys()]); // nenhuma pulada
  });

  it("EXATAMENTE 1.000: pede a página seguinte antes de concluir", async () => {
    // O caso que engana: a 1ª página volta cheia, então pode haver mais. Parar
    // aqui é o bug; e a 2ª página vindo vazia é o único jeito de saber.
    const { make, chamadas } = fonte(1000);
    const r = await fetchAllPaged<{ id: number }>(make);
    expect(r).toHaveLength(1000);
    expect(chamadas).toEqual([[0, 999], [1000, 1999]]);
  });

  it("uma página só quando cabe, sem chamada extra", async () => {
    const { make, chamadas } = fonte(42);
    expect(await fetchAllPaged(make)).toHaveLength(42);
    expect(chamadas).toEqual([[0, 999]]);
  });

  it("vazio é vazio, não erro", async () => {
    const { make } = fonte(0);
    expect(await fetchAllPaged(make)).toEqual([]);
  });

  it("propaga o erro em vez de devolver lista pela metade", async () => {
    // Devolver o que veio até aqui seria a versão silenciosa do mesmo defeito.
    await expect(
      fetchAllPaged(async () => ({ data: null, error: { message: "conexão caiu" } })),
    ).rejects.toThrow("conexão caiu");
  });
});
