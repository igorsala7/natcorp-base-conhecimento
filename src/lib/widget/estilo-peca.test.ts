import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * As opções de estilo da bolha e do avatar viram CSS dentro de um `style` —
 * e `widget_keys.config` é texto vindo do banco. Validar não é zelo: sem isso,
 * quem edita a configuração escreve CSS arbitrário na página do cliente.
 *
 * O `widget.js` não é módulo, então a função é lida do arquivo e avaliada
 * isolada — mesmo caminho dos testes de markdown e de tabela.
 */
function corOk(): (v: unknown, extras?: string[]) => string | null {
  const src = readFileSync("public/widget.js", "utf8");
  const ini = src.indexOf("  function corOk(");
  if (ini < 0) throw new Error("corOk() não existe mais em public/widget.js");
  const fim = src.indexOf("\n  }\n", ini);
  return new Function(`${src.slice(ini, fim + 4)}\nreturn corOk;`)();
}

const cor = corOk();

describe("corOk — o que pode virar CSS", () => {
  it("aceita hex de 6 e de 3, com ou sem #", () => {
    expect(cor("#511C76")).toBe("#511C76");
    expect(cor("511C76")).toBe("#511C76");
    expect(cor("#abc")).toBe("#abc");
  });

  it("aceita as palavras liberadas — e só elas", () => {
    expect(cor("transparent", ["transparent"])).toBe("transparent");
    expect(cor("transparent")).toBeNull(); // sem liberar, não passa
    expect(cor("red", ["transparent"])).toBeNull();
  });

  it("recusa qualquer coisa que não seja cor", () => {
    // O alvo real: fechar a declaração e emendar outra.
    expect(cor("red;position:fixed;top:0")).toBeNull();
    expect(cor("url(javascript:alert(1))")).toBeNull();
    expect(cor("var(--x)")).toBeNull();
    expect(cor("#5511C7699")).toBeNull();
    expect(cor("")).toBeNull();
    expect(cor(null)).toBeNull();
  });
});
