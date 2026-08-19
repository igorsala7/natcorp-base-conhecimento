import { describe, it, expect } from "vitest";
import { numeroEscolhido, opcoesOferecidas, resolverEscolha } from "./escolha-numerada";

/** A resposta real que o agente deu antes do "1" (produção, 19/08/2026). */
const MENU_REAL = `Para consultar as marcações de ponto de hoje, preciso especificar quais colaboradores você quer ver. Você quer:

1. **Todos os colaboradores da empresa** (a lista completa de quem marcou ponto)?
2. **Colaboradores de um grupo específico** — como um centro de custo, filial ou cargo determinado?
3. **Alguns colaboradores em particular** — se souber o nome ou matrícula?

Qual seria o recorte?`;

describe("resolverEscolha — o caso que quebrou", () => {
  it('"1" vira a opção 1, não uma busca por "1"', () => {
    expect(resolverEscolha("1", MENU_REAL)).toBe("Todos os colaboradores da empresa (a lista completa de quem marcou ponto)?");
  });

  it("as demais opções também resolvem", () => {
    expect(resolverEscolha("2", MENU_REAL)).toMatch(/grupo específico/);
    expect(resolverEscolha("3", MENU_REAL)).toMatch(/em particular/);
  });

  it("número fora da lista não inventa opção", () => {
    expect(resolverEscolha("7", MENU_REAL)).toBeNull();
  });

  it("sem menu na resposta anterior, não resolve nada", () => {
    expect(resolverEscolha("1", "Encontrei 40 colaboradores ativos no seu centro de custo.")).toBeNull();
  });
});

describe("numeroEscolhido", () => {
  it("aceita as formas que as pessoas escrevem", () => {
    for (const s of ["1", " 2 ", "3.", "2)", "opção 1", "Opcao 2", "item 3", "a 1"]) {
      expect(numeroEscolhido(s)).toBeGreaterThan(0);
    }
  });

  it("aceita ordinal por extenso", () => {
    expect(numeroEscolhido("a primeira")).toBe(1);
    expect(numeroEscolhido("segunda")).toBe(2);
  });

  it("NÃO trata pergunta de verdade como escolha", () => {
    // O risco do outro lado: sequestrar uma pergunta legítima que começa com
    // número seria pior que não resolver escolha nenhuma.
    for (const s of ["1 colaborador está de férias?", "quantos são 2 meses de aviso", "matrícula 205818", ""]) {
      expect(numeroEscolhido(s)).toBeNull();
    }
  });

  it("número absurdo não vira escolha", () => {
    expect(numeroEscolhido("2025")).toBeNull();
    expect(numeroEscolhido("99")).toBeNull();
  });
});

describe("opcoesOferecidas", () => {
  it("reconhece `1.`, `1)` e `1 -`", () => {
    expect(opcoesOferecidas("1) Férias\n2) Ponto")).toEqual(["Férias", "Ponto"]);
    expect(opcoesOferecidas("1 - Férias\n2 - Ponto")).toEqual(["Férias", "Ponto"]);
  });

  it("PASSO A PASSO não é menu", () => {
    // "1. Abra a tela  2. Clique em salvar" é instrução, não pergunta. Se virasse
    // menu, responder "2" reescreveria a pergunta para "clique em salvar" — e o
    // agente iria consultar dados sobre um clique.
    const passos = "Para lançar o abono:\n\n1. Abra a tela de Frequência\n2. Clique em Salvar";
    // São opções por FORMA; o que separa é o contexto — por isso o chamador só
    // usa isto quando a mensagem do usuário é uma escolha PURA.
    expect(opcoesOferecidas(passos)).toHaveLength(2);
    // E uma escolha pura contra um passo a passo é o limite conhecido:
    // preferimos resolver "2" a deixá-lo virar busca por "2".
    expect(resolverEscolha("2", passos)).toBe("Clique em Salvar");
  });

  it("lista que não começa em 1 não é menu", () => {
    expect(opcoesOferecidas("2. Segunda coisa\n3. Terceira")).toEqual([]);
  });

  it("uma opção só não é menu", () => {
    expect(opcoesOferecidas("1. Única")).toEqual([]);
  });

  it("texto sem numeração devolve vazio", () => {
    expect(opcoesOferecidas("Consultei e encontrei 10.149 colaboradores ativos.")).toEqual([]);
    expect(opcoesOferecidas("")).toEqual([]);
  });
});
