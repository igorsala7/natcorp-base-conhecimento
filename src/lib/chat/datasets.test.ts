import { describe, it, expect } from "vitest";
import { avisoDeColuna, newRegistry, registrarDataset, registrarTabelaTela, injetarDataset, injetarDatasetComRelato, explicarColuna, listarDatasets, resolverColunaInfo, textoDatasetsDisponiveis, expandirTabela, consultarDataset, agregarDataset, estatisticasColuna, agruparDataset, derivarColuna, classificarColuna, projetarSerie } from "./datasets";

/** Célula guardada (valor com precisão total) do dataset `id`, linha × índice de coluna. */
const celG = (reg: ReturnType<typeof newRegistry>, id: string, linha: number, colIdx: number) =>
  String(reg.list.find((d) => d.id === id)!.rows[linha]!["c" + colIdx] ?? "");
const numG = (reg: ReturnType<typeof newRegistry>, id: string, linha: number, colIdx: number) =>
  parseFloat(celG(reg, id, linha, colIdx).replace(",", "."));

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

  it("AMOSTRA a lista grande p/ o modelo (evita estouro), mas registra 100% no dataset", () => {
    const reg = newRegistry();
    const out = injetarDataset(reg, { items: linhas(500), hasMore: false }) as Record<string, unknown>;
    // O modelo vê só a amostra…
    expect((out.items as unknown[]).length).toBe(50);
    expect(out._amostra).toBe(50);
    // …mas o metadado diz o TOTAL real e há nota orientando usar dados_de.
    expect(out._total).toBe(500);
    expect(String(out._nota)).toContain("ds1");
    // O dataset guarda TODAS as linhas (para as ferramentas de dados).
    expect(reg.list[0]!.rows).toHaveLength(500);
  });

  it("AMOSTRA também quando o resultado é array direto", () => {
    const reg = newRegistry();
    const out = injetarDataset(reg, linhas(200)) as Record<string, unknown>;
    expect((out.itens as unknown[]).length).toBe(50);
    expect(out._total).toBe(200);
    expect(reg.list[0]!.rows).toHaveLength(200);
  });

  it("não trunca no limite (50 linhas passam inteiras, sem nota)", () => {
    const reg = newRegistry();
    const out = injetarDataset(reg, linhas(50)) as Record<string, unknown>;
    expect((out.itens as unknown[]).length).toBe(50);
    expect(out._amostra).toBeUndefined();
    expect(out._nota).toBeUndefined();
  });

  it("capa listas ANINHADAS grandes (loop {itens:[{valor,dados}]}), não só a de topo", () => {
    const reg = newRegistry();
    // Réplica do loop por colaborador: lista de topo pequena (3), mas cada `dados`
    // traz 500 linhas → sem podar o aninhado, estouraria o contexto.
    const porColab = (m: number) => ({ valor: String(m), dados: { items: linhas(500) } });
    const out = injetarDataset(reg, { itens: [porColab(1), porColab(2), porColab(3)] }) as Record<string, unknown>;
    const itens = out.itens as Array<{ dados: { items: Record<string, unknown> } }>;
    const it0 = itens[0]!.dados.items;
    expect(it0._total).toBe(500);                     // sabe o total real de cada colaborador
    expect((it0.itens as unknown[]).length).toBe(50); // mas só vê 50
    expect(String(it0._dataset)).toMatch(/^ds\d+$/);  // e pode consultar 100% via dados_de
    expect(JSON.stringify(out).length).toBeLessThan(60_000); // não estoura o contexto
  });

  it("rede de segurança: nada explode mesmo sem lista reconhecível gigante", () => {
    const reg = newRegistry();
    // Objeto enorme sem uma lista de topo reconhecível: cada chave tem uma lista grande.
    const gigante: Record<string, unknown> = {};
    for (let i = 0; i < 30; i++) gigante["bloco_" + i] = { registros: linhas(300) };
    const out = injetarDataset(reg, gigante);
    expect(JSON.stringify(out).length).toBeLessThan(500_000);
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

describe("agregarDataset", () => {
  const reg = () => {
    const r = newRegistry();
    registrarTabelaTela(r, ["Nome", "Status", "Valor"], [
      ["Ana", "pago", "R$ 1.234,56"],
      ["Bia", "aberto", "2.000,00"],
      ["Cid", "pago", "R$ 765,44"],
      ["Dan", "aberto", "—"], // não-numérico → ignorado no cálculo
    ]);
    return r;
  };

  it("soma valores em R$/pt-BR sobre 100% e ignora não-numéricos", () => {
    const r = agregarDataset(reg(), "tela1", "Valor", "soma");
    expect(r?.valor).toBeCloseTo(4000, 2);
    expect(r?.valoresNumericos).toBe(3);
    expect(r?.ignorados).toBe(1);
  });

  it("média divide pela contagem de valores numéricos", () => {
    expect(agregarDataset(reg(), "tela1", "Valor", "media")?.valor).toBeCloseTo(4000 / 3, 2);
  });

  it("máx e mín", () => {
    expect(agregarDataset(reg(), "tela1", "Valor", "max")?.valor).toBeCloseTo(2000, 2);
    expect(agregarDataset(reg(), "tela1", "Valor", "min")?.valor).toBeCloseTo(765.44, 2);
  });

  it("contar conta LINHAS; distintos conta únicos", () => {
    expect(agregarDataset(reg(), "tela1", "Valor", "contar")?.valor).toBe(4);
    expect(agregarDataset(reg(), "tela1", "Status", "distintos")?.valor).toBe(2);
  });

  it("aplica o filtro ANTES de somar", () => {
    const r = agregarDataset(reg(), "tela1", "Valor", "soma", [{ coluna: "Status", operador: "igual", valor: "pago" }]);
    expect(r?.valor).toBeCloseTo(2000, 2); // 1234,56 + 765,44
    expect(r?.linhasConsideradas).toBe(2);
  });

  it("sinaliza coluna inexistente e dataset inexistente", () => {
    expect(agregarDataset(reg(), "tela1", "Inexistente", "soma")?.colunaNaoEncontrada).toBe("Inexistente");
    expect(agregarDataset(reg(), "telaX", "Valor", "soma")).toBeNull();
  });
});

describe("estatísticas e agrupamento", () => {
  const reg = () => {
    const r = newRegistry();
    registrarTabelaTela(r, ["Depto", "Valor"], [
      ["A", "10"], ["A", "20"], ["A", "30"],
      ["B", "100"], ["B", "300"],
      ["C", "R$ 1.000,00"], ["C", "—"],
    ]);
    return r;
  };

  it("mediana, amplitude e desvio-padrão (amostral)", () => {
    const g = reg();
    expect(agregarDataset(g, "tela1", "Valor", "mediana")?.valor).toBeCloseTo(65, 6); // mediana de {10,20,30,100,300,1000} = (30+100)/2
    expect(agregarDataset(g, "tela1", "Valor", "amplitude")?.valor).toBeCloseTo(990, 6); // 1000-10
    // [2,4,4,4,5,5,7,9]: média 5, soma dos quadrados 32 → desvio AMOSTRAL √(32/7) ≈ 2.138 (= STDDEV do Oracle)
    const r2 = newRegistry();
    registrarTabelaTela(r2, ["X"], [["2"], ["4"], ["4"], ["4"], ["5"], ["5"], ["7"], ["9"]]);
    expect(agregarDataset(r2, "tela1", "X", "desvio_padrao")?.valor).toBeCloseTo(Math.sqrt(32 / 7), 6);
    expect(agregarDataset(r2, "tela1", "X", "variancia")?.valor).toBeCloseTo(32 / 7, 6);
    expect(agregarDataset(r2, "tela1", "X", "moda")?.valor).toBe(4);
  });

  it("perfil estatístico completo cobre 100% e ignora não-numéricos", () => {
    const e = estatisticasColuna(reg(), "tela1", "Valor");
    expect(e?.linhas).toBe(7);
    expect(e?.validos).toBe(6); // "—" fora
    expect(e?.ignorados).toBe(1);
    expect(e?.soma).toBeCloseTo(1460, 6);
    expect(e?.min).toBeCloseTo(10, 6);
    expect(e?.max).toBeCloseTo(1000, 6);
    expect(e?.mediana).toBeCloseTo(65, 6);
  });

  it("agrupar: soma por categoria, ordenado maior→menor", () => {
    const r = agruparDataset(reg(), "tela1", "Depto", "Valor", "soma");
    expect(r && "grupos" in r ? r.totalGrupos : -1).toBe(3);
    const grupos = r && "grupos" in r ? r.grupos : [];
    expect(grupos[0]).toMatchObject({ grupo: "C", valor: 1000 }); // C=1000, B=400, A=60
    expect(grupos.map((x) => x.grupo)).toEqual(["C", "B", "A"]);
  });

  it("agrupar contar: nº de linhas por categoria (sem coluna_valor)", () => {
    const r = agruparDataset(reg(), "tela1", "Depto", "Depto", "contar");
    const grupos = r && "grupos" in r ? r.grupos : [];
    expect(grupos.find((x) => x.grupo === "A")?.valor).toBe(3);
    expect(grupos.find((x) => x.grupo === "C")?.valor).toBe(2);
  });
});

describe("derivarColuna (coluna calculada por linha, 100%)", () => {
  // Célula do dataset guardado (o valor com PRECISÃO TOTAL), por índice de coluna.
  const celulaGuardada = (reg: ReturnType<typeof newRegistry>, id: string, linha: number, colIdx: number) => {
    const ds = reg.list.find((d) => d.id === id)!;
    return String(ds.rows[linha]!["c" + colIdx] ?? "");
  };

  it("subtração mês a mês em pt-BR (R$/milhar), positivo e negativo", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "Mês 1", "Mês 2"], [
      ["A", "R$ 1.000,00", "R$ 1.250,00"],
      ["B", "2.000,00", "1.500,00"],
    ]);
    const r = derivarColuna(reg, "tela1", "Mês 2", "subtracao", "Mês 1")!;
    expect(r.calculadas).toBe(2);
    expect(r.vazias_como_zero).toBe(0);
    expect(r.base_zero_na).toBe(0);
    // coluna derivada é a última (índice 3); valores exatos.
    expect(parseFloat(celulaGuardada(reg, r.id, 0, 3).replace(",", "."))).toBeCloseTo(250, 10);
    expect(parseFloat(celulaGuardada(reg, r.id, 1, 3).replace(",", "."))).toBeCloseTo(-500, 10);
    // amostra exibe 2 casas em pt-BR.
    expect(r.amostra[0]![3]).toBe("250,00");
    expect(r.amostra[1]![3]).toBe("-500,00");
  });

  it("variação % correta e BASE ZERO vira N/A explícito (não '100%')", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "Ant", "Atual"], [
      ["X", "100", "150"],   // (150-100)/100*100 = 50
      ["Y", "0", "80"],      // base zero → N/A
    ]);
    const r = derivarColuna(reg, "tela1", "Atual", "variacao_percentual", "Ant")!;
    expect(r.calculadas).toBe(1);
    expect(r.base_zero_na).toBe(1);
    expect(parseFloat(celulaGuardada(reg, r.id, 0, 3).replace(",", "."))).toBeCloseTo(50, 10);
    expect(celulaGuardada(reg, r.id, 1, 3)).toBe(""); // N/A não é número
    expect(r.amostra[1]![3]).toBe("N/A");
  });

  it("célula vazia/não-numérica no operando → tratada como 0 e REPORTADA", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "M1", "M2"], [
      ["X", "", "300"],       // vazia → 0 → 300-0=300
      ["Y", "abc", "300"],    // não-numérica → 0 → 300
      ["Z", "100", "300"],    // 200
    ]);
    const r = derivarColuna(reg, "tela1", "M2", "subtracao", "M1")!;
    expect(r.calculadas).toBe(3);
    expect(r.vazias_como_zero).toBe(2);
    expect(parseFloat(celulaGuardada(reg, r.id, 0, 3).replace(",", "."))).toBeCloseTo(300, 10);
    expect(parseFloat(celulaGuardada(reg, r.id, 2, 3).replace(",", "."))).toBeCloseTo(200, 10);
  });

  it("PRECISÃO TOTAL guardada em pt-BR canônico: 1234÷1000 = 1,234 (não 1234)", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["A", "B"], [["1234", "1000"]]);
    const r = derivarColuna(reg, "tela1", "A", "divisao", "B")!;
    // Guardado com vírgula → parseNumBR lê 1,234 (não interpreta como milhar 1.234=1234).
    expect(celulaGuardada(reg, r.id, 0, 2)).toBe("1,234");
    const soma = agregarDataset(reg, r.id, r.coluna, "soma")!;
    expect(soma.valor).toBeCloseTo(1.234, 10);
    expect(soma.valor).not.toBe(1234);
  });

  it("agregação sobre a coluna derivada é EXATA sobre 100% (não pela amostra)", () => {
    const reg = newRegistry();
    const linhas = Array.from({ length: 500 }, (_, i) => ["Item " + i, String(1000 + i), String(1100 + i)]);
    registrarTabelaTela(reg, ["Item", "M1", "M2"], linhas);
    const r = derivarColuna(reg, "tela1", "M2", "subtracao", "M1")!; // cada diff = 100
    expect(r.calculadas).toBe(500);
    const soma = agregarDataset(reg, r.id, r.coluna, "soma")!;
    expect(soma.valor).toBeCloseTo(100 * 500, 6); // 50.000 exato
    const media = agregarDataset(reg, r.id, r.coluna, "media")!;
    expect(media.valor).toBeCloseTo(100, 10);
  });

  it("coluna_b como CONSTANTE numérica (ex.: × 1,1)", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["A"], [["200"]]);
    const r = derivarColuna(reg, "tela1", "A", "multiplicacao", "1,1")!;
    expect(r.calculadas).toBe(1);
    expect(r.vazias_como_zero).toBe(0); // constante não conta como vazia
    expect(parseFloat(celulaGuardada(reg, r.id, 0, 1).replace(",", "."))).toBeCloseTo(220, 10);
    expect(r.amostra[0]![1]).toBe("220,00");
  });

  it("percentual_do_total sobre 100%; total zero → tudo N/A", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "Valor"], [["A", "30"], ["B", "70"]]);
    const r = derivarColuna(reg, "tela1", "Valor", "percentual_do_total")!;
    expect(parseFloat(celulaGuardada(reg, r.id, 0, 2).replace(",", "."))).toBeCloseTo(30, 10);
    expect(parseFloat(celulaGuardada(reg, r.id, 1, 2).replace(",", "."))).toBeCloseTo(70, 10);

    const reg0 = newRegistry();
    registrarTabelaTela(reg0, ["Item", "Valor"], [["A", "0"], ["B", "0"]]);
    const z = derivarColuna(reg0, "tela1", "Valor", "percentual_do_total")!;
    expect(z.calculadas).toBe(0);
    expect(z.base_zero_na).toBe(2);
  });

  it("coluna inexistente (a ou b não-numérica) → colunaNaoEncontrada", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Val1", "Val2"], [["1", "2"]]);
    expect(derivarColuna(reg, "tela1", "Zzz", "subtracao", "Val2")!.colunaNaoEncontrada).toBe("Zzz");
    // coluna_b que não é coluna nem número → erro (não vira constante silenciosa).
    expect(derivarColuna(reg, "tela1", "Val1", "subtracao", "Www")!.colunaNaoEncontrada).toBe("Www");
  });

  it("dataset inexistente → null", () => {
    expect(derivarColuna(newRegistry(), "ds999", "A", "subtracao", "B")).toBeNull();
  });
});

