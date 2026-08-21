import { describe, it, expect } from "vitest";
import { faltaDestinoDaEntrega, perguntaDeEntrega, LINHAS_PARA_PERGUNTAR } from "./entrega";

/**
 * Os dois primeiros testes são os casos REAIS que motivaram o portão, com os
 * volumes reais. Se algum deles parar de passar, o portão perdeu a razão de
 * existir — não é regressão de detalhe, é o objetivo.
 *
 * Os NEGATIVOS pesam tanto quanto: perguntar quando a pessoa já disse o formato
 * é o defeito oposto, e o eval mede os dois lados separadamente justamente
 * porque um agente que pergunta sempre acerta metade do placar e destrói a
 * experiência.
 */
describe("faltaDestinoDaEntrega", () => {
  it("os dois casos medidos pelo dono", () => {
    // Gerou Excel; ele queria VER.
    expect(faltaDestinoDaEntrega("traga a lista completa", 96)).toBe(true);
    // Gerou Excel sem perguntar.
    expect(
      faltaDestinoDaEntrega("crie em colunas apenas o nome, matricula, codigo desligamento", 25),
    ).toBe(true);
  });

  it("formato JÁ declarado como arquivo: não pergunta", () => {
    expect(faltaDestinoDaEntrega("gere um excel com a lista completa", 96)).toBe(false);
    expect(faltaDestinoDaEntrega("crie uma planilha com todos os registros", 96)).toBe(false);
    expect(faltaDestinoDaEntrega("monte um pdf com a tabela", 96)).toBe(false);
    expect(faltaDestinoDaEntrega("quero baixar a lista completa", 96)).toBe(false);
  });

  it("formato JÁ declarado como chat: não pergunta", () => {
    expect(faltaDestinoDaEntrega("traga a lista completa aqui", 96)).toBe(false);
    expect(faltaDestinoDaEntrega("me mostre a lista completa na tela", 96)).toBe(false);
  });

  it("volume pequeno é entrega óbvia", () => {
    expect(faltaDestinoDaEntrega("traga a lista completa", LINHAS_PARA_PERGUNTAR - 1)).toBe(false);
    expect(faltaDestinoDaEntrega("traga a lista completa", 0)).toBe(false);
    // A fronteira exata entra — 25 registros já mereceu pergunta no caso real.
    expect(faltaDestinoDaEntrega("traga a lista completa", LINHAS_PARA_PERGUNTAR)).toBe(true);
  });

  it("pergunta de CONSULTA não é pedido de entrega", () => {
    expect(faltaDestinoDaEntrega("quais são os colaboradores da minha equipe?", 96)).toBe(false);
    expect(faltaDestinoDaEntrega("quantos desligados tivemos em março?", 96)).toBe(false);
    expect(faltaDestinoDaEntrega("qual o colaborador com maior salário?", 96)).toBe(false);
  });

  it("verbo de produção SEM objeto de lista não conta", () => {
    // "Preencha uma justificativa sobre esse desligamento" é ação de tela.
    expect(faltaDestinoDaEntrega("crie uma justificativa para o desligamento", 96)).toBe(false);
    expect(faltaDestinoDaEntrega("gere um gráfico de barras", 96)).toBe(false);
  });

  it("acento não atrapalha — `\\b` em JS é ASCII", () => {
    // "relação" e "última" quebrariam a borda de palavra sem a normalização.
    expect(faltaDestinoDaEntrega("monte a relação completa", 96)).toBe(true);
    expect(faltaDestinoDaEntrega("faça a listagem de todos", 96)).toBe(true);
  });

  it("entrada inválida não derruba nada", () => {
    expect(faltaDestinoDaEntrega("", 96)).toBe(false);
    expect(faltaDestinoDaEntrega("traga a lista completa", Number.NaN)).toBe(false);
    expect(faltaDestinoDaEntrega("traga a lista completa", -5)).toBe(false);
  });
});

describe("perguntaDeEntrega", () => {
  it("traz as opções na mão, não pergunta em aberto", () => {
    // Regra do dono: "perguntar em aberto transfere ao usuário o trabalho de
    // saber o que existe. Isso é pergunta ruim, não cautela."
    const p = perguntaDeEntrega(96);
    expect(p._perguntar).toContain("96");
    expect(p.opcoes.length).toBeGreaterThanOrEqual(2);
    expect(p.opcoes.join(" ").toLowerCase()).toContain("chat");
  });
});
