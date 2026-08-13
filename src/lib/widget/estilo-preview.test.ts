import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { estiloDaPeca, estiloDaImagem, derivar, FORMA, TAMANHO } from "./estilo-preview";

/**
 * Uma prévia que não bate com o resultado é PIOR que nenhuma: a pessoa publica
 * confiando nela. Estes testes existem para as regras daqui não descolarem das
 * do `widget.js` — inclusive lendo o widget do disco para comparar as tabelas.
 */

const base = {
  fundo: "",
  fundo2: "",
  borda: 0,
  corBorda: "#ffffff",
  formato: "circle",
  recorte: "cover" as const,
  tamanho: 60,
  primaria: "#511C76",
  secundaria: "",
};

describe("paridade com o widget.js", () => {
  const src = readFileSync("public/widget.js", "utf8");

  it("as formas são as mesmas", () => {
    // No widget: var FORMA = { circle: "50%", rounded: "30%", square: "18%" };
    const m = /var FORMA = \{([^}]+)\}/.exec(src);
    expect(m).not.toBeNull();
    for (const [k, v] of Object.entries(FORMA)) {
      expect(m![1]).toContain(`${k}: "${v}"`);
    }
  });

  it("os tamanhos de bolha são os mesmos", () => {
    const m = /var TAM = \{([^}]+)\}/.exec(src);
    expect(m).not.toBeNull();
    for (const [k, v] of Object.entries(TAMANHO)) {
      expect(m![1]).toContain(`${k}: "${v}px"`);
    }
  });

  it("a mistura da cor secundária automática é a mesma", () => {
    // O widget mistura 68% da cor com 32% de #6d5ae6.
    expect(src).toContain("0.68");
    expect(src).toContain("0x6d");
    expect(derivar("#000000")).toBe("#231d4a");
    // 0x51*0.68 + 0x6d*0.32 = 90 (0x5a); idem para os outros canais.
    expect(derivar("#511C76")).toBe("#5a309a");
  });
});

describe("estiloDaPeca — os quatro estados do fundo", () => {
  it("vazio = gradiente da marca", () => {
    expect(estiloDaPeca(base).background).toBe("linear-gradient(135deg,#511C76,#5a309a)");
  });

  it("secundária escolhida entra no lugar da derivada", () => {
    expect(estiloDaPeca({ ...base, secundaria: "#C95788" }).background).toBe(
      "linear-gradient(135deg,#511C76,#C95788)",
    );
  });

  it("cor sólida", () => {
    expect(estiloDaPeca({ ...base, fundo: "#123456" }).background).toBe("#123456");
  });

  it("degradê próprio usa as duas cores da peça, não as da marca", () => {
    expect(estiloDaPeca({ ...base, fundo: "#111111", fundo2: "#222222" }).background).toBe(
      "linear-gradient(135deg,#111111,#222222)",
    );
  });

  it("transparente é transparente — é o caso do logo com fundo próprio", () => {
    expect(estiloDaPeca({ ...base, fundo: "transparent" }).background).toBe("transparent");
  });

  it("cor inválida não vira CSS quebrado: cai no gradiente da marca", () => {
    expect(estiloDaPeca({ ...base, fundo: "vermelho" }).background).toContain("linear-gradient");
  });
});

describe("estiloDaPeca — borda, formato e sombra", () => {
  it("sem borda não escreve a propriedade", () => {
    expect(estiloDaPeca(base).border).toBeUndefined();
  });

  it("com borda usa a cor escolhida, e cor inválida cai no branco", () => {
    expect(estiloDaPeca({ ...base, borda: 3, corBorda: "#ff0000" }).border).toBe("3px solid #ff0000");
    expect(estiloDaPeca({ ...base, borda: 2, corBorda: "xx" }).border).toBe("2px solid #ffffff");
  });

  it("a borda entra PARA DENTRO (box-sizing), como no widget", () => {
    // Sem isto a peça com borda ficaria maior que o tamanho escolhido.
    expect(estiloDaPeca({ ...base, borda: 4 }).boxSizing).toBe("border-box");
  });

  it("formato vira raio; desconhecido é círculo", () => {
    expect(estiloDaPeca({ ...base, formato: "square" }).borderRadius).toBe("18%");
    expect(estiloDaPeca({ ...base, formato: "seja-la-o-que-for" }).borderRadius).toBe("50%");
  });

  it("sombra só existe quando a peça tem essa opção (a bolha)", () => {
    expect(estiloDaPeca(base).boxShadow).toBeUndefined();
    expect(estiloDaPeca({ ...base, sombra: "none" }).boxShadow).toBe("none");
    expect(estiloDaPeca({ ...base, sombra: "soft" }).boxShadow).toContain("0 4px 12px");
  });
});

describe("estiloDaImagem", () => {
  it("o recorte é o que decide se o fundo aparece", () => {
    expect(estiloDaImagem("cover", "circle").objectFit).toBe("cover");
    expect(estiloDaImagem("contain", "circle").objectFit).toBe("contain");
  });

  it("a imagem acompanha o formato da peça", () => {
    expect(estiloDaImagem("cover", "rounded").borderRadius).toBe("30%");
  });
});