describe("classificarColuna (faixas de risco por linha, 100%)", () => {
  const setup = () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "Variação"], [
      ["A", "-35"],   // queda forte
      ["B", "-10"],   // queda leve
      ["C", "5"],     // alta
      ["D", "-25"],   // queda forte
      ["E", ""],      // sem valor
    ]);
    const faixas = [
      { rotulo: "queda forte", max: -20 },
      { rotulo: "queda leve", min: -20, max: 0 },
      { rotulo: "alta", min: 0 },
    ];
    return { reg, faixas };
  };

  it("rotula cada registro na faixa certa [min,max) e conta a distribuição", () => {
    const { reg, faixas } = setup();
    const r = classificarColuna(reg, "tela1", "Variação", faixas)!;
    expect(r.total).toBe(5);
    expect(celG(reg, r.id, 0, 2)).toBe("queda forte");  // -35
    expect(celG(reg, r.id, 1, 2)).toBe("queda leve");   // -10
    expect(celG(reg, r.id, 2, 2)).toBe("alta");         // 5
    expect(celG(reg, r.id, 3, 2)).toBe("queda forte");  // -25
    const dist = Object.fromEntries(r.distribuicao.map((d) => [d.rotulo, d.linhas]));
    expect(dist["queda forte"]).toBe(2);
    expect(dist["queda leve"]).toBe(1);
    expect(dist["alta"]).toBe(1);
  });

  it("célula vazia/não-numérica → '(sem valor)' à parte (não some numa faixa)", () => {
    const { reg, faixas } = setup();
    const r = classificarColuna(reg, "tela1", "Variação", faixas)!;
    expect(celG(reg, r.id, 4, 2)).toBe("(sem valor)");
    expect(r.sem_valor).toBe(1);
    expect(r.distribuicao.find((d) => d.rotulo === "(sem valor)")?.linhas).toBe(1);
  });

  it("limite [min,max): max é EXCLUSIVO (0 cai em 'alta', não em 'queda leve')", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "V"], [["Z", "0"]]);
    const r = classificarColuna(reg, "tela1", "V", [
      { rotulo: "neg", max: 0 },
      { rotulo: "zero+", min: 0 },
    ])!;
    expect(celG(reg, r.id, 0, 2)).toBe("zero+");
  });

  it("valor fora de todas as faixas → '(fora das faixas)'", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "V"], [["Z", "500"]]);
    const r = classificarColuna(reg, "tela1", "V", [{ rotulo: "baixo", min: 0, max: 100 }])!;
    expect(celG(reg, r.id, 0, 2)).toBe("(fora das faixas)");
  });

  it("o rótulo vira coluna consultável (consultar_registros filtra a faixa)", () => {
    const { reg, faixas } = setup();
    const r = classificarColuna(reg, "tela1", "Variação", faixas)!;
    const q = consultarDataset(reg, r.id, [{ coluna: r.coluna, operador: "igual", valor: "queda forte" }])!;
    expect(q.total).toBe(2); // exato sobre 100%, não pela amostra
  });

  it("coluna inexistente → colunaNaoEncontrada; dataset inexistente → null", () => {
    const { reg, faixas } = setup();
    expect(classificarColuna(reg, "tela1", "NaoTem", faixas)!.colunaNaoEncontrada).toBe("NaoTem");
    expect(classificarColuna(newRegistry(), "ds9", "V", faixas)).toBeNull();
  });
});

