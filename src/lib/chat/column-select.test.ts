import { describe, it, expect } from "vitest";
import { perfilarColunas, selecionarColunas, notaColunasOmitidas, recortarLinha, type EntradaEscolha } from "./column-select";

/** Relatório de folha realista: largo, com dimensões e muitas verbas. */
function folha(nLinhas = 50) {
  const colunas = [
    "Empresa", "Filial", "Competência", "Matrícula", "Nome", "Centro de Custo", "Cargo", "Situação",
    ...Array.from({ length: 30 }, (_, i) => `Verba ${i + 1}`),
    "Total Proventos", "Total Descontos", "Líquido",
  ];
  const linhas = Array.from({ length: nLinhas }, (_, r) => [
    "1", r % 3 === 0 ? "97" : "1", "03/2026", String(1000 + r), `Colab ${r}`,
    ["MEDICINA DO TRABALHO", "FOLHA DE PAGAMENTO", "SEGURANÇA DO TRABALHO"][r % 3]!,
    ["Analista", "Gestor"][r % 2]!, "Ativo",
    ...Array.from({ length: 30 }, () => "1.234,56"),
    "5.000,00", "1.200,00", "3.800,00",
  ]);
  return { colunas, linhas };
}
const base = (p: Partial<EntradaEscolha> = {}): EntradaEscolha => ({ ...folha(), pergunta: "", ...p });

describe("perfilarColunas", () => {
  it("classifica número, data e texto", () => {
    const { colunas, linhas } = folha();
    const p = perfilarColunas(colunas, linhas);
    expect(p.find((x) => x.nome === "Competência")!.tipo).toBe("data");
    expect(p.find((x) => x.nome === "Líquido")!.tipo).toBe("numero");
    expect(p.find((x) => x.nome === "Nome")!.tipo).toBe("texto");
  });

  it("mede cardinalidade — é o que separa dimensão de texto livre", () => {
    const { colunas, linhas } = folha(50);
    const p = perfilarColunas(colunas, linhas);
    expect(p.find((x) => x.nome === "Centro de Custo")!.distintos).toBe(3);
    expect(p.find((x) => x.nome === "Nome")!.distintos).toBe(50);
  });
});

describe("selecionarColunas — quando NÃO estreitar", () => {
  it("relatório estreito passa inteiro (o corte não paga o risco)", () => {
    const r = selecionarColunas({ colunas: ["A", "B", "C"], linhas: [["1", "2", "3"]], pergunta: "some o A" });
    expect(r.motivo).toBe("estreito");
    expect(r.omitidas).toEqual([]);
  });

  it("pedido completo/estratégico traz 100% das colunas", () => {
    const r = selecionarColunas(base({ pergunta: "faça uma análise estratégica completa", pedidoCompleto: true }));
    expect(r.motivo).toBe("completo");
    expect(r.omitidas).toEqual([]);
  });

  it("nada casou → FAIL-OPEN (estreitar sem sinal é o pior dos mundos)", () => {
    const r = selecionarColunas(base({ pergunta: "e aí, tudo certo por aí?" }));
    expect(r.motivo).toBe("sem-casamento");
    expect(r.omitidas).toEqual([]);
  });

  it("corte irrisório não vale o risco de perder dimensão", () => {
    const colunas = ["Empresa", "Competência", "Centro de Custo", "Cargo", "Situação", "Filial", "Matrícula", "Nome", "Turno", "Escala", "Setor", "Vínculo", "Valor"];
    const linhas = [["1", "03/2026", "A", "Analista", "Ativo", "97", "1", "Ana", "M", "5x2", "RH", "CLT", "10,00"]];
    const r = selecionarColunas({ colunas, linhas, pergunta: "qual o valor por centro de custo" });
    expect(["pouco-ganho", "estreito"]).toContain(r.motivo);
  });
});

