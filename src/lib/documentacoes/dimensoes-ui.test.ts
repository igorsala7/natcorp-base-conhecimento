import { describe, expect, it } from "vitest";
import { DIMENSOES } from "@/lib/elegibilidade";
import {
  DIMENSOES_DA_TELA,
  GRUPOS,
  TETO_DE_VALORES,
  dimensaoUI,
  dimensoesDoGrupo,
  extrairValoresDaTool,
  formularioParaRegra,
  regraParaFormulario,
} from "./dimensoes-ui";

describe("as doze dimensões chegam à tela", () => {
  it("tem uma linha por dimensão do motor, e nenhuma sobrando", () => {
    expect(DIMENSOES_DA_TELA.map((d) => d.dimensao).sort()).toEqual([...DIMENSOES].sort());
  });

  it("os três grupos particionam as doze — nenhuma dimensão fica fora de tela", () => {
    const soma = GRUPOS.flatMap((g) => dimensoesDoGrupo(g.chave).map((d) => d.dimensao));
    expect(soma.sort()).toEqual([...DIMENSOES].sort());
  });

  it("só `base` fica fora do diagnóstico de presença", () => {
    const sem = DIMENSOES_DA_TELA.filter((d) => !d.presenca).map((d) => d.dimensao);
    expect(sem).toEqual(["base"]);
  });

  it("`unidade_negocio` é a única dimensão de estrutura sem endpoint", () => {
    const comTool = DIMENSOES_DA_TELA.filter((d) => d.origem.tipo === "tool").map((d) => d.dimensao);
    expect(comTool).toEqual([
      "empresa",
      "filial",
      "centro_custo",
      "unidade_adm",
      "vinculo",
      "sindicato",
    ]);
    expect(dimensaoUI("unidade_negocio").origem.tipo).toBe("digitacao");
  });
});

describe("formulário ↔ regra", () => {
  it("abrir e salvar sem editar devolve a MESMA regra", () => {
    // É o caso mais comum da tela e o mais perigoso: se a ida e volta mexesse na
    // regra, quem abriu só para conferir o alcance mudaria quem vê o conteúdo.
    const regra = { portal: ["PG"], perfil: ["MASTER", "FOLHA"], centro_custo: ["9902"] };
    expect(formularioParaRegra(regraParaFormulario(regra))).toEqual(regra);
  });

  it("lista vazia gravada não liga o interruptor — ela LIBERA, e a tela precisa dizer isso", () => {
    const f = regraParaFormulario({ portal: [] });
    expect(f.restritas).toEqual([]);
    expect(formularioParaRegra(f)).toEqual({});
  });

  it("lista só de brancos também não liga: o motor já a trata como sem restrição", () => {
    expect(regraParaFormulario({ portal: ["  ", ""] }).restritas).toEqual([]);
  });

  it("interruptor ligado e sem valor NÃO grava lista vazia (que abriria para todos)", () => {
    expect(formularioParaRegra({ restritas: ["centro_custo"], valores: {} })).toEqual({});
    expect(formularioParaRegra({ restritas: ["centro_custo"], valores: { centro_custo: [" "] } })).toEqual({});
  });

  it("desligar o interruptor preserva os valores digitados, mas eles saem da regra", () => {
    const f = regraParaFormulario({ portal: ["PG"], perfil: ["MASTER"] });
    const semPerfil = { ...f, restritas: f.restritas.filter((d) => d !== "perfil") };
    expect(semPerfil.valores.perfil).toEqual(["MASTER"]);
    expect(formularioParaRegra(semPerfil)).toEqual({ portal: ["PG"] });
  });

  it("regra nula, malformada ou com chave fora das doze não vira formulário", () => {
    expect(regraParaFormulario(null).restritas).toEqual([]);
    expect(regraParaFormulario(undefined).restritas).toEqual([]);
    // O CHECK `regra_valida` impede a chave desconhecida de existir no banco;
    // se existisse, a tela não a mostraria e salvar a apagaria em silêncio.
    expect(regraParaFormulario({ centro_custos: ["1"] } as never).restritas).toEqual([]);
  });
});