describe("projetarSerie (projeção por registro)", () => {
  it("2 meses → método 'ambos' (composta + linear lado a lado), valores corretos", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "M1", "M2"], [["A", "100", "110"]]);
    const r = projetarSerie(reg, "tela1", ["M1", "M2"], 6)!;
    expect(r.metodo).toBe("ambos");
    expect(r.colunas_projetadas).toHaveLength(12); // 6 composta + 6 linear
    expect(r.projetadas).toBe(1);
    // composta: taxa +10% → +1=121, +6=110*1,1^6≈194,8717
    expect(numG(reg, r.id, 0, 3)).toBeCloseTo(121, 6);
    expect(numG(reg, r.id, 0, 8)).toBeCloseTo(194.87171, 4);
    // linear: passo +10 → +1=120, +6=170
    expect(numG(reg, r.id, 0, 9)).toBeCloseTo(120, 6);
    expect(numG(reg, r.id, 0, 14)).toBeCloseTo(170, 6);
  });

  it("3+ meses → 'regressao' automática, R²=1 em série perfeitamente linear", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "M1", "M2", "M3"], [["A", "10", "20", "30"]]);
    const r = projetarSerie(reg, "tela1", ["M1", "M2", "M3"], 3)!;
    expect(r.metodo).toBe("regressao");
    expect(r.colunas_projetadas).toHaveLength(4); // 3 proj + R²
    expect(numG(reg, r.id, 0, 4)).toBeCloseTo(40, 6); // +1
    expect(numG(reg, r.id, 0, 6)).toBeCloseTo(60, 6); // +3
    expect(numG(reg, r.id, 0, 7)).toBeCloseTo(1, 9);  // R²
  });

  it("R² < 1 quando o ajuste não é perfeito", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "M1", "M2", "M3"], [["A", "10", "20", "25"]]);
    const r = projetarSerie(reg, "tela1", ["M1", "M2", "M3"], 2)!;
    const r2 = numG(reg, r.id, 0, r.colunas.length - 1); // última coluna = R²
    expect(r2).toBeGreaterThan(0.9);
    expect(r2).toBeLessThan(1);
  });

  it("série INCOMPLETA (mês faltando) → NÃO projeta (N/A) e reporta", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "M1", "M2"], [["A", "100", ""]]);
    const r = projetarSerie(reg, "tela1", ["M1", "M2"], 6)!;
    expect(r.serie_incompleta).toBe(1);
    expect(r.projetadas).toBe(0);
    expect(celG(reg, r.id, 0, 3)).toBe(""); // nada inventado
  });

  it("composta com base ≤ 0 → N/A (não explode), mas a LINEAR ainda projeta", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "M1", "M2"], [["A", "0", "50"]]);
    const r = projetarSerie(reg, "tela1", ["M1", "M2"], 6)!;
    expect(r.base_invalida_composta).toBe(1);
    expect(celG(reg, r.id, 0, 3)).toBe("");          // composta +1 = N/A
    expect(numG(reg, r.id, 0, 9)).toBeCloseTo(100, 6); // linear +1 = 50+50
    expect(r.projetadas).toBe(1);                    // linear valeu
  });

  it("método explícito 'linear' cria só colunas lineares", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "M1", "M2"], [["A", "100", "110"]]);
    const r = projetarSerie(reg, "tela1", ["M1", "M2"], 6, "linear")!;
    expect(r.metodo).toBe("linear");
    expect(r.colunas_projetadas).toHaveLength(6);
  });

  it("horizonte respeitado e limitado; premissa avisa de só-2-pontos", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "M1", "M2"], [["A", "100", "110"]]);
    const r = projetarSerie(reg, "tela1", ["M1", "M2"], 3, "linear")!;
    expect(r.horizonte).toBe(3);
    expect(r.colunas_projetadas).toHaveLength(3);
    expect(r.premissas.some((p) => p.includes("2 meses"))).toBe(true);
  });

  it("menos de 2 colunas → erro; coluna inexistente → colunaNaoEncontrada; dataset → null", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Item", "M1"], [["A", "100"]]);
    expect(projetarSerie(reg, "tela1", ["M1"], 6)!.erro).toBeTruthy();
    expect(projetarSerie(reg, "tela1", ["M1", "NaoTem"], 6)!.colunaNaoEncontrada).toBe("NaoTem");
    expect(projetarSerie(newRegistry(), "ds9", ["M1", "M2"], 6)).toBeNull();
  });
});

