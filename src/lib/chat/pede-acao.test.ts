import { describe, it, expect } from "vitest";
import { pedeAcaoNaTela, nucleoDoRotulo, type ScreenField } from "./form-fields";

/**
 * Regressão do caso que o gabarito pegou em 21/08/2026: "Informe a empresa 700
 * e matrícula 205818" na tela de requisição não era reconhecido como pedido de
 * ação, então `preencher_campo` era cortada e o agente respondia que não sabe
 * preencher campos.
 *
 * As frases NEGATIVAS aqui valem tanto quanto as positivas: elas vêm do tráfego
 * real, e alargar o regex de "inform*" faria o detector disparar em quase todas.
 *
 * ── OS RÓTULOS SÃO OS REAIS, E ISSO É O PONTO ───────────────────────────────
 * A primeira versão deste arquivo usava rótulos idealizados — "Empresa",
 * "Matrícula" — e passava enquanto a produção falhava. O APEX não emite
 * "Empresa": emite "Empresa (Valor Necessário)", e como a regra casa
 * `mensagem.includes(rótulo)`, nenhum dos 17 rótulos daquela tela era substring
 * da mensagem. O teste dava confiança sem dar garantia.
 *
 * Os `CAMPOS` abaixo são cópia literal do passo `relatorio_vazio` do trace de
 * 2026-08-17T21:30:29Z — o turno que motivou a regra. Se um dia precisar
 * acrescentar campo, copie de um trace, não invente: rótulo inventado foi
 * exatamente o que escondeu o defeito por um dia inteiro.
 */
const CAMPOS: ScreenField[] = [
  { ref: "1", label: "Empresa (Valor Necessário)", type: "lista", value: "" },
  { ref: "2", label: "Filial", type: "lista", value: "" },
  { ref: "3", label: "Centro de Custo (Célula)", type: "lista", value: "" },
  { ref: "4", label: "Matrícula (Valor Necessário)", type: "lista", value: "" },
  { ref: "5", label: "Situação (Valor Necessário)", type: "lista", value: "" },
  { ref: "6", label: "Justificativa (Valor Necessário)", type: "texto longo", value: "" },
  { ref: "7", label: "Pesquisar", type: "botao", value: "" },
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

  it("o sufixo do APEX não pode esconder o campo", () => {
    // O defeito exato: com o rótulo inteiro, "Empresa (Valor Necessário)" nunca
    // é substring de mensagem nenhuma. É preciso comparar pelo NÚCLEO.
    expect(nucleoDoRotulo("Empresa (Valor Necessário)")).toBe("Empresa");
    expect(nucleoDoRotulo("Centro de Custo (Célula)")).toBe("Centro de Custo");
    expect(nucleoDoRotulo("Data de Comunicação (Aviso) (Valor Necessário)")).toBe("Data de Comunicação");
    expect(nucleoDoRotulo("Haverá Reposição?")).toBe("Haverá Reposição");
    expect(nucleoDoRotulo("Observação")).toBe("Observação");
  });

  it("o núcleo não pode encurtar rótulo a ponto de casar por acidente", () => {
    // "(Valor Necessário)" some, mas o piso de 4 caracteres continua valendo.
    const curto: ScreenField[] = [{ ref: "1", label: "UF (Valor Necessário)", type: "texto", value: "" }];
    expect(pedeAcaoNaTela("informe o uf do colaborador", curto)).toBe(false);
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
