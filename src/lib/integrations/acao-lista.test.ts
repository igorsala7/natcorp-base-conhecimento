import { describe, it, expect } from "vitest";
import { montarCartaoAcao, ehAcaoEmLista, type AcaoEmLista } from "./acao-lista";

const APROVAR: AcaoEmLista = {
  tool: "ferias_aprovar",
  lista: "itens",
  chave_item: "cod_solicitacao",
  titulo: "colaborador.nome",
  detalhe: "periodo.resumo",
  condicao: { campo: "minha_vez", igual: true },
  motivo: "motivo_bloqueio",
  param_variante: "status",
  variantes: [
    { valor: "A", rotulo: "Aprovar" },
    { valor: "R", rotulo: "Reprovar", estilo: "perigo" },
  ],
  campos: [{ nome: "justificativa", rotulo: "Justificativa", obrigatorio: true, multilinha: true }],
};

const item = (id: number, minhaVez = true, motivo?: string) => ({
  cod_solicitacao: id,
  colaborador: { nome: `Pessoa ${id}` },
  periodo: { resumo: "01/09 a 30/09" },
  minha_vez: minhaVez,
  motivo_bloqueio: motivo,
});

describe("ehAcaoEmLista — o que o catálogo aceita como declaração", () => {
  it("aceita a declaração completa", () => {
    expect(ehAcaoEmLista(APROVAR)).toBe(true);
  });

  it("recusa declaração sem ferramenta, sem chave ou sem variante", () => {
    // Um cadastro pela metade viraria botão que não faz nada — melhor não existir.
    expect(ehAcaoEmLista({ ...APROVAR, tool: "" })).toBe(false);
    expect(ehAcaoEmLista({ ...APROVAR, chave_item: "" })).toBe(false);
    expect(ehAcaoEmLista({ ...APROVAR, variantes: [] })).toBe(false);
    expect(ehAcaoEmLista(null)).toBe(false);
    expect(ehAcaoEmLista("aprovar")).toBe(false);
  });
});

describe("montarCartaoAcao", () => {
  it("lê a lista no caminho declarado e monta uma linha por item", () => {
    const c = montarCartaoAcao({ itens: [item(1), item(2)] }, APROVAR, 'ferias_aprovacoes')!;
    expect(c.itens.map((i) => i.id)).toEqual(["1", "2"]);
    expect(c.itens[0]!.titulo).toBe("Pessoa 1");
    expect(c.itens[0]!.detalhe).toBe("01/09 a 30/09");
  });

  it("um item disponível NÃO vira checkbox", () => {
    // Quem pergunta por UMA requisição já escolheu; pedir para marcá-la de novo
    // é um clique a mais para dizer o que já foi dito.
    const c = montarCartaoAcao({ itens: [item(1)] }, APROVAR, 'ferias_aprovacoes')!;
    expect(c.lote).toBe(false);
  });

  it("dois ou mais viram seleção múltipla", () => {
    expect(montarCartaoAcao({ itens: [item(1), item(2)] }, APROVAR, 'ferias_aprovacoes')!.lote).toBe(true);
  });

  it("item fora da vez aparece indisponível, com o motivo", () => {
    // Aparece — e não some — porque a pessoa precisa saber que a requisição
    // existe e por que ainda não pode agir nela.
    const c = montarCartaoAcao({ itens: [item(1), item(2, false, "Aguarda o gestor imediato.")] }, APROVAR, 'ferias_aprovacoes')!;
    expect(c.itens[1]!.disponivel).toBe(false);
    expect(c.itens[1]!.motivo).toBe("Aguarda o gestor imediato.");
  });

  it("nada disponível devolve null", () => {
    // Cartão só com linha apagada é ruído com aparência de botão.
    expect(montarCartaoAcao({ itens: [item(1, false), item(2, false)] }, APROVAR, 'ferias_aprovacoes')).toBeNull();
  });

  it("lista vazia devolve null", () => {
    expect(montarCartaoAcao({ itens: [] }, APROVAR, 'ferias_aprovacoes')).toBeNull();
    expect(montarCartaoAcao({}, APROVAR, 'ferias_aprovacoes')).toBeNull();
    expect(montarCartaoAcao(null, APROVAR, 'ferias_aprovacoes')).toBeNull();
  });

  it("item sem identificador é descartado", () => {
    // Sem id não há ação possível; oferecer o botão seria oferecer um erro.
    const c = montarCartaoAcao({ itens: [{ colaborador: { nome: "Sem id" } }, item(9)] }, APROVAR, 'ferias_aprovacoes')!;
    expect(c.itens.map((i) => i.id)).toEqual(["9"]);
  });

  it("carrega a ferramenta de ORIGEM — é ela que autoriza a ação no servidor", () => {
    expect(montarCartaoAcao({ itens: [item(1)] }, APROVAR, "ferias_aprovacoes")!.origem).toBe("ferias_aprovacoes");
  });

  it("aceita lista crua e envelope items do ORDS", () => {
    const semCaminho = { ...APROVAR, lista: undefined };
    expect(montarCartaoAcao([item(1)], semCaminho, 'ferias_aprovacoes')!.itens).toHaveLength(1);
    expect(montarCartaoAcao({ items: [item(1)] }, semCaminho, 'ferias_aprovacoes')!.itens).toHaveLength(1);
  });

  it("sem título declarado, a linha mostra o id", () => {
    const c = montarCartaoAcao({ itens: [item(7)] }, { ...APROVAR, titulo: undefined }, 'ferias_aprovacoes')!;
    expect(c.itens[0]!.titulo).toBe("#7");
  });

  it("param_item cai para chave_item quando não declarado", () => {
    expect(montarCartaoAcao({ itens: [item(1)] }, APROVAR, 'ferias_aprovacoes')!.param_item).toBe("cod_solicitacao");
    expect(
      montarCartaoAcao({ itens: [item(1)] }, { ...APROVAR, param_item: "p_cod_req" }, 'ferias_aprovacoes')!.param_item,
    ).toBe("p_cod_req");
  });
});