// Regressão A1: query-tools sobre um dataset de RESULTADO DE API (ds*). Antes, as linhas
// eram chaveadas só pelo nome real e as agregações leem por r["c"+i] → tudo lia vazio
// (soma=0, filtro não casava). O registrarDataset agora re-chaveia por cN.
describe("registrarDataset — query-tools sobre ds* (A1)", () => {
  it("agregar SOMA lê as células (não zero) sobre um ds*", () => {
    const reg = newRegistry();
    const meta = registrarDataset(reg, { items: linhas(5) }); // salario 1000..1004
    expect(meta).not.toBeNull();
    const r = agregarDataset(reg, meta!.id, "salario", "soma");
    expect(r).not.toBeNull();
    expect(r!.valor).toBe(5010); // 1000+1001+1002+1003+1004
    expect(r!.valoresNumericos).toBe(5); // todas as células entraram
    expect(r!.linhasConsideradas).toBe(5);
  });

  it("contar via agregar reflete 100% das linhas do ds*", () => {
    const reg = newRegistry();
    const meta = registrarDataset(reg, { items: linhas(5) });
    expect(agregarDataset(reg, meta!.id, "matricula", "contar")!.valor).toBe(5);
  });

  it("consultar_registros filtra o ds* sobre 100% (não amostra vazia)", () => {
    const reg = newRegistry();
    const meta = registrarDataset(reg, { items: linhas(5) });
    const c = consultarDataset(reg, meta!.id, [{ coluna: "salario", operador: "maior_igual", valor: "1002" }], "E");
    expect(c).not.toBeNull();
    expect(c!.total).toBe(3); // 1002, 1003, 1004
  });
});

