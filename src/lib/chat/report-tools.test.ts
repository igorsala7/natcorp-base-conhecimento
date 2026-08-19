import { describe, it, expect } from "vitest";
import { buildChartTool, buildReportTool, buildTrocaFonteTool, escopoRelatorioDirective, intencaoVisual, type ArquivoGerado,
  integUsageDirective,
} from "./report-tools";
import { newRegistry, registrarTabelaTela } from "./datasets";
import type { ChartSpec } from "./chart-spec";
import type { ReportSpec } from "@/lib/reports/report-spec";

/** Registro com uma tabela da tela, como o turno real monta. */
function registroComTela() {
  const reg = newRegistry();
  registrarTabelaTela(reg, ["Nome", "Cargo", "Salário"], [
    ["Ana", "Analista", "5.000,00"],
    ["Bia", "Gestora", "9.000,00"],
    ["Cid", "Analista", "4.200,00"],
  ]);
  return reg;
}

/** Executa a tool pelo nome, sem depender do runtime do AI SDK. */
async function exec(tools: Record<string, unknown>, nome: string, input: unknown) {
  const t = tools[nome] as { execute: (i: unknown, o?: unknown) => Promise<unknown> };
  return (await t.execute(input, {})) as Record<string, unknown>;
}

/**
 * O gate por regex era o motivo de o agente "se perder": um follow-up como
 * "agora em pizza" não casava com nada, e o modelo ficava LITERALMENTE sem a
 * ferramenta. Hoje a regex só dá ÊNFASE — mas ela precisa cobrir o que o usuário
 * realmente escreve, porque ainda controla o orçamento de passos.
 */
describe("intencaoVisual", () => {
  const casos: [string, boolean][] = [
    ["gera um excel disso", true],
    ["exporta em pdf", true],
    ["quero uma planilha", true],
    ["faz um gráfico das faltas", true],
    ["crie um documento com o passo a passo", true],
    ["faça um arquivo com esses dados", true],
    ["me manda em anexo", true],
    ["quero baixar isso", true],
    ["plota isso aí", true],
    ["desenha um comparativo em pizza", true],
    ["monta um ppt com os números", true],
    ["quantos colaboradores estão ativos?", false],
    ["qual o salário da Ana?", false],
    ["bom dia", false],
  ];
  for (const [frase, esperado] of casos) {
    it(`${esperado ? "reconhece" : "ignora"}: "${frase}"`, () => {
      expect(intencaoVisual(frase)).toBe(esperado);
    });
  }

  it('aceite curto conta como intenção quando o assistente ofereceu o arquivo', () => {
    const hist = [{ role: "assistant", content: "Quer que eu gere um Excel com isso?" }];
    expect(intencaoVisual("pode", hist)).toBe(true);
    expect(intencaoVisual("pode", [])).toBe(false);
  });
});

