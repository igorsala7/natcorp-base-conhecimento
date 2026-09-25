import { describe, it, expect } from "vitest";
import { alcanca, identidadeDoRastreio, chavesProblematicasDaRegra, normalizarRegra } from "./alcanca";
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

/**
 * AS DUAS FUNÇÕES DO CAMINHO DE GRAVAÇÃO iteravam a lista fixa de dimensões
 * enquanto o predicado iterava a regra, e a consequência era medida:
 *
 *   alcanca({centro_custos:["100"]}, {centro_custo:"100"})  = false  (fecha)
 *   normalizarRegra({centro_custos:["100"]})                = {}     (a
 *                                                   restrição DESAPARECIA)
 *   dimensoesComRestricaoVazia({centro_custos:["100"]})     = []     (nada
 *                                                                  acusava)
 *   normalizarRegra({portal:"PG"})                          derrubava
 *
 * Ou seja: a função anunciada como guarda do caminho de gravação transformava
 * em silêncio uma regra que FECHA numa regra que ABRE, e derrubava justamente
 * na forma malformada que ela existia para recusar.
 */
describe("normalizarRegra", () => {
  it("tira branco, caixa e duplicata, e some com dimensão que ficou vazia", () => {
    expect(normalizarRegra({ portal: ["PG", "pg", "", " PG "], perfil: ["  "] })).toEqual({
      portal: ["pg"],
    });
  });

  it("não muda regra bem formada", () => {
    const boa = { portal: ["pg"], perfil: ["folha"], centro_custo: ["100", "200"] };
    expect(normalizarRegra(boa)).toEqual(boa);
  });

  it("NÃO DERRUBA em valor malformado — descarta a dimensão e segue", () => {
    const comoVemDoBanco = (v: unknown) => ({ portal: v, perfil: ["FOLHA"] }) as never;
    expect(normalizarRegra(comoVemDoBanco("PG"))).toEqual({ perfil: ["folha"] });
    expect(normalizarRegra(comoVemDoBanco(123))).toEqual({ perfil: ["folha"] });
    expect(normalizarRegra(comoVemDoBanco({ a: 1 }))).toEqual({ perfil: ["folha"] });
    expect(normalizarRegra(comoVemDoBanco(null))).toEqual({ perfil: ["folha"] });
  });

  /**
   * Descartar a chave desconhecida continua sendo o comportamento — o que
   * mudou é que descartar deixou de ser silencioso: quem ACUSA é o validador,
   * e o caminho de gravação chama o validador ANTES de normalizar.
   */
  it("descarta chave que não é dimensão, mas quem acusa é o validador", () => {
    expect(normalizarRegra({ centro_custos: ["100"] } as never)).toEqual({});
    expect(chavesProblematicasDaRegra({ centro_custos: ["100"] } as never)).toEqual([
      "centro_custos",
    ]);
  });

  it("não derruba com a regra inteira malformada", () => {
    expect(normalizarRegra(null as never)).toEqual({});
    expect(normalizarRegra(undefined as never)).toEqual({});
    expect(normalizarRegra(7 as never)).toEqual({});
    expect(normalizarRegra(["PG"] as never)).toEqual({});
  });
});

describe("chavesProblematicasDaRegra", () => {
  it("acusa dimensão com itens todos em branco", () => {
    expect(chavesProblematicasDaRegra({ portal: ["", "  "] })).toEqual(["portal"]);
  });

  it("acusa chave que não é dimensão", () => {
    expect(chavesProblematicasDaRegra({ centro_custos: ["100"] } as never)).toEqual([
      "centro_custos",
    ]);
    expect(chavesProblematicasDaRegra({ foo: ["x"], portal: ["PG"] } as never)).toEqual(["foo"]);
  });

  it("acusa valor que não é lista, e NÃO derruba", () => {
    const comoVemDoBanco = (v: unknown) => ({ portal: v }) as never;
    expect(chavesProblematicasDaRegra(comoVemDoBanco("PG"))).toEqual(["portal"]);
    expect(chavesProblematicasDaRegra(comoVemDoBanco(123))).toEqual(["portal"]);
    expect(chavesProblematicasDaRegra(comoVemDoBanco({ a: 1 }))).toEqual(["portal"]);
  });

  it("não acusa dimensão ausente, nula, vazia, nem lista com um valor real", () => {
    expect(chavesProblematicasDaRegra({})).toEqual([]);
    expect(chavesProblematicasDaRegra({ portal: [] })).toEqual([]);
    expect(chavesProblematicasDaRegra({ portal: null } as never)).toEqual([]);
    // Um valor real sobrevive ao branco: isto RESTRINGE, e recusar o
    // salvamento aqui impediria a regra legítima.
    expect(chavesProblematicasDaRegra({ portal: ["", "PG"] })).toEqual([]);
  });

  it("acusa tudo de uma vez, porque a mensagem precisa nomear cada campo", () => {
    const regra = { portal: ["", " "], centro_custos: ["100"], perfil: "FOLHA" } as never;
    expect(chavesProblematicasDaRegra(regra).sort()).toEqual([
      "centro_custos",
      "perfil",
      "portal",
    ]);
  });

  it("não derruba com a regra inteira malformada", () => {
    expect(chavesProblematicasDaRegra(null as never)).toEqual([]);
    expect(chavesProblematicasDaRegra(undefined as never)).toEqual([]);
    expect(chavesProblematicasDaRegra(7 as never)).toEqual([]);
  });
});
