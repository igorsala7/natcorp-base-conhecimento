import { describe, it, expect } from "vitest";
import { screenTablesBlock } from "./form-fields";
import { newRegistry } from "./datasets";

/**
 * RECORTE DE COLUNAS na prévia. Um Interactive Report de folha tem 60+ colunas e a
 * prévia manda 40 linhas × todas elas. Quando a pergunta é sobre 3 colunas, as outras
 * são custo puro — mas cortar uma DIMENSÃO produziria agregado errado, não resposta
 * incompleta. Estes testes travam as duas pontas.
 */
const colunas = [
  "Empresa", "Filial", "Competência", "Matrícula", "Nome", "Centro de Custo", "Situação",
  ...Array.from({ length: 30 }, (_, i) => `Verba ${i + 1}`),
  "Total Proventos", "Líquido",
];
const linhas = Array.from({ length: 20 }, (_, r) => [
  "1", "97", "03/2026", String(1000 + r), `Colab ${r}`,
  ["MEDICINA DO TRABALHO", "FOLHA DE PAGAMENTO"][r % 2]!, "Ativo",
  ...Array.from({ length: 30 }, () => "1.234,56"),
  "5.000,00", "3.800,00",
]);
const tela = [{ nome: "Folha", tipo: "IR", colunas, linhas, total: linhas.length }];
const PERGUNTA = "qual o centro de custo com maior total de proventos?";

describe("screenTablesBlock — recorte de colunas", () => {
  it("sem contexto do pedido, NADA é cortado (o recorte é opt-in)", () => {
    expect(screenTablesBlock(tela, newRegistry()).block).toContain("Verba 30");
  });

  it("pergunta específica corta as verbas e MANTÉM as dimensões", () => {
    const { block } = screenTablesBlock(tela, newRegistry(), { pergunta: PERGUNTA });
    expect(block).toContain("Centro de Custo");
    expect(block).toContain("Total Proventos");
    // Sem estas, somar mistura empresas, filiais e competências — número errado.
    for (const dim of ["Empresa", "Filial", "Competência", "Situação"]) expect(block, dim).toContain(dim);
  });

  it("declara o que ficou de fora — senão o agente diria que o dado não existe", () => {
    const { block } = screenTablesBlock(tela, newRegistry(), { pergunta: PERGUNTA });
    expect(block).toContain("O relatório TEM outras");
    expect(block).toContain("Verba 17");
    expect(block).toContain("NUNCA diga que o relatório não tem");
  });

  it("o DATASET continua com 100% das colunas — nada se perde", () => {
    const reg = newRegistry();
    screenTablesBlock(tela, reg, { pergunta: PERGUNTA });
    expect(reg.list[0]!.colunas).toHaveLength(colunas.length);
    expect(reg.list[0]!.rows).toHaveLength(linhas.length);
  });

  it("análise ampla traz tudo", () => {
    const { block } = screenTablesBlock(tela, newRegistry(), { pergunta: "análise estratégica completa", pedidoCompleto: true });
    expect(block).toContain("Verba 30");
    expect(block).not.toContain("O relatório TEM outras");
  });

  it("a economia é real", () => {
    const cheio = screenTablesBlock(tela, newRegistry()).block;
    const recortado = screenTablesBlock(tela, newRegistry(), { pergunta: PERGUNTA }).block;
    expect(recortado.length).toBeLessThan(cheio.length * 0.6);
  });
});