// A7: não somar/mediar um IDENTIFICADOR (matrícula/CPF/código) — total sem sentido.
describe("agregarDataset — guarda de identificador (A7)", () => {
  it("SOMA sobre 'matricula' é bloqueada (aviso, valor 0), mas contar/distintos seguem", () => {
    const reg = newRegistry();
    const meta = registrarDataset(reg, { items: linhas(5) }); // matricula 100..104
    const soma = agregarDataset(reg, meta!.id, "matricula", "soma");
    expect(soma!.colunaIdentificador).toBeTruthy();
    expect(soma!.valor).toBe(0);
    expect(agregarDataset(reg, meta!.id, "matricula", "contar")!.colunaIdentificador).toBeUndefined();
    expect(agregarDataset(reg, meta!.id, "matricula", "distintos")!.valor).toBe(5);
  });

  it("SOMA sobre coluna de valor ('salario') NÃO é bloqueada", () => {
    const reg = newRegistry();
    const meta = registrarDataset(reg, { items: linhas(5) });
    const r = agregarDataset(reg, meta!.id, "salario", "soma");
    expect(r!.colunaIdentificador).toBeUndefined();
    expect(r!.valor).toBe(5010);
  });
});

// A3: resultado de ferramenta VAZIO marca _sem_dados p/ o modelo não inventar.
describe("injetarDataset — resultado vazio (A3)", () => {
  it("lista vazia → _sem_dados + aviso", () => {
    const reg = newRegistry();
    const out = injetarDataset(reg, { items: [] }) as Record<string, unknown>;
    expect(out._sem_dados).toBe(true);
    expect(String(out._aviso)).toMatch(/n[ãa]o encontrou/i);
  });
  it("array vazio no topo → _sem_dados", () => {
    const reg = newRegistry();
    const out = injetarDataset(reg, [] as unknown) as Record<string, unknown>;
    expect(out._sem_dados).toBe(true);
  });
  it("resultado COM dados não marca _sem_dados", () => {
    const reg = newRegistry();
    const out = injetarDataset(reg, { items: linhas(3) }) as Record<string, unknown>;
    expect(out._sem_dados).toBeUndefined();
  });
});