describe("extrairValoresDaTool", () => {
  const cc = dimensaoUI("centro_custo").origem;
  const filial = dimensaoUI("filial").origem;

  it("pega o código do CENTRO DE CUSTO e não o da empresa que vem antes na linha", () => {
    // A linha real do ORDS traz `cod_empresa` ANTES de `cod_ccusto`. Uma heurística
    // de "primeiro campo que começa com cod" ofereceria empresa no campo de centro
    // de custo — sem erro nenhum, e a regra restringiria a coisa errada.
    const r = extrairValoresDaTool(cc, {
      items: [
        { cod_empresa: 99, nome_empresa: "ALIMAC", cod_ccusto: 9902, nome_centro_custo: "ADMINISTRATIVO I" },
      ],
    });
    expect(r.valores).toEqual([{ valor: "9902", rotulo: "ADMINISTRATIVO I", fonte: "cadastro" }]);
  });

  it("deduplica por VALOR: cod_filial 1 existe em toda empresa e é uma opção só", () => {
    const r = extrairValoresDaTool(filial, {
      items: [
        { cod_empresa: 99, cod_filial: 1, nome_filial: "MATRIZ" },
        { cod_empresa: 91, cod_filial: 1, nome_filial: "TESTE ANA F" },
        { cod_empresa: 91, cod_filial: 2, nome_filial: "SEGUNDA" },
      ],
    });
    expect(r.valores.map((v) => v.valor)).toEqual(["1", "2"]);
    expect(r.total).toBe(2);
  });

  it("corta no teto e devolve o TOTAL, para a tela não confundir com cadastro pequeno", () => {
    const items = Array.from({ length: TETO_DE_VALORES + 40 }, (_, i) => ({
      cod_ccusto: i + 1,
      nome_centro_custo: `CC ${i + 1}`,
    }));
    const r = extrairValoresDaTool(cc, { items });
    expect(r.valores).toHaveLength(TETO_DE_VALORES);
    expect(r.total).toBe(TETO_DE_VALORES + 40);
  });

  it("acusa formato desconhecido quando vieram linhas mas sem o campo esperado", () => {
    // Lista vazia e retorno mudado são coisas diferentes: silenciar o segundo
    // faria quem configura ler "este cliente não tem nenhum".
    const r = extrairValoresDaTool(cc, { items: [{ codigo: 1, descricao: "outro schema" }] });
    expect(r.valores).toEqual([]);
    expect(r.formatoDesconhecido).toBe(true);
  });

  it("lista vazia de verdade não é formato desconhecido", () => {
    const r = extrairValoresDaTool(cc, { items: [] });
    expect(r.total).toBe(0);
    expect(r.formatoDesconhecido).toBe(false);
  });

  it("aceita array cru e ignora resposta que não é lista", () => {
    expect(extrairValoresDaTool(cc, [{ cod_ccusto: 7 }]).valores.map((v) => v.valor)).toEqual(["7"]);
    expect(extrairValoresDaTool(cc, { erro: "403" }).valores).toEqual([]);
    expect(extrairValoresDaTool(cc, null).valores).toEqual([]);
  });

  it("descarta valor em branco e mantém a linha sem rótulo", () => {
    const r = extrairValoresDaTool(cc, {
      items: [{ cod_ccusto: "  " }, { cod_ccusto: "10", nome_centro_custo: "   " }],
    });
    expect(r.valores).toEqual([{ valor: "10", rotulo: undefined, fonte: "cadastro" }]);
  });

  it("dimensão sem endpoint devolve lista vazia em vez de inventar", () => {
    expect(extrairValoresDaTool(dimensaoUI("portal").origem, { items: [{ x: 1 }] })).toEqual({
      valores: [],
      total: 0,
      formatoDesconhecido: false,
    });
  });
});