describe("selecionarColunas — o recorte", () => {
  const pedido = base({ pergunta: "qual o centro de custo com maior total de proventos?" });

  it("mantém o alvo do usuário", () => {
    const r = selecionarColunas(pedido);
    const nomes = r.manter.map((i) => pedido.colunas[i]!);
    expect(nomes).toContain("Centro de Custo");
    expect(nomes).toContain("Total Proventos");
  });

  it("PROTEGE as dimensões — sem elas o agregado sai errado", () => {
    const r = selecionarColunas(pedido);
    const nomes = r.manter.map((i) => pedido.colunas[i]!);
    // Somar sem separar empresa/filial/competência mistura meses e empresas.
    for (const dim of ["Empresa", "Filial", "Competência", "Cargo", "Situação"]) {
      expect(nomes, dim).toContain(dim);
    }
  });

  it("corta o que não serve — as 30 verbas somem da prévia", () => {
    const r = selecionarColunas(pedido);
    expect(r.motivo).toBe("recorte");
    expect(r.omitidas.filter((c) => c.startsWith("Verba")).length).toBeGreaterThan(20);
    expect(r.manter.length).toBeLessThan(pedido.colunas.length * 0.6);
  });

  it("pedido de agregação puxa as colunas numéricas", () => {
    const e = base({ pergunta: "qual a média de líquido por cargo?" });
    const nomes = selecionarColunas(e).manter.map((i) => e.colunas[i]!);
    expect(nomes).toContain("Líquido");
  });

  it("a ontologia casa o que o usuário NÃO digitou", () => {
    const e = base({ pergunta: "qual o holerite líquido por cargo?", formasOntologia: ["recibo de pagamento", "contracheque"] });
    expect(selecionarColunas(e).manter.length).toBeGreaterThan(0);
  });

  it("a escolha da IA rápida entra como casamento", () => {
    const e = base({ pergunta: "analisa isso aqui", escolhidasPorIa: ["Total Descontos"] });
    const nomes = selecionarColunas(e).manter.map((i) => e.colunas[i]!);
    expect(nomes).toContain("Total Descontos");
  });

  it("preserva a ORDEM original das colunas", () => {
    const r = selecionarColunas(pedido);
    expect(r.manter).toEqual([...r.manter].sort((a, b) => a - b));
  });
});

describe("notaColunasOmitidas", () => {
  it("declara o que ficou de fora e como alcançar", () => {
    const n = notaColunasOmitidas(["Verba 1", "Verba 2"], "tela1");
    expect(n).toContain("Verba 1");
    expect(n).toContain('dados_de="tela1"');
    expect(n).toContain("NUNCA diga que o relatório não tem");
  });

  it("sem omissão, nota vazia", () => {
    expect(notaColunasOmitidas([], "tela1")).toBe("");
  });
});

describe("recortarLinha", () => {
  it("recorta preservando a ordem e tolera célula faltante", () => {
    expect(recortarLinha(["a", "b", "c"], [0, 2])).toEqual(["a", "c"]);
    expect(recortarLinha(["a"], [0, 5])).toEqual(["a", ""]);
  });
});

describe("contagem não é agregação de medida", () => {
  it('"quantos colaboradores por cargo?" recorta — contar usa LINHAS, não colunas numéricas', () => {
    const e = base({ pergunta: "quantos colaboradores por cargo?" });
    const r = selecionarColunas(e);
    expect(r.motivo).toBe("recorte");
    const nomes = r.manter.map((i) => e.colunas[i]!);
    expect(nomes).toContain("Cargo");
    expect(r.omitidas.filter((c) => c.startsWith("Verba")).length).toBeGreaterThan(20);
  });

  it("contagem COM medida citada mantém a medida", () => {
    const e = base({ pergunta: "quantos têm líquido acima de 3000?" });
    const nomes = selecionarColunas(e).manter.map((i) => e.colunas[i]!);
    expect(nomes).toContain("Líquido");
  });
});