/**
 * O relato existe porque NENHUM passo do trace registrava o que o modelo recebeu de
 * fato: dava para ver a chamada da ferramenta, mas não se ele viu 50 de 4.000 linhas
 * nem se a poda de emergência disparou. Sem esse número não dá para dizer qual das
 * perdas de contexto é a real.
 */
describe("injetarDatasetComRelato", () => {
  const linhasN = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, nome: "n" + i }));

  it("lista pequena: completo, sem amostra", () => {
    const { relato } = injetarDatasetComRelato(newRegistry(), { items: linhasN(3) });
    expect(relato).toMatchObject({ total: 3, amostra_enviada: 3, completo: true, poda_agressiva: false });
    expect(relato!.dataset).toBeTruthy();
  });

  it("lista grande: o modelo vê 50, o registro guarda tudo", () => {
    const reg = newRegistry();
    const { relato } = injetarDatasetComRelato(reg, { items: linhasN(4000) });
    expect(relato).toMatchObject({ total: 4000, amostra_enviada: 50, completo: false });
    expect(listarDatasets(reg)[0]!.total).toBe(4000);
  });

  it("zero registros é sinalizado (o modelo não pode inventar)", () => {
    const { saida, relato } = injetarDatasetComRelato(newRegistry(), { items: [] });
    expect(relato!.sem_dados).toBe(true);
    expect((saida as Record<string, unknown>)._sem_dados).toBe(true);
  });

  it("poda de emergência AVISA o modelo em vez de cortar em silêncio", () => {
    // Estoura os 400 KB da rede SEM cair na poda de string (que corta em 20 mil):
    // 40 campos de 19 mil caracteres ≈ 760 KB.
    const gordo = Object.fromEntries(Array.from({ length: 40 }, (_, i) => ["campo" + i, "x".repeat(19_000)]));
    const { saida, relato } = injetarDatasetComRelato(newRegistry(), gordo);
    expect(relato!.poda_agressiva).toBe(true);
    const o = saida as Record<string, unknown>;
    expect(o._poda_emergencia).toBe(true);
    expect(String(o._aviso_poda)).toContain("CORTADO");
  });

  it("injetarDataset continua com o mesmo contrato de antes", () => {
    const out = injetarDataset(newRegistry(), { items: linhasN(3) }) as Record<string, unknown>;
    expect(out._completo).toBe(true);
  });
});

