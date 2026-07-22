import { describe, it, expect } from "vitest";
import { origemPermitida, temRestricaoDeOrigem } from "./origin-gate";

const PERMITIDAS = ["https://www.natcorp.com.br/apex/f?p=200"];

describe("origemPermitida", () => {
  it("referer ausente ou inválido bloqueia", () => {
    expect(origemPermitida(null, PERMITIDAS)).toBe(false);
    expect(origemPermitida("", PERMITIDAS)).toBe(false);
    expect(origemPermitida("não-é-url", PERMITIDAS)).toBe(false);
  });

  it("política padrão dos navegadores: só a origem chega — libera pela origem", () => {
    expect(origemPermitida("https://www.natcorp.com.br/", PERMITIDAS)).toBe(true);
  });

  it("parâmetros da URL variam (caso APEX): prefixo do caminho libera", () => {
    expect(
      origemPermitida("https://www.natcorp.com.br/apex/f?p=200:P_USUARIO&JOAO", PERMITIDAS),
    ).toBe(true);
  });

  it("mesma origem mas caminho fora do prefixo configurado bloqueia", () => {
    expect(origemPermitida("https://www.natcorp.com.br/outra/area", PERMITIDAS)).toBe(false);
  });

  it("origem diferente bloqueia (scheme e host contam)", () => {
    expect(origemPermitida("https://outro.com.br/apex/f?p=200", PERMITIDAS)).toBe(false);
    expect(origemPermitida("http://www.natcorp.com.br/apex/f?p=200", PERMITIDAS)).toBe(false);
  });

  it("várias URLs permitidas: qualquer uma libera", () => {
    const varias = [...PERMITIDAS, "https://homolog.natcorp.com.br"];
    expect(origemPermitida("https://homolog.natcorp.com.br/qualquer", varias)).toBe(true);
  });

  it("navegação interna (self host) sempre passa", () => {
    expect(
      origemPermitida("https://docs.meusite.com.br/docs/global/artigo", PERMITIDAS, [
        "docs.meusite.com.br",
      ]),
    ).toBe(true);
  });

  it("config inválida na lista é ignorada sem liberar", () => {
    expect(origemPermitida("https://x.com/", ["isto não é url"])).toBe(false);
  });
});

describe("temRestricaoDeOrigem", () => {
  it("null/vazia/só lixo = sem restrição; uma URL válida ativa", () => {
    expect(temRestricaoDeOrigem(null)).toBe(false);
    expect(temRestricaoDeOrigem([])).toBe(false);
    expect(temRestricaoDeOrigem(["lixo"])).toBe(false);
    expect(temRestricaoDeOrigem(["https://a.com"])).toBe(true);
  });
});
