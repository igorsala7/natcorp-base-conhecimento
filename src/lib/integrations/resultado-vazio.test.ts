import { describe, expect, it } from "vitest";
import { pareceVazio, recadoDeVazio, vizinhasDeModulo, type ToolComModulos } from "./resultado-vazio";

/** Módulos reais, lidos de `ai_tool_modules` em 28/08/2026. */
const APURACAO: ToolComModulos = {
  key: "resultado_apuracao_ponto",
  name: "Apuração de Ponto",
  modules: [
    { modulo: "OPERACIONAL", submodulo: "FREQUÊNCIA" },
    { modulo: "PONTO E FREQUÊNCIA", submodulo: null },
  ],
};
const DETALHE: ToolComModulos = {
  key: "frequencia_resultado_apuracao_detalhe",
  name: "Frequência: Eventos de Apuração Detalhado",
  modules: [
    { modulo: "OPERACIONAL", submodulo: "FREQUÊNCIA" },
    { modulo: "PONTO E FREQUÊNCIA", submodulo: null },
  ],
};
const ESPELHO: ToolComModulos = {
  key: "relatorio_espelho_ponto",
  name: "Relatório: Espelho de Ponto",
  modules: [{ modulo: "PONTO E FREQUÊNCIA", submodulo: null }],
};
const FERIAS: ToolComModulos = {
  key: "consultar_ferias",
  name: "Consultar Férias",
  modules: [{ modulo: "FÉRIAS", submodulo: null }],
};

describe("pareceVazio", () => {
  it("O CASO 27/08: envelope com count 1 e eventos vazios é VAZIO", () => {
    // Resposta literal de `resultado_apuracao_ponto` às 15:45:29. Tem cara de
    // saudável — 200 OK, count 1, hasMore false — e não traz um único evento.
    const apuracao = {
      items: [{ data_ini: "01/08/2026", data_fim: "27/08/2026", eventos: [] }],
      hasMore: false,
      limit: 0,
      offset: 0,
      count: 1,
    };
    expect(pareceVazio(apuracao).vazio).toBe(true);
  });

  it("o retorno que TROUXE dado no mesmo turno não é vazio", () => {
    // `consultar_marcacoes`, 59.185 bytes, mesma pergunta, mesmo minuto.
    const marcacoes = { items: [{ matricula: 205818, nome: "Tony", data: "01/08/2026" }], count: 1 };
    expect(pareceVazio(marcacoes).vazio).toBe(false);
  });

  it("lista de topo vazia", () => {
    expect(pareceVazio({ items: [] }).vazio).toBe(true);
    expect(pareceVazio([]).vazio).toBe(true);
  });

  it("um envelope com conteúdo entre vários vazios NÃO é vazio", () => {
    // Chamar isto de vazio esconderia o mês que tem dado.
    const r = pareceVazio({
      items: [{ mes: "07", eventos: [] }, { mes: "08", eventos: [{ tipo: "falta" }] }],
    });
    expect(r.vazio).toBe(false);
  });

  it("objeto de campos escalares é dado, não envelope", () => {
    expect(pareceVazio({ items: [{ nome: "Tony", cargo: "Analista" }] }).vazio).toBe(false);
  });

  it("nulo e texto vazio", () => {
    expect(pareceVazio(null).vazio).toBe(true);
    expect(pareceVazio("").vazio).toBe(true);
    expect(pareceVazio("algum texto").vazio).toBe(false);
  });
});

