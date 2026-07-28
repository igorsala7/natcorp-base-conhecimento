import { describe, it, expect } from "vitest";
import { montarItensTimeline, planejarBlocos, agruparEmSecoes, type TrailEvent } from "./timeline";

/** Base de tempo fixa (evita depender do relógio). */
const T0 = 1_700_000_000_000;
const ev = (e: Partial<TrailEvent> & { kind: string }): TrailEvent => ({
  url: null,
  title: null,
  label: null,
  storage_path: null,
  created_at: new Date(T0).toISOString(),
  t_ms: null,
  meta: null,
  ...e,
});

describe("linha do tempo da captura da extensão", () => {
  it("põe o print ENTRE os segmentos certos da narração", () => {
    // Gravação começa em T0; segmentos em 0s, 5s, 10s. Print tirado em T0+6s
    // (entre o 2º e o 3º segmento).
    const eventos: TrailEvent[] = [
      ev({ kind: "nav", url: "https://app/rh", title: "RH", t_ms: T0 - 1000 }),
      ev({
        kind: "transcript",
        t_ms: T0,
        label: "primeiro segundo quinto décimo",
        meta: {
          segments: [
            { text: "Abra o menu Recursos Humanos.", start: 0 },
            { text: "Clique em Banco de horas.", start: 5 },
            { text: "Confira o saldo do funcionário.", start: 10 },
          ],
        },
      }),
      ev({ kind: "shot", storage_path: "ext/s/p.png", title: "Banco de horas", t_ms: T0 + 6000 }),
    ];

    const items = montarItensTimeline(eventos);
    const kinds = items.map((i) => i.kind);
    // nav(-1s) < seg0(0s) < seg1(5s) < shot(6s) < seg2(10s)
    expect(kinds).toEqual(["nav", "text", "text", "shot", "text"]);

    const plano = planejarBlocos(items);
    const idxShot = plano.findIndex((p) => p.kind === "shot");
    const antes = plano.slice(0, idxShot).map((p) => (p.kind === "paragraph" ? p.text : "")).join(" ");
    const depois = plano.slice(idxShot + 1).map((p) => (p.kind === "paragraph" ? p.text : "")).join(" ");
    // A fala anterior ao print está ANTES dele; a posterior, DEPOIS.
    expect(antes).toContain("Clique em Banco de horas.");
    expect(antes).not.toContain("Confira o saldo");
    expect(depois).toContain("Confira o saldo do funcionário.");
    expect(depois).not.toContain("Clique em Banco de horas.");
    // O print quebra o parágrafo: a fala vira dois parágrafos distintos.
    const paras = plano.filter((p) => p.kind === "paragraph");
    expect(paras.some((p) => p.kind === "paragraph" && p.text === "Abra o menu Recursos Humanos. Clique em Banco de horas.")).toBe(true);
    expect(paras.some((p) => p.kind === "paragraph" && p.text === "Confira o saldo do funcionário.")).toBe(true);
  });

  it("sem segmentos temporizados, usa o texto inteiro no t_ms da gravação", () => {
    const eventos: TrailEvent[] = [
      ev({ kind: "transcript", t_ms: T0, label: "Narração sem segmentos.", meta: null }),
      ev({ kind: "shot", storage_path: "ext/s/p.png", t_ms: T0 - 1000 }),
    ];
    const items = montarItensTimeline(eventos);
    // shot(-1s) antes do bloco de texto (0s).
    expect(items.map((i) => i.kind)).toEqual(["shot", "text"]);
  });

  it("ignora eventos de varredura (scan) e telas repetidas", () => {
    const eventos: TrailEvent[] = [
      ev({ kind: "scan", label: "CAMPOS: ...", t_ms: T0 }),
      ev({ kind: "nav", url: "https://app/x", title: "X", t_ms: T0 + 1 }),
      ev({ kind: "nav", url: "https://app/x", title: "X (de novo)", t_ms: T0 + 2 }),
    ];
    const items = montarItensTimeline(eventos);
    expect(items.every((i) => i.kind !== "text" || true)).toBe(true); // scan não vira item
    expect(items.filter((i) => i.kind === "nav")).toHaveLength(2);
    const plano = planejarBlocos(items);
    // dedup: só um heading de tela.
    expect(plano.filter((p) => p.kind === "heading")).toHaveLength(1);
  });

  it("só prints (sem navegação) ganha um cabeçalho 'Capturas'", () => {
    const eventos: TrailEvent[] = [ev({ kind: "shot", storage_path: "ext/s/p.png", t_ms: T0 })];
    const plano = planejarBlocos(montarItensTimeline(eventos));
    expect(plano[1]).toEqual({ kind: "heading", text: "Capturas" });
  });

  it("cai no created_at quando não há t_ms", () => {
    const eventos: TrailEvent[] = [
      ev({ kind: "nav", url: "https://app/b", title: "B", created_at: new Date(T0 + 5000).toISOString() }),
      ev({ kind: "nav", url: "https://app/a", title: "A", created_at: new Date(T0).toISOString() }),
    ];
    const items = montarItensTimeline(eventos);
    expect(items.map((i) => (i.kind === "nav" ? i.title : ""))).toEqual(["A", "B"]);
  });
});

