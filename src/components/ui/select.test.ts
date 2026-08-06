import { describe, it, expect } from "vitest";
import { createElement, Fragment } from "react";
import { filtrarOpcoes, opcoesDosFilhos, LIMIAR_BUSCA, type SelectOption } from "./select";

/**
 * O projeto não tem jsdom (ambiente `node`), então o teste cobre o miolo PURO:
 * a extração das opções a partir dos `<option>` (o que torna a migração do
 * `<select>` uma troca de tag) e o filtro por digitação.
 */
const O = (value: string, label: string, hint?: string): SelectOption => ({ value, label, hint });

describe("opcoesDosFilhos", () => {
  it("lê value e rótulo dos <option>", () => {
    const filhos = [
      createElement("option", { key: "a", value: "a" }, "Alfa"),
      createElement("option", { key: "b", value: "b" }, "Bravo"),
    ];
    expect(opcoesDosFilhos(filhos)).toEqual([
      { value: "a", label: "Alfa", disabled: undefined },
      { value: "b", label: "Bravo", disabled: undefined },
    ]);
  });

  it("entra em Fragment (o .map() do call site vem embrulhado)", () => {
    const filhos = createElement(
      Fragment,
      null,
      createElement("option", { key: "x", value: "x" }, "Xis"),
      createElement("option", { key: "y", value: "y" }, "Ípsilon"),
    );
    expect(opcoesDosFilhos(filhos).map((o) => o.value)).toEqual(["x", "y"]);
  });

  it("preserva disabled e ignora filho que não é <option>", () => {
    const filhos = [
      createElement("option", { key: "a", value: "a", disabled: true }, "Alfa"),
      createElement("span", { key: "s" }, "ruído"),
    ];
    const out = opcoesDosFilhos(filhos);
    expect(out).toHaveLength(1);
    expect(out[0]!.disabled).toBe(true);
  });

  it("option sem value usa o próprio rótulo (o vazio do placeholder continua vazio)", () => {
    const filhos = [createElement("option", { key: "v", value: "" }, "— nenhum —")];
    expect(opcoesDosFilhos(filhos)[0]).toEqual({ value: "", label: "— nenhum —", disabled: undefined });
  });

  it("rótulo com número (ex.: {n} itens) vira texto", () => {
    const filhos = [createElement("option", { key: "n", value: "10" }, 10)];
    expect(opcoesDosFilhos(filhos)[0]!.label).toBe("10");
  });
});

describe("filtrarOpcoes", () => {
  const itens = [
    O("relatorio_recibo_pagamento", "Relatório: recibo de pagamento"),
    O("historico_financeiro", "Histórico financeiro (eventos)"),
    O("consultar_ferias", "Consultar férias"),
    O("bi_avaliacoes", "BI avaliações", "bi"),
  ];

  it("busca vazia devolve tudo", () => {
    expect(filtrarOpcoes(itens, "  ")).toHaveLength(4);
  });

  it("casa PEDAÇOS em qualquer ordem", () => {
    expect(filtrarOpcoes(itens, "recibo pag").map((o) => o.value)).toEqual(["relatorio_recibo_pagamento"]);
    expect(filtrarOpcoes(itens, "pagamento recibo").map((o) => o.value)).toEqual(["relatorio_recibo_pagamento"]);
  });

  it("ignora acento e caixa", () => {
    expect(filtrarOpcoes(itens, "FERIAS").map((o) => o.value)).toEqual(["consultar_ferias"]);
    expect(filtrarOpcoes(itens, "avaliacoes").map((o) => o.value)).toEqual(["bi_avaliacoes"]);
  });

  it("acha pela CHAVE, não só pelo rótulo", () => {
    expect(filtrarOpcoes(itens, "historico_financeiro").map((o) => o.value)).toEqual(["historico_financeiro"]);
  });

  it("acha pela dica", () => {
    expect(filtrarOpcoes(itens, "bi").map((o) => o.value)).toContain("bi_avaliacoes");
  });

  it("sem casamento devolve vazio (a UI mostra 'nada encontrado')", () => {
    expect(filtrarOpcoes(itens, "zzz")).toEqual([]);
  });
});

describe("limiar da busca", () => {
  it("o campo de busca só aparece em lista longa (atrito zero nas curtas)", () => {
    expect(LIMIAR_BUSCA).toBeGreaterThan(3);
  });
});
