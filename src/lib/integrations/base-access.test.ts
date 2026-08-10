import { describe, expect, it } from "vitest";
import {
  aplicarIntervalo,
  diffAcesso,
  filtrarTools,
  habilitadasDaBase,
  ordenarPorNome,
} from "./base-access";

const t = (id: string, name: string, key = id, description: string | null = null) => ({
  id,
  name,
  key,
  description,
});

describe("habilitadasDaBase", () => {
  const vinculos = [
    { base_id: "A", tool_id: "1", enabled: true },
    { base_id: "A", tool_id: "2", enabled: false },
    { base_id: "B", tool_id: "3", enabled: true },
  ];

  it("só as habilitadas DAQUELA base", () => {
    expect([...habilitadasDaBase(vinculos, "A")]).toEqual(["1"]);
    expect([...habilitadasDaBase(vinculos, "B")]).toEqual(["3"]);
  });

  it("linha ausente é INDISPONÍVEL, não liberado", () => {
    // O runtime filtra por enabled=true; ler o vazio como "tudo liberado" faria
    // a tela mostrar bloqueado o que o chat responde.
    expect(habilitadasDaBase(vinculos, "C").size).toBe(0);
    expect(habilitadasDaBase([], "A").size).toBe(0);
  });
});

describe("diffAcesso", () => {
  it("manda só o que mudou", () => {
    const r = diffAcesso(new Set(["a", "b"]), new Set(["b", "c"]));
    expect(r.ligar).toEqual(["c"]);
    expect(r.desligar).toEqual(["a"]);
  });

  it("sem mudança, não manda nada", () => {
    // Salvar aqui reescreveria linhas intocadas e regeraria embeddings à toa.
    const r = diffAcesso(new Set(["a", "b"]), new Set(["b", "a"]));
    expect(r.ligar).toEqual([]);
    expect(r.desligar).toEqual([]);
  });

  it("base zerada devolve tudo em desligar", () => {
    const r = diffAcesso(new Set(["a", "b", "c"]), new Set());
    expect(r.desligar.sort()).toEqual(["a", "b", "c"]);
    expect(r.ligar).toEqual([]);
  });

  it("base virgem devolve tudo em ligar", () => {
    const r = diffAcesso(new Set(), new Set(["a", "b"]));
    expect(r.ligar.sort()).toEqual(["a", "b"]);
  });
});

describe("filtrarTools", () => {
  const tools = [
    t("1", "Apuração de ponto", "bi_ponto", "Espelho e batidas do período"),
    t("2", "Saldo de férias", "ferias_saldo"),
    t("3", "Holerite do mês", "financeiro_holerite", "Recibo de pagamento"),
  ];

  it("busca vazia devolve tudo", () => {
    expect(filtrarTools(tools, "  ")).toHaveLength(3);
  });

  it("acha por pedaços em QUALQUER ordem", () => {
    // Quem procura lembra duas palavras soltas, não a frase exata.
    expect(filtrarTools(tools, "ponto apuracao").map((x) => x.id)).toEqual(["1"]);
  });

  it("ignora acento nos dois lados", () => {
    expect(filtrarTools(tools, "ferias").map((x) => x.id)).toEqual(["2"]);
    expect(filtrarTools(tools, "FÉRIAS").map((x) => x.id)).toEqual(["2"]);
  });

  it("olha a chave e a descrição, não só o nome", () => {
    expect(filtrarTools(tools, "bi_ponto").map((x) => x.id)).toEqual(["1"]);
    expect(filtrarTools(tools, "recibo").map((x) => x.id)).toEqual(["3"]);
  });

  it("sem resultado devolve lista vazia", () => {
    expect(filtrarTools(tools, "rescisao")).toEqual([]);
  });
});

describe("ordenarPorNome", () => {
  it("alfabética com as regras do português", () => {
    const r = ordenarPorNome([t("1", "Ônus"), t("2", "Apuração"), t("3", "Ausência")]);
    expect(r.map((x) => x.name)).toEqual(["Apuração", "Ausência", "Ônus"]);
  });

  it("não muda a lista original", () => {
    const orig = [t("1", "B"), t("2", "A")];
    ordenarPorNome(orig);
    expect(orig.map((x) => x.name)).toEqual(["B", "A"]);
  });
});

describe("aplicarIntervalo (shift+clique)", () => {
  const vis = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

  it("marca do começo ao fim", () => {
    const r = aplicarIntervalo(vis, new Set(), "a", "c", true);
    expect([...r].sort()).toEqual(["a", "b", "c"]);
  });

  it("funciona de baixo para cima", () => {
    const r = aplicarIntervalo(vis, new Set(), "d", "b", true);
    expect([...r].sort()).toEqual(["b", "c", "d"]);
  });

  it("desmarca intervalo sem tocar no resto", () => {
    const r = aplicarIntervalo(vis, new Set(["a", "b", "c", "d"]), "b", "c", false);
    expect([...r].sort()).toEqual(["a", "d"]);
  });

  it("age sobre a lista VISÍVEL, não sobre o catálogo", () => {
    // Com a busca ativa, "da 1ª à 2ª" tem que pegar as duas que a pessoa vê.
    const filtrado = [{ id: "b" }, { id: "d" }];
    const r = aplicarIntervalo(filtrado, new Set(), "b", "d", true);
    expect([...r].sort()).toEqual(["b", "d"]);
    expect(r.has("c")).toBe(false);
  });

  it("âncora fora da lista vira clique simples", () => {
    // A busca mudou desde o último clique: adivinhar um intervalo que a pessoa
    // não está vendo marcaria ferramentas silenciosamente.
    const r = aplicarIntervalo(vis, new Set(), "zzz", "c", true);
    expect([...r]).toEqual(["c"]);
  });
});