describe("montar_grafico", () => {
  it("expande o dataset e devolve o gráfico pronto", async () => {
    const reg = registroComTela();
    const sink: ChartSpec[] = [];
    const r = await exec(buildChartTool(sink, reg), "montar_grafico", {
      tipo: "colunas", titulo: "Por cargo", dados_de: "tela1", categoria: "Cargo", agregacao: "contar",
    });
    expect(r.ok).toBe(true);
    expect(sink).toHaveLength(1);
    expect(sink[0]!.categorias).toEqual(expect.arrayContaining(["Analista", "Gestora"]));
  });

  it("dataset inexistente: erro DIZ os ids reais e não empurra nada para o sink", async () => {
    const reg = registroComTela();
    const sink: ChartSpec[] = [];
    const r = await exec(buildChartTool(sink, reg), "montar_grafico", {
      tipo: "colunas", titulo: "X", dados_de: "ds9", categoria: "Cargo",
    });
    expect(r.ok).toBeUndefined();
    expect(String(r.erro)).toContain("ds9");
    expect(String(r.erro)).toContain("tela1");
    expect(sink).toHaveLength(0);
  });

  it("coluna errada: erro cita as colunas REAIS e sugere a mais próxima", async () => {
    const reg = registroComTela();
    const r = await exec(buildChartTool([], reg), "montar_grafico", {
      tipo: "colunas", titulo: "X", dados_de: "tela1", categoria: "Departamento",
    });
    expect(String(r.erro)).toContain("Cargo");
    expect(String(r.erro)).toContain("Departamento");
  });

  it("sem tipo e sem gráfico anterior: oferece os botões em vez de chutar", async () => {
    const reg = registroComTela();
    const sink: ChartSpec[] = [];
    const escolhas: { spec: ChartSpec; recomendado: string; pergunta: string }[] = [];
    const r = await exec(buildChartTool(sink, reg, escolhas), "montar_grafico", {
      titulo: "Por cargo", dados_de: "tela1", categoria: "Cargo", agregacao: "contar",
    });
    expect(r.ok).toBe(true);
    expect(sink).toHaveLength(0);
    expect(escolhas).toHaveLength(1);
    expect(escolhas[0]!.recomendado).toBeTruthy();
  });

  it("sem tipo, mas já houve gráfico: assume a sugestão (perguntar toda vez vira ruído)", async () => {
    const reg = registroComTela();
    const sink: ChartSpec[] = [{ tipo: "colunas", titulo: "anterior", categorias: ["a"], series: [{ nome: "s", valores: [1] }] }];
    const escolhas: { spec: ChartSpec; recomendado: string; pergunta: string }[] = [];
    await exec(buildChartTool(sink, reg, escolhas), "montar_grafico", {
      titulo: "Por cargo", dados_de: "tela1", categoria: "Cargo", agregacao: "contar",
    });
    expect(escolhas).toHaveLength(0);
    expect(sink).toHaveLength(2);
  });

  it("sem fonte nenhuma: o erro ENSINA as duas formas, com exemplo", async () => {
    const r = await exec(buildChartTool([], newRegistry()), "montar_grafico", { tipo: "pizza", titulo: "X" });
    expect(String(r.erro)).toContain("dados_de");
    expect(String(r.erro)).toContain("categorias");
  });
});

describe("gerar_relatorio", () => {
  const renderFake = async (spec: ReportSpec): Promise<ArquivoGerado> =>
    ({ filename: `r.${spec.formato}`, mimeType: "application/octet-stream", base64: "AAAA" });

  it("gera o arquivo DENTRO da tool e devolve o nome real", async () => {
    const reg = registroComTela();
    const sink: ReportSpec[] = [];
    const arquivos: ArquivoGerado[] = [];
    const r = await exec(buildReportTool(sink, reg, renderFake, arquivos), "gerar_relatorio", {
      titulo: "Equipe", formato: "xlsx", blocos: [{ tipo: "tabela", tabela: { dados_de: "tela1" } }],
    });
    expect(r.ok).toBe(true);
    expect(arquivos).toHaveLength(1);
    expect(String(r.mensagem)).toContain("r.xlsx");
    // A tabela foi expandida com as LINHAS REAIS, não redigitadas pelo modelo.
    const bloco = sink[0]!.blocos[0] as { tipo: "tabela"; linhas: string[][] };
    expect(bloco.linhas).toHaveLength(3);
  });

  it("dados_de inválido ABORTA: nenhum arquivo, erro dizendo os ids válidos", async () => {
    const reg = registroComTela();
    const sink: ReportSpec[] = [];
    const arquivos: ArquivoGerado[] = [];
    const r = await exec(buildReportTool(sink, reg, renderFake, arquivos), "gerar_relatorio", {
      titulo: "Equipe", formato: "xlsx", blocos: [{ tipo: "tabela", tabela: { dados_de: "ds7" } }],
    });
    // Este é o bug que produzia um Excel VAZIO com "gerei com sucesso".
    expect(r.ok).toBeUndefined();
    expect(String(r.erro)).toContain("ds7");
    expect(String(r.erro)).toContain("NENHUM arquivo");
    expect(arquivos).toHaveLength(0);
    expect(sink).toHaveLength(0);
  });

  it("falha do render vira ERRO da ferramenta, não sucesso silencioso", async () => {
    const arquivos: ArquivoGerado[] = [];
    const r = await exec(
      buildReportTool([], registroComTela(), async () => { throw new Error("resvg quebrou"); }, arquivos),
      "gerar_relatorio",
      { titulo: "X", formato: "pdf", blocos: [{ tipo: "texto", texto: "oi" }] },
    );
    expect(r.ok).toBeUndefined();
    expect(String(r.erro)).toContain("resvg quebrou");
    expect(arquivos).toHaveLength(0);
  });

  it("vários formatos numa chamada só (não gasta um passo por formato)", async () => {
    const arquivos: ArquivoGerado[] = [];
    const r = await exec(
      buildReportTool([], registroComTela(), renderFake, arquivos),
      "gerar_relatorio",
      { titulo: "X", formatos: ["pdf", "docx", "pptx"], blocos: [{ tipo: "texto", texto: "oi" }] },
    );
    expect(r.ok).toBe(true);
    expect(arquivos.map((a) => a.filename)).toEqual(["r.pdf", "r.docx", "r.pptx"]);
  });

  it("respeita o teto de arquivos por turno", async () => {
    const arquivos: ArquivoGerado[] = [];
    const r = await exec(
      buildReportTool([], registroComTela(), renderFake, arquivos),
      "gerar_relatorio",
      { titulo: "X", formatos: ["pdf", "docx", "pptx", "xlsx"], blocos: [{ tipo: "texto", texto: "oi" }] },
    );
    expect(String(r.erro)).toContain("Limite");
    expect(arquivos).toHaveLength(0);
  });

  it("gráfico degradado pelo formato: a mensagem manda AVISAR o usuário", async () => {
    const arquivos: ArquivoGerado[] = [];
    const r = await exec(
      buildReportTool([], registroComTela(), renderFake, arquivos),
      "gerar_relatorio",
      {
        titulo: "X", formato: "csv",
        blocos: [
          { tipo: "texto", texto: "oi" },
          { tipo: "grafico", grafico: { tipo: "radar", titulo: "g", categorias: ["a", "b"], series: [{ nome: "s", valores: [1, 2] }] } },
        ],
      },
    );
    expect(r.ok).toBe(true);
    expect(String(r.mensagem)).toContain("AVISE o usuário");
  });
});

