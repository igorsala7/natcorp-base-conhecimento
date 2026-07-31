import { describe, it, expect } from "vitest";
import { newRegistry, registrarDataset, registrarTabelaTela, injetarDataset, expandirTabela, consultarDataset } from "./datasets";

const linhas = (n: number) => Array.from({ length: n }, (_, i) => ({ matricula: 100 + i, nome: "Fulano " + i, salario: 1000 + i }));

describe("registrarDataset", () => {
  it("detecta lista em `items` e infere colunas", () => {
    const reg = newRegistry();
    const meta = registrarDataset(reg, { items: linhas(300), hasMore: true });
    expect(meta).toEqual({ id: "ds1", total: 300, colunas: ["matricula", "nome", "salario"] });
    expect(reg.list[0]!.rows).toHaveLength(300);
  });

  it("detecta array direto e ids sequenciais", () => {
    const reg = newRegistry();
    registrarDataset(reg, { items: linhas(2) });
    const meta = registrarDataset(reg, linhas(5));
    expect(meta?.id).toBe("ds2");
    expect(meta?.total).toBe(5);
  });

  it("ignora chaves de metadado `_*` nas colunas", () => {
    const reg = newRegistry();
    const meta = registrarDataset(reg, { itens: [{ a: 1, _x: 2, b: 3 }] });
    expect(meta?.colunas).toEqual(["a", "b"]);
  });

  it("retorna null quando não há lista de registros", () => {
    const reg = newRegistry();
    expect(registrarDataset(reg, { erro: "falhou" })).toBeNull();
    expect(registrarDataset(reg, { total: 5 })).toBeNull();
    expect(registrarDataset(reg, "texto")).toBeNull();
  });
});

describe("injetarDataset", () => {
  it("adiciona _dataset/_total/_colunas mantendo os itens (objeto)", () => {
    const reg = newRegistry();
    const out = injetarDataset(reg, { items: linhas(3), hasMore: false }) as Record<string, unknown>;
    expect(out._dataset).toBe("ds1");
    expect(out._total).toBe(3);
    expect(Array.isArray(out.items)).toBe(true);
  });

  it("envelopa array em { itens } com o metadado", () => {
    const reg = newRegistry();
    const out = injetarDataset(reg, linhas(4)) as Record<string, unknown>;
    expect(out._dataset).toBe("ds1");
    expect((out.itens as unknown[]).length).toBe(4);
  });

  it("não mexe em resultado sem lista (ex.: {erro})", () => {
    const reg = newRegistry();
    const err = { erro: "x" };
    expect(injetarDataset(reg, err)).toBe(err);
  });

  it("sem registry, devolve intacto", () => {
    const x = { items: linhas(2) };
    expect(injetarDataset(undefined, x)).toBe(x);
  });
});

describe("expandirTabela", () => {
  it("expande TODAS as linhas com os campos e cabeçalhos pedidos", () => {
    const reg = newRegistry();
    registrarDataset(reg, { items: linhas(250) });
    const t = expandirTabela(reg, "ds1", ["nome", "salario"], ["Colaborador", "Salário"]);
    expect(t?.total).toBe(250);
    expect(t?.truncado).toBe(false);
    expect(t?.colunas).toEqual(["Colaborador", "Salário"]);
    expect(t?.linhas).toHaveLength(250);
    expect(t?.linhas[0]).toEqual(["Fulano 0", "1000"]);
  });

  it("sem campos, usa todas as colunas inferidas", () => {
    const reg = newRegistry();
    registrarDataset(reg, { items: linhas(3) });
    const t = expandirTabela(reg, "ds1");
    expect(t?.colunas).toEqual(["matricula", "nome", "salario"]);
    expect(t?.linhas[1]).toEqual(["101", "Fulano 1", "1001"]);
  });

  it("respeita o teto `max` e marca truncado", () => {
    const reg = newRegistry();
    registrarDataset(reg, { items: linhas(10) });
    const t = expandirTabela(reg, "ds1", ["nome"], ["Nome"], 4);
    expect(t?.linhas).toHaveLength(4);
    expect(t?.truncado).toBe(true);
  });

  it("dataset inexistente → null", () => {
    expect(expandirTabela(newRegistry(), "dsX")).toBeNull();
  });
});

