import { describe, it, expect } from "vitest";
import { styleClass } from "./styles";
import { ICONS, iconByKey } from "./icons";

describe("styleClass", () => {
  it("sem estilos → string vazia (bloco não é embrulhado)", () => {
    expect(styleClass(undefined)).toBe("");
    expect(styleClass({})).toBe("");
  });

  it("tamanho da fonte e alinhamento", () => {
    expect(styleClass({ fontSize: "2xl", align: "center" })).toContain("text-2xl");
    expect(styleClass({ fontSize: "2xl", align: "center" })).toContain("text-center");
  });

  it("borda só sai com espessura, e usa a cor padrão quando não escolhida", () => {
    expect(styleClass({ borderColor: "primary" })).toBe(""); // sem espessura → sem borda
    const s = styleClass({ borderWidth: 2, borderColor: "primary" });
    expect(s).toContain("border-2");
    expect(s).toContain("border-primary");
    expect(styleClass({ borderWidth: 1 })).toContain("border-border");
  });

  it("largura menor que 100% aplica a posição na página", () => {
    expect(styleClass({ width: "half", justify: "center" })).toContain("mx-auto");
    expect(styleClass({ width: "half", justify: "right" })).toContain("ml-auto");
    // largura total não posiciona
    expect(styleClass({ width: "full", justify: "center" })).not.toContain("mx-auto");
  });

  it("altura mínima e espaçamentos", () => {
    const s = styleClass({ minHeight: 4, paddingX: 3, marginY: 2 });
    expect(s).toContain("min-h-48");
    expect(s).toContain("px-4");
    expect(s).toContain("my-3");
  });

  it("valores fora da whitelist não viram classe", () => {
    // @ts-expect-error valor inválido de propósito
    expect(styleClass({ bgColor: "javascript:alert(1)" })).toBe("");
  });
});

describe("catálogo de ícones", () => {
  it("resolve por chave e ignora chave desconhecida", () => {
    expect(iconByKey("rocket")).toBe(ICONS.rocket);
    expect(iconByKey("nao-existe")).toBeNull();
    expect(iconByKey(undefined)).toBeNull();
  });
});