describe("tipo sugerido dentro do arquivo", () => {
  const renderFake = async (spec: ReportSpec): Promise<ArquivoGerado> =>
    ({ filename: `r.${spec.formato}`, mimeType: "x", base64: "AAAA" });

  it("bloco de gráfico sem `tipo` não cai em colunas por padrão", async () => {
    const sink: ReportSpec[] = [];
    await exec(buildReportTool(sink, registroComTela(), renderFake, []), "gerar_relatorio", {
      titulo: "X", formato: "pdf",
      blocos: [{ tipo: "grafico", grafico: { titulo: "Evolução", categorias: ["01/2026", "02/2026", "03/2026"], series: [{ nome: "s", valores: [1, 2, 3] }] } }],
    });
    const g = sink[0]!.blocos[0] as { tipo: "grafico"; grafico: { tipo: string } };
    expect(g.grafico.tipo).toBe("linha"); // rótulos de mês → série temporal
  });
});

/**
 * A diretriz antiga mandava o modelo pedir ao usuário que DIGITASSE "Conhecimento da
 * IA" para trocar de fonte — uma senha que ninguém tem como adivinhar, num sistema
 * que já sabe renderizar botões. Agora ele declara o que falta e o servidor oferece
 * as opções num clique.
 */
describe("buscar_no_sistema (troca de fonte)", () => {
  it("registra o motivo na língua do usuário", async () => {
    const sink: { motivo: string }[] = [];
    const r = await exec(buildTrocaFonteTool(sink), "buscar_no_sistema", {
      motivo: "a lista de colaboradores do centro de custo MEDICINA DO TRABALHO",
    });
    expect(r.ok).toBe(true);
    expect(sink).toHaveLength(1);
    expect(sink[0]!.motivo).toContain("MEDICINA DO TRABALHO");
  });

  it("a mensagem de volta PROÍBE pedir que o usuário digite algo", async () => {
    const sink: { motivo: string }[] = [];
    const r = await exec(buildTrocaFonteTool(sink), "buscar_no_sistema", { motivo: "x" });
    expect(String(r.mensagem)).toContain("NÃO peça para ele digitar");
  });

  it("corta motivo gigante", async () => {
    const sink: { motivo: string }[] = [];
    await exec(buildTrocaFonteTool(sink), "buscar_no_sistema", { motivo: "x".repeat(500) });
    expect(sink[0]!.motivo.length).toBe(200);
  });
});

describe("escopoRelatorioDirective", () => {
  it("não pede mais que o usuário digite uma palavra-chave", () => {
    const d = escopoRelatorioDirective();
    expect(d).not.toContain("Conhecimento da IA");
    expect(d).toContain("buscar_no_sistema");
  });

  it("proíbe explicitamente mandar o usuário para outra tela ou menu", () => {
    const d = escopoRelatorioDirective();
    expect(d).toMatch(/TELA, MENU ou aplica/);
    expect(d).toMatch(/nunca peça para ele escrever/i);
  });
});