describe("consultarDataset (filtro server-side sobre TODAS as linhas)", () => {
  // Simula uma tabela da tela coletada: 2000 registros, 70 com Situação "ABERTO".
  const colunas = ["Matrícula", "Nome", "Situação", "Valor"];
  const buildReg = () => {
    const reg = newRegistry();
    const linhasTela: string[][] = Array.from({ length: 2000 }, (_, i) => [
      String(1000 + i),
      "Cliente " + i,
      i < 70 ? "ABERTO" : "PAGO",
      "R$ " + (100 + i).toLocaleString("pt-BR"),
    ]);
    const { id } = registrarTabelaTela(reg, colunas, linhasTela);
    return { reg, id };
  };

  it("conta o total EXATO do recorte (70 de 2000), não a amostra", () => {
    const { reg, id } = buildReg();
    const r = consultarDataset(reg, id, [{ coluna: "Situação", operador: "igual", valor: "aberto" }]);
    expect(r?.total).toBe(70);
    expect(r?.amostra.length).toBeLessThanOrEqual(50);
    // registra o subconjunto como NOVO dataset para exportar exato
    const exp = expandirTabela(reg, r!.id);
    expect(exp?.total).toBe(70);
    expect(exp?.linhas).toHaveLength(70);
  });

  it("`contem` ignora acento/caixa; resolve coluna por nome parcial ou cN", () => {
    const { reg, id } = buildReg();
    const porNome = consultarDataset(reg, id, [{ coluna: "situacao", operador: "contem", valor: "abert" }]);
    expect(porNome?.total).toBe(70);
    const porIndice = consultarDataset(reg, id, [{ coluna: "c2", operador: "igual", valor: "ABERTO" }]);
    expect(porIndice?.total).toBe(70);
  });

  it("operadores numéricos em pt-BR (R$/milhar)", () => {
    const { reg, id } = buildReg();
    // Valor vai de R$ 100 a R$ 2099; > 2000 → poucos registros
    const r = consultarDataset(reg, id, [{ coluna: "Valor", operador: "maior_igual", valor: "2000" }]);
    expect(r?.total).toBe(100); // valores 2000..2099
  });

  it("combinação E (todas) vs OU (qualquer)", () => {
    const { reg, id } = buildReg();
    const e = consultarDataset(reg, id, [
      { coluna: "Situação", operador: "igual", valor: "ABERTO" },
      { coluna: "Valor", operador: "menor", valor: "150" },
    ], "E");
    expect(e?.total).toBe(50); // ABERTO (i<70) E valor<150 (i<50) → 50
    const ou = consultarDataset(reg, id, [
      { coluna: "Situação", operador: "igual", valor: "ABERTO" },
      { coluna: "Situação", operador: "igual", valor: "PAGO" },
    ], "OU");
    expect(ou?.total).toBe(2000);
  });

  it("sem filtros → todos os registros (para contar/exportar tudo)", () => {
    const { reg, id } = buildReg();
    const r = consultarDataset(reg, id, []);
    expect(r?.total).toBe(2000);
  });

  it("coluna inexistente → erro estruturado (não filtra errado)", () => {
    const { reg, id } = buildReg();
    const r = consultarDataset(reg, id, [{ coluna: "Inexistente", operador: "igual", valor: "x" }]);
    expect(r?.colunaNaoEncontrada).toBe("Inexistente");
    expect(r?.total).toBe(0);
  });

  it("dataset inexistente → null", () => {
    expect(consultarDataset(newRegistry(), "telaX", [])).toBeNull();
  });
});
