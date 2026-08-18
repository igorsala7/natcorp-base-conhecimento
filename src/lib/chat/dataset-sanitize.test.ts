import { describe, it, expect } from "vitest";
import { celulaDataset, limparTextoDataset } from "./dataset-sanitize";

/**
 * Regressão do 500 real: uma célula do relatório da tela trazia NUL e o upsert
 * do dataset quebrava com 22P05 ("unsupported Unicode escape sequence") — o
 * dataset não era salvo e as ferramentas de consulta ficavam sem os dados.
 */
describe("limparTextoDataset", () => {
  it("tira o NUL que quebra o Postgres", () => {
    expect(limparTextoDataset("ABC\u0000DEF")).toBe("ABCDEF");
    expect(limparTextoDataset("\u0000")).toBe("");
  });

  it("preserva acento, emoji e quebra de linha", () => {
    expect(limparTextoDataset("José — Ação\n2ª via 🎯")).toBe("José — Ação\n2ª via 🎯");
  });

  it("par substituto VÁLIDO (emoji) fica intacto", () => {
    const emoji = "🎯"; // 🎯
    expect(limparTextoDataset(`x${emoji}y`)).toBe(`x${emoji}y`);
  });

  it("substituto ÓRFÃO vira caractere de substituição em vez de estourar", () => {
    expect(limparTextoDataset("a\uD800b")).toBe("a�b");
    expect(limparTextoDataset("a\uDC00b")).toBe("a�b");
  });

  it("texto normal passa sem cópia desnecessária de conteúdo", () => {
    expect(limparTextoDataset("10970104 - Folha De Pagamento")).toBe("10970104 - Folha De Pagamento");
  });
});

describe("celulaDataset", () => {
  it("null/undefined viram string vazia", () => {
    expect(celulaDataset(null)).toBe("");
    expect(celulaDataset(undefined)).toBe("");
  });

  it("número e boolean viram texto", () => {
    expect(celulaDataset(0)).toBe("0");
    expect(celulaDataset(false)).toBe("false");
  });

  it("limpa o NUL vindo de qualquer tipo", () => {
    expect(celulaDataset("57695\u0000")).toBe("57695");
  });
});


/**
 * A marcação HTML que atravessava o caminho da TELA.
 *
 * A limpeza existia só para o retorno das APIs de integração — dois portões de
 * entrada de dataset e a regra em um deles. O recibo de pagamento entra pelo
 * outro, e o `<br>` chegava cru na resposta ao usuário (18/08/2026).
 */
describe("celulaDataset — marcação HTML da tela", () => {
  const recibo =
    "• Salário: R$ 19.541,50<br>• Férias no Mês: R$ 4.299,13<br>• 1/3 de Férias: R$ 1.433,07" +
    "<br>• Adição Tempo de Serviço: R$ 1.954,15<br>• Comissão: R$ 586,25";

  it("tira o <br> da lista de verbas sem perder verba nenhuma", () => {
    const limpo = celulaDataset(recibo);
    expect(limpo).not.toContain("<br>");
    // O `•` já separa os itens: vira espaço, não quebra de linha — quebra dentro
    // de célula estouraria a tabela markdown que o modelo monta na resposta.
    expect(limpo).toBe(
      "• Salário: R$ 19.541,50 • Férias no Mês: R$ 4.299,13 • 1/3 de Férias: R$ 1.433,07" +
        " • Adição Tempo de Serviço: R$ 1.954,15 • Comissão: R$ 586,25",
    );
    for (const verba of ["Salário", "Férias no Mês", "1/3 de Férias", "Adição Tempo de Serviço", "Comissão"])
      expect(limpo).toContain(verba);
    for (const valor of ["19.541,50", "4.299,13", "1.433,07", "1.954,15", "586,25"]) expect(limpo).toContain(valor);
  });

  it("célula LONGA também é limpa — o teto de 500 é para documento de API, não para célula", () => {
    // Recibo com muitas verbas passa de 500 caracteres. Sob o teto antigo a
    // célula seria devolvida crua justamente no caso que mais precisa.
    const longo = Array.from({ length: 20 }, (_, i) => `• Verba ${i}: R$ 1.000,00`).join("<br>");
    expect(longo.length).toBeGreaterThan(500);
    expect(celulaDataset(longo)).not.toContain("<br>");
  });

  it("o ícone renderizado vira só o texto", () => {
    expect(celulaDataset('<span class="fa fa-check-circle colorSuccess"></span> Concluida')).toBe("Concluida");
  });

  it("valor sem marcação passa intacto", () => {
    expect(celulaDataset("R$ 1.234,56")).toBe("R$ 1.234,56");
    expect(celulaDataset("a < b e c > d")).toBe("a < b e c > d");
  });

  it("continua tirando o NUL, que era o motivo original desta função", () => {
    expect(celulaDataset("abc\u0000def")).toBe("abcdef");
  });
});
