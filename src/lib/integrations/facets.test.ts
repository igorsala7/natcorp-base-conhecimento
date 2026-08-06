import { describe, it, expect } from "vitest";
import { dividirFacetas, MAX_FACETAS } from "./facets";

// A pergunta REAL que expôs o problema (05/08/2026).
const PERGUNTA_REAL =
  "Quantos colaboradores tem por centro de custo, e quais são os 5 centro de custos com mais colaboradores?\n" +
  "Quem são os colaboradores do centro de custo da primeira posição deste ranking? Quero os dados deles, salários, " +
  "avaliações, últimos 5 cargos, dados de férias deles desde 2000 e o valor de horas normais (salário) de março de 2025";

describe("dividirFacetas", () => {
  it("pergunta simples → uma faceta só (nenhum embedding a mais)", () => {
    expect(dividirFacetas("Quantos dias de férias eu tenho?")).toEqual(["Quantos dias de férias eu tenho"]);
  });

  it("vazio → nenhuma faceta", () => {
    expect(dividirFacetas("   ")).toEqual([]);
  });

  it("a posição 0 é SEMPRE a pergunta inteira (o que acha hoje continua achando)", () => {
    const f = dividirFacetas(PERGUNTA_REAL);
    expect(f[0]).toContain("Quantos colaboradores");
    expect(f[0]).toContain("março de 2025");
  });

  it("caso real: separa as intenções que estavam borradas", () => {
    const f = dividirFacetas(PERGUNTA_REAL).map((s) => s.toLowerCase());
    const tem = (t: string) => f.some((x) => x.includes(t));
    expect(tem("avaliações")).toBe(true);
    expect(tem("últimos 5 cargos")).toBe(true);
    expect(tem("férias")).toBe(true);
    expect(tem("horas normais")).toBe(true);
    expect(tem("centro de custo")).toBe(true);
  });

  it("enumeração vira um fragmento por item", () => {
    const f = dividirFacetas("Quero salários, avaliações, férias e cargos");
    // O 1º item carrega o verbo do pedido ("Quero salários") — embeda igual de bem.
    expect(f.some((x) => x.includes("salários"))).toBe(true);
    expect(f).toContain("avaliações");
    expect(f).toContain("férias");
    expect(f).toContain("cargos");
  });

  it("UMA vírgula só NÃO pica a oração ao meio", () => {
    // "Quem são os colaboradores do CC, já que preciso do ranking" é UMA intenção.
    const f = dividirFacetas("Quem são os colaboradores do centro de custo, já que preciso do ranking");
    expect(f).toHaveLength(1);
  });

  it("duas perguntas → duas facetas além da inteira", () => {
    const f = dividirFacetas("Quantos colaboradores ativos? Quais estão de férias?");
    expect(f).toHaveLength(3);
    expect(f[1]).toBe("Quantos colaboradores ativos");
    expect(f[2]).toBe("Quais estão de férias");
  });

  it("fragmento sem conteúdo (conectivo, número solto) é descartado", () => {
    const f = dividirFacetas("Quero os dados deles, e, 2000, avaliações");
    expect(f).not.toContain("e");
    expect(f).not.toContain("2000");
    expect(f).toContain("avaliações");
  });

  it("não repete a pergunta inteira como fragmento", () => {
    const f = dividirFacetas("férias, cargos e salários");
    expect(f.filter((x) => x === "férias, cargos e salários")).toHaveLength(1);
  });

  it("respeita o teto de facetas", () => {
    const f = dividirFacetas("a1 xxx, b2 xxx, c3 xxx, d4 xxx, e5 xxx, f6 xxx, g7 xxx, h8 xxx, i9 xxx, j10 xxx, k11 xxx");
    expect(f.length).toBeLessThanOrEqual(MAX_FACETAS + 1);
  });

  it("lista com marcadores também separa", () => {
    const f = dividirFacetas("Preciso de:\n- avaliações do time\n- férias pendentes");
    expect(f.some((x) => x.includes("avaliações do time"))).toBe(true);
    expect(f.some((x) => x.includes("férias pendentes"))).toBe(true);
  });
});