describe("vizinhasDeModulo", () => {
  it("acha as duas alternativas do caso 27/08 sem mapa escrito à mão", () => {
    // O dono precisou descobrir sozinho, no turno seguinte, que existia o
    // espelho de ponto. O catálogo já sabia disso o tempo todo.
    const v = vizinhasDeModulo(APURACAO, [APURACAO, DETALHE, ESPELHO, FERIAS]);
    expect(v.map((t) => t.key)).toEqual(["frequencia_resultado_apuracao_detalhe", "relatorio_espelho_ponto"]);
  });

  it("submódulo compartilhado pesa mais que só o módulo", () => {
    // DETALHE casa OPERACIONAL/FREQUÊNCIA **e** PONTO E FREQUÊNCIA (3 pontos);
    // ESPELHO casa só o segundo (1 ponto). O recorte fino vem primeiro.
    const v = vizinhasDeModulo(APURACAO, [ESPELHO, DETALHE]);
    expect(v[0]!.key).toBe("frequencia_resultado_apuracao_detalhe");
  });

  it("não sugere ferramenta de outro assunto", () => {
    expect(vizinhasDeModulo(APURACAO, [FERIAS])).toEqual([]);
  });

  it("nunca sugere a si mesma", () => {
    expect(vizinhasDeModulo(APURACAO, [APURACAO])).toEqual([]);
  });

  it("só oferece o que está DISPONÍVEL no turno", () => {
    // Sugerir fora do conjunto faz o modelo tentar chamar, falhar e gastar mais
    // uma ida ao modelo — piorando o que se queria melhorar.
    const v = vizinhasDeModulo(APURACAO, [ESPELHO]);
    expect(v.map((t) => t.key)).toEqual(["relatorio_espelho_ponto"]);
  });

  it("ordem estável no empate, para o comportamento ser mensurável", () => {
    const a = vizinhasDeModulo(APURACAO, [ESPELHO, DETALHE, FERIAS]);
    const b = vizinhasDeModulo(APURACAO, [FERIAS, DETALHE, ESPELHO]);
    expect(a.map((t) => t.key)).toEqual(b.map((t) => t.key));
  });

  it("ferramenta sem módulo cadastrado não gera sugestão", () => {
    const orfa: ToolComModulos = { key: "x", name: "X", modules: [] };
    expect(vizinhasDeModulo(orfa, [APURACAO, ESPELHO])).toEqual([]);
  });

  it("módulo e submódulo não colidem por acidente de espaçamento", () => {
    // Os módulos deste ERP contêm espaço ("PONTO E FREQUÊNCIA"), então juntar as
    // duas metades com espaço faria {"PONTO E","FREQUÊNCIA"} casar com
    // {"PONTO","E FREQUÊNCIA"} — uma ferramenta virava vizinha de outra por
    // acidente. Estes dois pares NÃO são o mesmo assunto.
    const a: ToolComModulos = {
      key: "a", name: "A", modules: [{ modulo: "PONTO E", submodulo: "FREQUÊNCIA" }],
    };
    const b: ToolComModulos = {
      key: "b", name: "B", modules: [{ modulo: "PONTO", submodulo: "E FREQUÊNCIA" }],
    };
    expect(vizinhasDeModulo(a, [b])).toEqual([]);
  });

  it("submódulo nulo não colide com submódulo vazio", () => {
    const nulo: ToolComModulos = {
      key: "n", name: "N", modules: [{ modulo: "FOLHA", submodulo: null }],
    };
    const vazio: ToolComModulos = {
      key: "v", name: "V", modules: [{ modulo: "FOLHA", submodulo: "" }],
    };
    // Mesmo módulo → vizinhas (1 ponto), mas pelo módulo, não pelo par fino.
    const v = vizinhasDeModulo(nulo, [vazio]);
    expect(v.map((t) => t.key)).toEqual(["v"]);
  });
});

describe("recadoDeVazio", () => {
  it("manda declarar, e proíbe concluir que o dado não existe", () => {
    const r = recadoDeVazio("Apuração de Ponto");
    expect(r).toContain("Apuração de Ponto");
    expect(r).toMatch(/SEM REGISTROS/);
    expect(r).toMatch(/não conclua que o dado não existe/);
  });

  it("nomeia as vizinhas e manda PERGUNTAR antes de chamar", () => {
    const r = recadoDeVazio("Apuração de Ponto", [DETALHE, ESPELHO]);
    expect(r).toContain("Relatório: Espelho de Ponto");
    expect(r).toMatch(/pergunte antes de sair chamando/);
  });

  it("sem vizinha, declara o vazio e para por aí", () => {
    const r = recadoDeVazio("Apuração de Ponto", []);
    expect(r).not.toMatch(/ofereça consultar/);
  });
});
