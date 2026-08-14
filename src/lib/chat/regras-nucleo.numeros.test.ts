import { describe, it, expect } from "vitest";
import { regraNumerosExatos, regraMatriculaComFonte } from "./regras-nucleo";

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

describe("regraMatriculaComFonte", () => {
  it("lista as três origens legítimas do número", () => {
    const r = regraMatriculaComFonte();
    expect(r).toMatch(/resultado de ferramenta DESTE turno/i);
    expect(r).toMatch(/identidade de quem está perguntando/i);
    expect(r).toMatch(/o que a pessoa digitou/i);
  });

  it("proíbe memória, dedução pelo nome e conversa anterior", () => {
    // O caso real: "Tony Oliveira" virou matricula=607305 na PRIMEIRA chamada,
    // sem nenhuma consulta que ligasse o nome ao número.
    expect(regraMatriculaComFonte()).toMatch(/NUNCA de memória, de dedução pelo nome/i);
  });

  it("manda resolver o nome ANTES e perguntar quando há mais de um", () => {
    const r = regraMatriculaComFonte();
    expect(r).toMatch(/PRIMEIRO consulte a ferramenta de cadastro/i);
    expect(r).toMatch(/PERGUNTE qual — não escolha/i);
  });

  it("diz por que o erro é invisível", () => {
    // Sem o motivo, a regra vira mais uma linha de "tenha cuidado".
    expect(regraMatriculaComFonte()).toMatch(/respondem certo sobre a PESSOA ERRADA/i);
  });
});