describe("o vocabulário de layout chega ao arquivo", () => {
  it("secao, destaques, cards e nota atravessam a tool até a spec", () => {
    // O `execute` monta os blocos à mão para expandir `dados_de`. Este teste
    // guarda o caminho de passagem: um campo novo no schema que não chega ao
    // renderizador é pior que campo nenhum — o modelo o preenche e nada aparece.
    let capturado: ReportSpec | null = null;
    const arquivos: ArquivoGerado[] = [];
    const tools = buildReportTool(
      [],
      undefined,
      async (spec) => {
        capturado = spec;
        return { filename: "x.pptx", mimeType: "application/pptx", base64: "" };
      },
      arquivos,
    );
    return exec(tools, "gerar_relatorio", {
        titulo: "T",
        formato: "pptx",
        blocos: [
          { tipo: "secao", titulo: "Panorama", subtitulo: "Julho" },
          { tipo: "destaques", itens: [{ valor: "1.284", rotulo: "Colaboradores" }, { valor: "4,8%", rotulo: "Turnover" }] },
          { tipo: "cards", itens: [{ titulo: "A", texto: "aa" }, { titulo: "B", texto: "bb" }] },
          { tipo: "texto", titulo: "Leitura", texto: "oi", nota: "o que isto mostra" },
        ],
      }).then(() => {
        const spec = capturado as unknown as ReportSpec;
        expect(spec.blocos.map((b) => b.tipo)).toEqual(["secao", "destaques", "cards", "texto"]);
        const ultimo = spec.blocos[3]!;
        expect("nota" in ultimo ? ultimo.nota : null).toBe("o que isto mostra");
        expect("titulo" in ultimo ? ultimo.titulo : null).toBe("Leitura");
      });
  });
});

/**
 * SITUAÇÃO PADRÃO = ATIVOS.
 *
 * "Quais são os colaboradores do meu centro de custo?" foi consultado com
 * `p_situacao: "T"` e trouxe 40 registros, com desligados no meio
 * (produção, 19/08/2026). A descrição do parâmetro lista as opções
 * ("A - Ativos, D - Desligados, T - Todos") sem dizer qual preferir — e diante
 * disso "Todos" é uma escolha defensável.
 *
 * A resposta não estava errada segundo a ferramenta; estava errada segundo a
 * pergunta. Quem pergunta "quem trabalha no meu centro de custo" não está
 * pedindo quem trabalhava.
 */
describe("integUsageDirective — situação do colaborador", () => {
  it("manda usar ATIVOS por padrão", () => {
    const d = integUsageDirective();
    expect(d).toMatch(/SITUAÇÃO DO COLABORADOR/);
    expect(d).toMatch(/SEMPRE o valor de ATIVOS/);
  });

  it("abre exceção quando o usuário PEDE desligados", () => {
    const d = integUsageDirective();
    expect(d).toMatch(/desligad/i);
    expect(d).toMatch(/PEDIR explicitamente/);
  });

  it("a regra também vale com ferramenta forçada", () => {
    // O prefixo de fonte escolhida não pode engolir as regras que vêm depois.
    expect(integUsageDirective("relatorio_recibo_pagamento")).toMatch(/SEMPRE o valor de ATIVOS/);
  });
});

/**
 * Duas confusões medidas em produção (19/08/2026), ambas de instrução ausente.
 */
describe("integUsageDirective — continuidade entre turnos", () => {
  it("proíbe inventar nome de tabela de turno anterior", () => {
    // Pediu `dados_de: "_resultado_colaboradores_cc"` — nome inventado para a
    // tabela do turno anterior. Duas chamadas queimadas, 138 mil tokens e 4
    // passos numa pergunta de um passo.
    const d = integUsageDirective();
    expect(d).toMatch(/TABELAS SÃO DO TURNO ATUAL/);
    expect(d).toMatch(/PROIBIDO inventar um nome/);
    expect(d).toMatch(/CHAME a ferramenta de novo/);
  });

  it("manda repetir a MESMA ferramenta numa variação do pedido", () => {
    // "histórico financeiro da Tania de março" → historico_financeiro, 34 regs.
    // "compara com o mês de Abril" → relatorio_recibo_pagamento, ZERO regs.
    const d = integUsageDirective();
    expect(d).toMatch(/MESMO PEDIDO, MESMA FERRAMENTA/);
    expect(d).toMatch(/compara com/);
    expect(d).toMatch(/trocando só o parâmetro/);
  });
});
