import { describe, it, expect } from "vitest";
import { escolherRanking } from "./rank-resgate";

const t = (key: string, sim: number) => ({ key, sim });

describe("escolherRanking — ontologia é resgate, não distorção", () => {
  it("a pergunta crua achou: a ontologia NÃO reordena (o caso medido)", () => {
    // Números reais do catálogo NATCORP para
    // "Quero meu histórico financeiro do mês de 05/2025".
    const pura = [t("historico_financeiro", 0.698), t("relatorio_recibo_pagamento", 0.691)];
    const expandida = [t("relatorio_recibo_pagamento", 0.796), t("historico_financeiro", 0.744)];
    const r = escolherRanking(pura, expandida);
    expect(r.viaOntologia).toBe(false);
    expect(r.matches[0]!.key).toBe("historico_financeiro");
  });

  it("a pergunta crua não achou nada: a ontologia RESGATA", () => {
    // É para isto que a expansão existe: o usuário diz "holerite", a ferramenta
    // se chama "eventos financeiros".
    const r = escolherRanking([], [t("relatorio_recibo_pagamento", 0.62)]);
    expect(r.viaOntologia).toBe(true);
    expect(r.matches[0]!.key).toBe("relatorio_recibo_pagamento");
  });

  it("ninguém achou: nada é inventado", () => {
    const r = escolherRanking([], []);
    expect(r.matches).toEqual([]);
    expect(r.viaOntologia).toBe(false);
  });

  it("uma candidata fraca na crua ainda vence uma forte na expandida", () => {
    // Deliberado: a palavra do usuário manda mesmo quando a expansão parece
    // "melhor" — foi confiar no número maior que produziu o defeito.
    const r = escolherRanking([t("certa", 0.57)], [t("irma", 0.92)]);
    expect(r.matches[0]!.key).toBe("certa");
  });
});
