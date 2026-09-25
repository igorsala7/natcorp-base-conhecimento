import { describe, it, expect } from "vitest";
import { alcanca, identidadeDoRastreio, dimensoesComRestricaoVazia, normalizarRegra } from "./alcanca";
import { DIMENSOES } from "./dimensoes";

describe("alcanca", () => {
  it("regra vazia alcança qualquer um, inclusive identidade vazia", () => {
    expect(alcanca({}, { base: "leadec", portal: "PG" })).toBe(true);
    expect(alcanca({}, {})).toBe(true);
  });

  it("dentro da dimensão é OU", () => {
    expect(alcanca({ portal: ["PG", "PC"] }, { portal: "PC" })).toBe(true);
    expect(alcanca({ portal: ["PG", "PC"] }, { portal: "PO" })).toBe(false);
  });

  it("entre dimensões é E", () => {
    const regra = { portal: ["PG"], perfil: ["FOLHA"] };
    expect(alcanca(regra, { portal: "PG", perfil: "FOLHA" })).toBe(true);
    expect(alcanca(regra, { portal: "PG", perfil: "RH" })).toBe(false);
  });

  it("compara por lower(btrim) dos dois lados", () => {
    expect(alcanca({ portal: ["  pg "] }, { portal: "PG" })).toBe(true);
    expect(alcanca({ centro_custo: ["100"] }, { centro_custo: " 100 " })).toBe(true);
  });

  it("valor ausente contra dimensão restrita FECHA", () => {
    expect(alcanca({ centro_custo: ["100"] }, { centro_custo: null })).toBe(false);
    expect(alcanca({ centro_custo: ["100"] }, {})).toBe(false);
    expect(alcanca({ centro_custo: ["100"] }, { centro_custo: "  " })).toBe(false);
  });

  /**
   * O espelho do furo do SQL: branco na lista não pode abrir o que ausência
   * fecha. Se estes dois passarem a divergir do banco, o script de paridade
   * acusa — mas é aqui que o defeito nasce.
   */
  it("branco na lista não libera quem não tem o valor", () => {
    expect(alcanca({ portal: ["", "PG"] }, { portal: null })).toBe(false);
    expect(alcanca({ portal: ["", "PG"] }, { portal: "PG" })).toBe(true);
  });

  it("lista só de brancos não restringe", () => {
    expect(alcanca({ portal: ["", "  "] }, { portal: null })).toBe(true);
  });

  /**
   * A REGRA VEM DE UMA COLUNA `jsonb`, então o tipo não protege em execução.
   * Estes casos existem porque a primeira versão do predicado tinha DOIS
   * defeitos aqui: `.map` num string derrubava o turno, e o gêmeo em SQL abria
   * o conteúdo em vez de fechar. Os dois lados agora fecham.
   */
  it("valor de regra malformado FECHA, e não derruba", () => {
    const comoVemDoBanco = (v: unknown) => ({ portal: v }) as never;
    expect(alcanca(comoVemDoBanco("PG"), { portal: null })).toBe(false);
    expect(alcanca(comoVemDoBanco("PG"), { portal: "PG" })).toBe(false);
    expect(alcanca(comoVemDoBanco(123), { portal: "123" })).toBe(false);
    expect(alcanca(comoVemDoBanco({ a: 1 }), { portal: "a" })).toBe(false);
  });

  it("null na dimensão é 'não configurada', não restrição vazia", () => {
    const comoVemDoBanco = (v: unknown) => ({ portal: v }) as never;
    expect(alcanca(comoVemDoBanco(null), { portal: null })).toBe(true);
  });

  it("item não-texto dentro da lista é convertido, como o SQL faz", () => {
    // `x #>> '{}'` do SQL transforma o número 100 em '100'. Se o TypeScript
    // não convertesse, a regra casaria de um lado só e o script de paridade
    // acusaria — mas só depois de a divergência existir.
    const comoVemDoBanco = (v: unknown) => ({ centro_custo: v }) as never;
    expect(alcanca(comoVemDoBanco([100]), { centro_custo: "100" })).toBe(true);
  });

  it("chave que não é dimensão FECHA, e não é ignorada", () => {
    // Iterar a lista fixa de dimensões ignorava isto, e ignorar abre: uma regra
    // com `centro_custos` (plural) não restringiria nada. O SQL já fechava.
    const comTypo = { centro_custos: ["100"] } as never;
    expect(alcanca(comTypo, { centro_custo: "100" })).toBe(false);
    expect(alcanca(comTypo, {})).toBe(false);
  });

  it("chave desconhecida com valor null é ignorada, como no SQL", () => {
    expect(alcanca({ foo: null } as never, {})).toBe(true);
  });

  it("cobre as doze dimensões, uma por uma", () => {
    for (const d of DIMENSOES) {
      expect(alcanca({ [d]: ["x"] }, { [d]: "x" })).toBe(true);
      expect(alcanca({ [d]: ["x"] }, { [d]: "y" })).toBe(false);
      expect(alcanca({ [d]: ["x"] }, {})).toBe(false);
    }
  });
});

describe("identidadeDoRastreio", () => {
  it("traduz os parâmetros p_* para dimensões", () => {
    const id = identidadeDoRastreio({
      p_base: "leadec",
      p_centro_custo: "100",
      p_cod_candidato: "9999",
    });
    expect(id.base).toBe("leadec");
    expect(id.centro_custo).toBe("100");
    expect("cod_candidato" in id).toBe(false);
  });
});

describe("normalizarRegra", () => {
  it("tira branco, caixa e duplicata, e some com dimensão que ficou vazia", () => {
    expect(normalizarRegra({ portal: ["PG", "pg", "", " PG "], perfil: ["  "] })).toEqual({
      portal: ["pg"],
    });
  });
});

describe("dimensoesComRestricaoVazia", () => {
  it("acusa dimensão com itens todos em branco", () => {
    expect(dimensoesComRestricaoVazia({ portal: ["", "  "] })).toEqual(["portal"]);
  });

  it("não acusa dimensão ausente nem lista legítima", () => {
    expect(dimensoesComRestricaoVazia({})).toEqual([]);
    expect(dimensoesComRestricaoVazia({ portal: [] })).toEqual([]);
    expect(dimensoesComRestricaoVazia({ portal: ["", "PG"] })).toEqual([]);
  });
});
