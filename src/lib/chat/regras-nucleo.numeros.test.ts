import { describe, it, expect } from "vitest";
import { regraNumerosExatos } from "./regras-nucleo";

/**
 * A regra existe porque o modelo condensava valores DENTRO da tabela ("R$ 2,3
 * Mi"), e essa tabela é salva como relatório, exportada em CSV e vira gráfico.
 * O teste guarda as três coisas que a redação precisa dizer — se alguém
 * reescrever e perder uma, aqui falha.
 */
describe("regraNumerosExatos", () => {
  const r = regraNumerosExatos();

  it("proíbe a escala abreviada pelo nome", () => {
    for (const abrev of ["Mi", "MM", "K", "mil", "bi"]) expect(r).toContain(abrev);
    expect(r).toMatch(/NUNCA abrevie/i);
  });

  it("diz POR QUE, não só o que — é o que sobrevive a uma reescrita", () => {
    expect(r).toMatch(/relatório/i);
    expect(r).toMatch(/CSV/i);
    expect(r).toMatch(/gráfico/i);
  });

  it("libera o resumo no texto ao redor — ali é leitura, não dado", () => {
    expect(r).toMatch(/TEXTO/);
    expect(r).toMatch(/PODE resumir/i);
  });

  it("não manda inventar precisão que a origem não tem", () => {
    expect(r).toMatch(/não mais preciso que ela/i);
  });
});
