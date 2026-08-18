import { describe, it, expect } from "vitest";
import { widgetLiberado, normalizarPaineis, ehPainel, bloqueioPorIdentidade } from "./disponibilidade";

describe("widgetLiberado", () => {
  it("NULL = todos os painéis — é o que toda base já cadastrada tem", () => {
    // Tratar null como vazio desligaria o widget de todo mundo de uma vez.
    expect(widgetLiberado(null, "PO")).toBe(true);
    expect(widgetLiberado(undefined, "PC")).toBe(true);
  });

  it("lista recorta por painel", () => {
    expect(widgetLiberado(["PG", "PC"], "PG")).toBe(true);
    expect(widgetLiberado(["PG", "PC"], "PO")).toBe(false);
  });

  it("lista vazia desliga o widget da base inteira", () => {
    expect(widgetLiberado([], "PO")).toBe(false);
  });

  it("base inativa manda, aconteça o que acontecer na lista", () => {
    for (const p of [null, [], ["PO", "PG", "PC"], ["PO"]]) {
      expect(widgetLiberado(p, "PO", false), JSON.stringify(p)).toBe(false);
    }
  });

  it("caixa e espaço não decidem acesso", () => {
    expect(widgetLiberado(["po"], " PO ")).toBe(true);
  });
});

/**
 * A postura mudou em 18/08, por decisão do Igor: "Se não tiver token, também
 * não disponibiliza." Estes casos ANTES devolviam `true` e agora devolvem
 * `false` — ficam separados para que a mudança seja legível no diff, e não
 * pareça um teste que sempre existiu assim.
 */
describe("negar na dúvida — o que mudou", () => {
  it("painel NÃO identificado com lista definida passa a bloquear", () => {
    // O teste antigo afirmava `true` aqui, com a justificativa de que portal
    // público e instalação sem rastreio não estão em painel nenhum. Deixou de
    // valer: se o cliente escolheu quais painéis valem, "não sei em qual estou"
    // não é um deles.
    expect(widgetLiberado(["PG"], null)).toBe(false);
    expect(widgetLiberado(["PG"], "")).toBe(false);
    expect(widgetLiberado(["PG"], "XX")).toBe(false);
  });

  it("lista vazia bloqueia mesmo sem painel identificado", () => {
    // Antes `[]` com painel desconhecido caía no ramo do `true`. Com painel
    // conhecido já bloqueava (o teste acima) — era só esta fresta.
    expect(widgetLiberado([], null)).toBe(false);
  });

  it("NULL continua liberando — o estado de quem nunca configurou", () => {
    expect(widgetLiberado(null, null)).toBe(true);
  });
});

describe("bloqueioPorIdentidade", () => {
  it("os três motivos são distintos, e a investigação de cada um é outra", () => {
    // "a tela não põe data-token" × "o token não decodifica com a chave deste
    // espaço" × "o token não traz p_base" — consertos em lugares diferentes.
    expect(bloqueioPorIdentidade({ temToken: false, decodificou: false, baseCode: "" })).toBe("sem_token");
    expect(bloqueioPorIdentidade({ temToken: true, decodificou: false, baseCode: "" })).toBe("token_invalido");
    expect(bloqueioPorIdentidade({ temToken: true, decodificou: true, baseCode: "  " })).toBe("sem_base");
  });

  it("com token válido e base nomeada, não bloqueia por identidade", () => {
    expect(bloqueioPorIdentidade({ temToken: true, decodificou: true, baseCode: "leadec" })).toBeNull();
  });
});

describe("normalizarPaineis", () => {
  it("descarta lixo e repetição, e mantém a ordem PO/PG/PC", () => {
    expect(normalizarPaineis(["pc", "po", "PO", "lixo"])).toEqual(["PO", "PC"]);
  });

  it("null continua null — não vira lista vazia", () => {
    expect(normalizarPaineis(null)).toBeNull();
    expect(normalizarPaineis("PO")).toBeNull(); // não-array = não configurado
  });

  it("ehPainel só aceita os três", () => {
    expect(ehPainel("PO")).toBe(true);
    expect(ehPainel("PCAND")).toBe(false);
  });
});
