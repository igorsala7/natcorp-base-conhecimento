import { describe, it, expect } from "vitest";
import { pedeAcaoNaTela, type ScreenField } from "./form-fields";

/**
 * Regressão do caso que o gabarito pegou em 21/08/2026: "Informe a empresa 700
 * e matrícula 205818" na tela de requisição não era reconhecido como pedido de
 * ação, então `preencher_campo` era cortada e o agente respondia que não sabe
 * preencher campos.
 *
 * As frases NEGATIVAS aqui valem tanto quanto as positivas: elas vêm do tráfego
 * real, e alargar o regex de "inform*" faria o detector disparar em quase todas.
 */
const CAMPOS: ScreenField[] = [
  { ref: "1", label: "Empresa", type: "texto", value: "" },
  { ref: "2", label: "Matrícula", type: "texto", value: "" },
  { ref: "3", label: "Situação", type: "select", value: "" },
  { ref: "4", label: "Pesquisar", type: "botao", value: "" },
];

describe("pedeAcaoNaTela", () => {
  it("verbo direto dispensa a tela", () => {
    for (const q of ["preencha esse campo", "marque a opção", "clique no botão", "aperte salvar"]) {
      expect(pedeAcaoNaTela(q, [])).toBe(true);
    }
  });

  it("o caso que motivou: 'Informe' + rótulo de campo editável", () => {
    expect(pedeAcaoNaTela("Informe a empresa 700 e matrícula 205818", CAMPOS)).toBe(true);
  });

  it("'informe' SEM citar campo da tela é consulta, não ação", () => {
    // Frases reais do tráfego. Um `inform\w*` cru acusaria todas.
    expect(pedeAcaoNaTela("me informe os dados do Tony", CAMPOS)).toBe(false);
    expect(pedeAcaoNaTela("informe quantidade de desligados em todas as empresas", [])).toBe(false);
  });

  it("NÃO casa dentro de 'informações' — a armadilha do \\b ASCII em JS", () => {
    // `\binforma\b` casaria aqui, porque "ç" não é caractere de palavra ASCII.
    expect(pedeAcaoNaTela("Faça a análise dessas informações do relatório", CAMPOS)).toBe(false);
    expect(pedeAcaoNaTela("Crie um gráfico com essas informações", CAMPOS)).toBe(false);
    expect(pedeAcaoNaTela("Eu quero todas as informações do histórico financeiro", CAMPOS)).toBe(false);
  });

  it("rótulo de BOTÃO não conta — botão não se preenche", () => {
    expect(pedeAcaoNaTela("informe o que o pesquisar faz", CAMPOS)).toBe(false);
  });

  it("rótulo curto demais não conta — casaria por acidente", () => {
    const curtos: ScreenField[] = [{ ref: "1", label: "UF", type: "texto", value: "" }];
    expect(pedeAcaoNaTela("informe o uf", curtos)).toBe(false);
  });

  it("sem campos na tela, 'informe' nunca vira ação", () => {
    expect(pedeAcaoNaTela("Informe a empresa 700 e matrícula 205818", [])).toBe(false);
  });

  it("vazio é falso", () => {
    expect(pedeAcaoNaTela("", CAMPOS)).toBe(false);
    expect(pedeAcaoNaTela("   ", CAMPOS)).toBe(false);
  });
});
