import { describe, it, expect } from "vitest";
import { newRegistry, registrarTabelaTela, registrarDataset, consultarDataset, usouDadosDaTela } from "./datasets";

/**
 * O widget manda as tabelas da tela em TODO turno. Antes, existir uma tabela
 * bastava para o chat afirmar "Resposta baseada no relatório visível nesta
 * tela" — mesmo numa resposta vinda da documentação. O registro de USO é o que
 * separa "estava na tela" de "foi consultado".
 */
describe("uso efetivo dos datasets", () => {
  it("tabela registrada e não consultada não conta como fonte", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Nome"], [["Ana"], ["Bruno"]]);
    expect(reg.list).toHaveLength(1);
    expect(usouDadosDaTela(reg)).toBe(false);
  });

  it("consultar a tabela da tela marca o uso", () => {
    const reg = newRegistry();
    const { id } = registrarTabelaTela(reg, ["Nome"], [["Ana"], ["Bruno"]]);
    consultarDataset(reg, id, [], "E");
    expect(usouDadosDaTela(reg)).toBe(true);
  });

  it("consultar dataset de FERRAMENTA não vira 'relatório desta tela'", () => {
    // Dados vindos de uma API são fonte legítima, mas não são a tela — e o aviso
    // fala especificamente do relatório visível.
    const reg = newRegistry();
    const r = registrarDataset(reg, { items: [{ nome: "Ana" }] });
    consultarDataset(reg, r!.id, [], "E");
    expect(usouDadosDaTela(reg)).toBe(false);
  });

  it("id inexistente não inventa uso", () => {
    const reg = newRegistry();
    registrarTabelaTela(reg, ["Nome"], [["Ana"]]);
    consultarDataset(reg, "tela99", [], "E");
    expect(usouDadosDaTela(reg)).toBe(false);
  });
});
