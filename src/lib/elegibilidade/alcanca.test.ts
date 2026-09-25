import { describe, it, expect } from "vitest";
import {
  alcanca,
  identidadeDoRastreio,
  chavesProblematicasDaRegra,
  normalizarRegra,
  textoComoNoJsonb,
} from "./alcanca";
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

  /**
   * A REGRA INTEIRA, e não uma dimensão dela. Os dois lados divergiam aqui e o
   * corpus não cobria: `regra = 7` devolvia TRUE no TypeScript (porque
   * `Object.entries(7)` é `[]`, e regra malformada parecia regra vazia) e erro
   * no SQL. `undefined` só existe do lado TypeScript — JSON não o expressa —,
   * então este é o único lugar onde ele pode ser fixado.
   */
  it("regra INTEIRA nula é 'sem regra' e LIBERA", () => {
    expect(alcanca(null as never, { portal: "PG" })).toBe(true);
    expect(alcanca(undefined as never, { portal: "PG" })).toBe(true);
  });

  it("regra INTEIRA que não é objeto FECHA", () => {
    expect(alcanca(7 as never, { portal: "PG" })).toBe(false);
    expect(alcanca("PG" as never, { portal: "PG" })).toBe(false);
    expect(alcanca(["PG"] as never, { portal: "PG" })).toBe(false);
    expect(alcanca(true as never, {})).toBe(false);
  });

  /**
   * IDENTIDADE QUE NÃO É TEXTO derrubava o turno em vez de negar acesso.
   *
   * `norm` fazia `(v ?? "").trim()`, e `trim` não existe em número, booleano nem
   * array. Medido antes da correção:
   *
   *   alcanca({centro_custo:["100"]}, {centro_custo: 100})  TypeError
   *   alcanca({vinculo:["true"]},     {vinculo: true})      TypeError
   *   public.elegivel nos mesmos casos                      true / true
   *
   * Mesmo princípio que esta onda aplicou à REGRA e tinha esquecido na
   * IDENTIDADE: autorização que estoura devolve 500 onde devia devolver
   * negação — aqui, derrubaria o turno do chat. Hoje não dispara porque
   * `identidadeDoRastreio` só produz texto; dispara quando a identidade vier de
   * coluna do banco.
   */
  it("identidade numérica ou booleana é convertida, não derruba", () => {
    const comoViraDoBanco = (v: unknown) => ({ centro_custo: v }) as never;
    expect(alcanca({ centro_custo: ["100"] }, comoViraDoBanco(100))).toBe(true);
    expect(alcanca({ centro_custo: ["100"] }, comoViraDoBanco(200))).toBe(false);
    expect(alcanca({ vinculo: ["true"] }, { vinculo: true } as never)).toBe(true);
    expect(alcanca({ vinculo: ["true"] }, { vinculo: false } as never)).toBe(false);
    expect(alcanca({ centro_custo: ["1.5"] }, comoViraDoBanco(1.5))).toBe(true);
  });

  /**
   * O PERIGO era `String(["PG"]) === "PG"`: a identidade em array casaria com a
   * regra `["PG"]` e ABRIRIA o que o banco nega, porque o `#>> '{}'` do SQL
   * entrega o TEXTO JSON `["PG"]`, não `PG`.
   */
  it("identidade em array ou objeto NÃO casa com o item solto da lista", () => {
    expect(alcanca({ portal: ["PG"] }, { portal: ["PG"] } as never)).toBe(false);
    expect(alcanca({ portal: ["PG"] }, { portal: { a: 1 } } as never)).toBe(false);
    // ...e casa quando a regra tem exatamente o texto JSON, como no SQL.
    expect(alcanca({ portal: ['["PG"]'] }, { portal: ["PG"] } as never)).toBe(true);
    expect(alcanca({ portal: ['{"a": 1}'] }, { portal: { a: 1 } } as never)).toBe(true);
  });

  it("item de regra que não é texto usa a MESMA conversão do valor", () => {
    // No SQL os dois passam pelo mesmo `#>> '{}'`: o item por
    // `array_agg(x #>> '{}')`, o valor por `identidade #>> array[dim]`.
    expect(alcanca({ portal: [["PG"]] } as never, { portal: '["PG"]' })).toBe(true);
    expect(alcanca({ portal: [["PG"]] } as never, { portal: "PG" })).toBe(false);
  });

  it("cobre as doze dimensões, uma por uma", () => {
    for (const d of DIMENSOES) {
      expect(alcanca({ [d]: ["x"] }, { [d]: "x" })).toBe(true);
      expect(alcanca({ [d]: ["x"] }, { [d]: "y" })).toBe(false);
      expect(alcanca({ [d]: ["x"] }, {})).toBe(false);
    }
  });
});