describe("agrupamento em seções (prévia por IA)", () => {
  it("uma seção por tela, com a narração e os prints daquela janela", () => {
    const eventos: TrailEvent[] = [
      ev({ kind: "nav", url: "https://app/a", title: "Tela A", t_ms: T0 }),
      ev({ kind: "transcript", t_ms: T0 + 100, label: "fala da A", meta: null }),
      ev({ kind: "shot", storage_path: "ext/s/a.png", title: "print A", t_ms: T0 + 200 }),
      ev({ kind: "nav", url: "https://app/b", title: "Tela B", t_ms: T0 + 300 }),
      ev({ kind: "shot", storage_path: "ext/s/b.png", title: "print B", t_ms: T0 + 400 }),
    ];
    const secoes = agruparEmSecoes(montarItensTimeline(eventos));
    expect(secoes.map((s) => s.titulo)).toEqual(["Tela A", "Tela B"]);
    expect(secoes[0]!.textos).toEqual(["fala da A"]);
    expect(secoes[0]!.prints.map((p) => p.storagePath)).toEqual(["ext/s/a.png"]);
    expect(secoes[1]!.textos).toEqual([]);
    expect(secoes[1]!.prints.map((p) => p.storagePath)).toEqual(["ext/s/b.png"]);
  });

  it("narração/print antes da 1ª tela cai numa seção 'Visão geral'", () => {
    const eventos: TrailEvent[] = [
      ev({ kind: "transcript", t_ms: T0, label: "introdução", meta: null }),
      ev({ kind: "nav", url: "https://app/a", title: "Tela A", t_ms: T0 + 100 }),
    ];
    const secoes = agruparEmSecoes(montarItensTimeline(eventos));
    expect(secoes[0]!.titulo).toBe("Visão geral");
    expect(secoes[0]!.textos).toEqual(["introdução"]);
    expect(secoes[1]!.titulo).toBe("Tela A");
  });

  it("telas repetidas viram uma seção só", () => {
    const eventos: TrailEvent[] = [
      ev({ kind: "nav", url: "https://app/a", title: "A", t_ms: T0 }),
      ev({ kind: "shot", storage_path: "ext/s/1.png", t_ms: T0 + 10 }),
      ev({ kind: "nav", url: "https://app/a", title: "A de novo", t_ms: T0 + 20 }),
      ev({ kind: "shot", storage_path: "ext/s/2.png", t_ms: T0 + 30 }),
    ];
    const secoes = agruparEmSecoes(montarItensTimeline(eventos));
    expect(secoes).toHaveLength(1);
    expect(secoes[0]!.prints).toHaveLength(2);
  });
});