/**
 * "Salário" casando com Salário Base, Líquido e Família: o código escolhia a
 * PRIMEIRA em silêncio e devolvia um número errado que ninguém percebia.
 */
describe("resolverColunaInfo / explicarColuna", () => {
  function regAmbiguo() {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Nome", "Salário Base", "Salário Líquido", "Salário Família"], [["Ana", "1", "2", "3"]]);
    return reg;
  }

  it("nome exato resolve direto", () => {
    const reg = regAmbiguo();
    expect(resolverColunaInfo(reg.list[0]!, "Salário Base")).toMatchObject({ via: "exata", idx: 1 });
  });

  it("candidato único casa por aproximação", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Nome", "Centro de Custo"], [["Ana", "TI"]]);
    // "Centro de Custo" começa com "centro " → camada de PREFIXO, a mais precisa.
    expect(resolverColunaInfo(reg.list[0]!, "centro")).toMatchObject({ via: "prefixo", idx: 1 });
  });

  /**
   * Em relatório de RH a ambiguidade é a NORMA ("Salário" casa Base/Líquido/Família).
   * Devolver erro trava o turno — cada erro consome um passo do orçamento e o turno
   * morre sem os dados. Escolhe a mais curta (o nome curto é o canônico) e OBRIGA a
   * resposta a declarar qual usou.
   */
  it("2+ candidatos: escolhe a canônica e marca para avisar", () => {
    const reg = regAmbiguo();
    const info = resolverColunaInfo(reg.list[0]!, "Salário", { tipo: "numerico" });
    expect(info.idx).not.toBeNull();
    expect(info.via).toBe("escolhida");
    expect(avisoDeColuna(info)).toContain("Salário Base");
    expect(avisoDeColuna(info)).toContain("Salário Líquido");
  });

  it("prefixo vence o substring: 'Salário' não casa 'Meu Salário'", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Meu Salário", "Salário Base"], [["1", "2"]]);
    expect(resolverColunaInfo(reg.list[0]!, "Salário")).toMatchObject({ via: "prefixo", idx: 1 });
  });

  it("token inteiro mata o falso-positivo do substring ('id' × 'Cidade')", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Cidade", "Nome"], [["SP", "Ana"]]);
    const info = resolverColunaInfo(reg.list[0]!, "id");
    // "id" não é palavra inteira de "Cidade" — cai no substring como última rede,
    // com candidato único, em vez de casar por engano numa camada precisa.
    expect(info.via).not.toBe("token");
  });

  it("sinal NUMÉRICO escolhe a coluna com números", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Início Férias", "Dias Férias"], [["01/03/2026", "30"], ["05/03/2026", "15"]]);
    expect(resolverColunaInfo(reg.list[0]!, "Férias", { tipo: "numerico" })).toMatchObject({ via: "sinal", idx: 1 });
  });

  it("sinal de TEXTO com valor prefere a coluna que contém o valor", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Situação", "Situação Anterior"], [["Férias", "Ativo"], ["Ativo", "Ativo"]]);
    const info = resolverColunaInfo(reg.list[0]!, "Situacao", { tipo: "texto", valor: "Férias" });
    expect(info.idx).toBe(0);
  });

  it("fail-closed: operação numérica sem nenhuma coluna numérica", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Obs Férias", "Nota Férias"], [["x", "y"]]);
    const info = resolverColunaInfo(reg.list[0]!, "Férias", { tipo: "numerico" });
    expect(info.idx).toBeNull();
    expect(info.via).toBe("ambigua");
  });

  it("a explicação lista os candidatos quando sobra ambiguidade real", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Obs Férias", "Nota Férias"], [["x", "y"]]);
    const msg = explicarColuna(reg, "tela1", "Férias", { tipo: "numerico" });
    expect(msg).toContain("AMBÍGUO");
    expect(msg).toContain("Obs Férias");
  });

  it("coluna inventada: diz as reais e sugere a mais próxima", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Nome", "Cargo"], [["Ana", "Analista"]]);
    const msg = explicarColuna(reg, "tela1", "Cargos");
    expect(msg).toContain("Cargo");
    expect(msg).toContain("quis dizer");
  });
});

describe("textoDatasetsDisponiveis", () => {
  it("sem nada carregado, orienta a chamar a ferramenta", () => {
    expect(textoDatasetsDisponiveis(newRegistry())).toContain("Nenhuma tabela");
  });

  it("lista id, tamanho e colunas — o que o erro precisa dizer", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Nome", "Cargo"], [["Ana", "Analista"], ["Bia", "Gestora"]]);
    const t = textoDatasetsDisponiveis(reg);
    expect(t).toContain("tela1");
    expect(t).toContain("2 linha");
    expect(t).toContain("Cargo");
  });
});
