import { describe, it, expect } from "vitest";

/**
 * Regra do `selecionavel_no_chat`, replicada como predicado puro (o filtro real
 * vive em `matchBaseTools`/`listBaseTools`, que importam `server-only`).
 *
 * O que estes testes protegem, e é a razão de o corte ser ANTES do `slice`:
 * a dependência (`*_meses`, `linha_tempo_fato`) é semanticamente quase idêntica
 * à consulta de verdade, então ela vem ALTO no ranking. Filtrando depois do
 * corte, ela consumia vaga e a boa opção logo abaixo nunca entrava na lista.
 */
const ofertavel = (m: { selecionavel_no_chat?: boolean }) => m.selecionavel_no_chat !== false;

/** Reproduz a ordem de `matchBaseTools`: filtra → ordena → corta. */
const ranquear = <T extends { sim: number; selecionavel_no_chat?: boolean }>(cat: T[], limite: number) =>
  cat.filter(ofertavel).sort((a, b) => b.sim - a.sim).slice(0, limite);

const t = (key: string, sim: number, sel?: boolean) => ({ key, sim, selecionavel_no_chat: sel });

describe("selecionavel_no_chat", () => {
  it("tira da oferta só quando é explicitamente false", () => {
    expect(ofertavel(t("bi_headcount", 1, true))).toBe(true);
    expect(ofertavel(t("linha_tempo_fato", 1, false))).toBe(false);
  });

  it("ausente = aparece — tool antiga não pode sumir da tela por omissão", () => {
    expect(ofertavel(t("tool_velha", 1))).toBe(true);
    expect(ofertavel({} as { selecionavel_no_chat?: boolean })).toBe(true);
  });

  it("a interna NÃO consome vaga do limite — é o ponto todo do corte vir antes", () => {
    // As duas internas batem alto (0.79/0.77) porque são quase idênticas às reais.
    const catalogo = [
      t("historico_financeiro_meses", 0.79, false),
      t("linha_tempo_fato", 0.77, false),
      t("historico_financeiro", 0.74, true),
      t("linha_tempo", 0.71, true),
      t("bi_headcount", 0.68, true),
    ];
    // Filtrar DEPOIS do corte (o jeito errado) deixaria a lista com 1 item.
    const errado = catalogo.sort((a, b) => b.sim - a.sim).slice(0, 3).filter(ofertavel);
    expect(errado.map((x) => x.key)).toEqual(["historico_financeiro"]);
    // Filtrando ANTES, as três vagas vão para opções que servem ao usuário.
    expect(ranquear(catalogo, 3).map((x) => x.key)).toEqual([
      "historico_financeiro", "linha_tempo", "bi_headcount",
    ]);
  });

  it("a interna também não vira a tool FORÇADA por vir em 1º no ranking", () => {
    // Antes: top-1 = `historico_financeiro_meses` → o roteador a forçava sozinha e o
    // usuário recebia a lista de competências no lugar dos lançamentos.
    const catalogo = [t("historico_financeiro_meses", 0.81, false), t("historico_financeiro", 0.73, true)];
    expect(ranquear(catalogo, 5)[0]?.key).toBe("historico_financeiro");
  });

  it("gate de escolha não dispara quando sobra menos de 2 ofertáveis", () => {
    // "De qual delas você quer?" com uma opção só é uma pergunta sem escolha.
    const cands = ranquear([t("historico_financeiro", 0.8, true), t("historico_financeiro_meses", 0.79, false)], 5);
    expect(cands.length >= 2).toBe(false);
  });

  it("catálogo do agente segue inteiro — o corte é só do ranking de opções", () => {
    const catalogo = [t("linha_tempo", 0.7, true), t("linha_tempo_fato", 0.75, false)];
    expect(ranquear(catalogo, 5)).toHaveLength(1);
    expect(catalogo).toHaveLength(2);
  });
});