/**
 * A CONVERSÃO, MEDIDA CONTRA O BANCO em 25/09.
 *
 * Cada string esperada aqui foi lida de
 * `select $1::jsonb #>> array['v']` com o valor correspondente — 24 formas, todas
 * coincidindo. Não são valores que eu achei razoáveis: são os que o Postgres
 * devolve. `JSON.stringify` sozinho falharia em metade delas, porque não põe
 * espaço depois da vírgula nem dos dois-pontos e não ordena chave.
 */
describe("textoComoNoJsonb (o `#>> '{}'` do SQL, em TypeScript)", () => {
  it("escalar sai como o banco escreve", () => {
    expect(textoComoNoJsonb(100)).toBe("100");
    expect(textoComoNoJsonb(1.5)).toBe("1.5");
    expect(textoComoNoJsonb(-7)).toBe("-7");
    expect(textoComoNoJsonb(true)).toBe("true");
    expect(textoComoNoJsonb(false)).toBe("false");
  });

  it("texto no TOPO sai sem aspas, e ausência sai vazia", () => {
    expect(textoComoNoJsonb("PG")).toBe("PG");
    expect(textoComoNoJsonb("  PG ")).toBe("  PG "); // aparar é do `norm`, não daqui
    expect(textoComoNoJsonb(null)).toBe("");
    expect(textoComoNoJsonb(undefined)).toBe("");
  });

  it("array sai como TEXTO JSON, com espaço depois da vírgula", () => {
    expect(textoComoNoJsonb(["PG"])).toBe('["PG"]');
    expect(textoComoNoJsonb(["PG", "PC"])).toBe('["PG", "PC"]');
    expect(textoComoNoJsonb([])).toBe("[]");
    expect(textoComoNoJsonb([1, 2])).toBe("[1, 2]");
    expect(textoComoNoJsonb([1, [2]])).toBe("[1, [2]]");
  });

  /** Ordem de chave do jsonb: TAMANHO em bytes primeiro, depois byte a byte. */
  it("objeto sai com chave ordenada como o jsonb ordena", () => {
    expect(textoComoNoJsonb({ a: 1 })).toBe('{"a": 1}');
    expect(textoComoNoJsonb({ b: 1, a: 2 })).toBe('{"a": 2, "b": 1}');
    expect(textoComoNoJsonb({ bb: 1, a: 2 })).toBe('{"a": 2, "bb": 1}');
    // A que mostra que NÃO é alfabética: curta antes de longa, apesar de b > a.
    expect(textoComoNoJsonb({ b: 1, aa: 2 })).toBe('{"b": 1, "aa": 2}');
    expect(textoComoNoJsonb({ ccc: 3, a: 1, bb: 2 })).toBe('{"a": 1, "bb": 2, "ccc": 3}');
    expect(textoComoNoJsonb({ B: 1, a: 2 })).toBe('{"B": 1, "a": 2}'); // 0x42 < 0x61
    expect(textoComoNoJsonb({ "ç": 1, a: 2 })).toBe('{"a": 2, "ç": 1}'); // ç tem 2 bytes
    expect(textoComoNoJsonb({})).toBe("{}");
    expect(textoComoNoJsonb({ a: { b: [1, "x"] } })).toBe('{"a": {"b": [1, "x"]}}');
  });

  it("escapa aspas e barra como o banco", () => {
    expect(textoComoNoJsonb(['a"b'])).toBe('["a\\"b"]');
    expect(textoComoNoJsonb(["a\\b"])).toBe('["a\\\\b"]');
  });

  it("null DENTRO da estrutura é a palavra null; no topo é vazio", () => {
    expect(textoComoNoJsonb([null])).toBe("[null]");
    expect(textoComoNoJsonb({ a: null })).toBe('{"a": null}');
    expect(textoComoNoJsonb(null)).toBe("");
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

  /**
   * A conversão de `norm` é DEFESA EM PROFUNDIDADE, não licença para a
   * identidade virar saco de tipos. Quem monta identidade a partir do rastreio
   * continua entregando só texto, e é isto que este teste fixa: se um dia
   * `identidadeDoRastreio` passar a devolver número, é aqui que se vê.
   */
  it("produz SÓ texto, mesmo recebendo lixo de tipo", () => {
    const sujo = {
      p_base: "leadec",
      p_empresa: 700,
      p_matricula: true,
      p_filial: ["F1"],
      p_centro_custo: { a: 1 },
      p_vinculo: null,
      p_sindicato: "   ",
    } as never;
    const id = identidadeDoRastreio(sujo);
    for (const [chave, valor] of Object.entries(id)) {
      expect(typeof valor, `${chave} deveria ser texto`).toBe("string");
    }
    // Só o que era texto não vazio sobrevive — o resto nem entra.
    expect(Object.keys(id)).toEqual(["base"]);
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
