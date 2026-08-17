import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { RAMPA, ROXO, ROSA, AZUL, MARCA, CORES_GRAFICO, paraRgb, paraUnidade, semCerquilha, clarear, entre, degrade, losango, losangoPath } from "./marca";

describe("a marca não pode divergir do Tailwind", () => {
  it("as rampas aqui são as mesmas de tailwind.config.ts", () => {
    // As rampas foram COPIADAS (o config é de build; puxá-lo para o runtime do
    // servidor por trinta hex custa mais que a duplicação). Este teste é o
    // preço da cópia: sem ele, mexer numa e esquecer da outra passa batido, e
    // documento e tela deixam de falar a mesma língua sem ninguém perceber.
    const cfg = fs.readFileSync("tailwind.config.ts", "utf-8");
    const noConfig = (nome: string, degrau: number) => {
      const bloco = cfg.slice(cfg.indexOf(`${nome}: {`));
      const m = bloco.match(new RegExp(`\\b${degrau}:\\s*"(#[0-9A-Fa-f]{6})"`));
      return m?.[1]?.toUpperCase() ?? null;
    };
    expect(noConfig("purple", 700)).toBe(ROXO);
    expect(noConfig("pink", 500)).toBe(ROSA);
    expect(noConfig("blue", 800)).toBe(AZUL);
  });

  it("os âncoras são os do CLAUDE.md", () => {
    expect([ROXO, ROSA, AZUL]).toEqual(["#511C76", "#C95788", "#2C1A63"]);
  });

  it("cada rampa tem os 11 degraus", () => {
    for (const r of [RAMPA.roxo, RAMPA.rosa, RAMPA.azul]) {
      expect(Object.keys(r)).toHaveLength(11);
      for (const v of Object.values(r)) expect(v).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe("conversão de cor", () => {
  it("converte para os três alfabetos que as libs falam", () => {
    expect(paraRgb(ROXO)).toEqual([81, 28, 118]);          // o RGB do CLAUDE.md
    expect(paraUnidade("#FFFFFF")).toEqual([1, 1, 1]);      // pdf-lib
    expect(semCerquilha("#c95788")).toBe("C95788");         // docx/pptx/exceljs
  });

  it("hex torto vira o roxo da marca, e não preto nem exceção", () => {
    // Um documento com uma faixa preta por causa de um hex errado é pior que um
    // documento com a cor certa por acidente.
    for (const v of ["", "nao é cor", "#12345", null as never, undefined as never]) {
      expect(paraRgb(v)).toEqual([81, 28, 118]);
    }
  });

  it("clarear e interpolar respeitam os extremos", () => {
    expect(clarear(ROXO, 0)).toBe(ROXO);
    expect(clarear(ROXO, 1)).toBe("#FFFFFF");
    expect(clarear(ROXO, 5)).toBe("#FFFFFF");   // fora da faixa não estoura
    expect(entre(ROXO, ROSA, 0)).toBe(ROXO);
    expect(entre(ROXO, ROSA, 1)).toBe(ROSA);
    expect(entre("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });
});

describe("degradê da faixa", () => {
  it("começa e termina nas paradas declaradas", () => {
    const g = degrade(120);
    expect(g).toHaveLength(120);
    expect(g[0]).toBe(MARCA.faixa[0]);
    expect(g.at(-1)).toBe(MARCA.faixa[2]);
  });

  it("PASSA pelo roxo da marca no meio", () => {
    // Interpolar do primeiro ao último direto daria azul→rosa e o roxo — que é a
    // marca — sumiria justamente no elemento mais visível do documento.
    expect(degrade(3)).toEqual([MARCA.faixa[0], ROXO, MARCA.faixa[2]]);
    expect(degrade(121)[60]).toBe(ROXO);
  });

  it("não quebra em tamanhos degenerados", () => {
    expect(degrade(1)).toEqual([MARCA.faixa[0]]);
    expect(degrade(0)).toEqual([MARCA.faixa[0]]);
    expect(degrade(4, ["#000000"])).toEqual(["#000000", "#000000", "#000000", "#000000"]);
  });
});

describe("losango da marca", () => {
  it("são 4 vértices no sentido horário a partir do topo", () => {
    expect(losango(100, 100, 20)).toEqual([
      { x: 100, y: 90 }, { x: 110, y: 100 }, { x: 100, y: 110 }, { x: 90, y: 100 },
    ]);
  });

  it("o path fecha, e com raio vira curva em vez de reta", () => {
    expect(losangoPath(50, 50, 20)).toMatch(/^M .* Z$/);
    expect(losangoPath(50, 50, 20)).not.toContain("Q");
    expect(losangoPath(50, 50, 20, 4)).toContain("Q");
  });

  it("raio maior que o losango não inverte a forma", () => {
    expect(() => losangoPath(50, 50, 10, 40)).not.toThrow();
  });
});

describe("cores de gráfico", () => {
  it("abre pela tríade da marca", () => {
    expect(CORES_GRAFICO.slice(0, 3)).toEqual([ROXO, ROSA, AZUL]);
  });

  it("são todas hex válidos e sem repetição", () => {
    for (const c of CORES_GRAFICO) expect(c).toMatch(/^#[0-9A-F]{6}$/);
    expect(new Set(CORES_GRAFICO).size).toBe(CORES_GRAFICO.length);
  });
});
