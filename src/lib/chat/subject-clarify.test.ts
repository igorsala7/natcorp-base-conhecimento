import { describe, it, expect } from "vitest";
import { pareceAnaforico, referenciaVaga, deveClassificarSujeito, montarOpcoesSujeito, diretrizReferente } from "./subject-clarify";

describe("pareceAnaforico", () => {
  it("pega mensagens SEM sujeito (anáfora)", () => {
    expect(pareceAnaforico("qual o salário dele?")).toBe(true);
    expect(pareceAnaforico("e a matrícula?")).toBe(true);
    expect(pareceAnaforico("detalha esses")).toBe(true);
    expect(pareceAnaforico("mostra o primeiro")).toBe(true);
    expect(pareceAnaforico("quanto ela ganha")).toBe(true);
  });
  it("NÃO pega mensagens com sujeito explícito", () => {
    expect(pareceAnaforico("qual o salário do João?")).toBe(false);
    expect(pareceAnaforico("colaboradores do cargo supervisor")).toBe(false);
    expect(pareceAnaforico("quantos colaboradores tem a empresa 700?")).toBe(false);
  });
});

describe("deveClassificarSujeito", () => {
  const anaf = "qual o salário dele?";
  it("roda quando parece anáfora E há relatório na tela", () => {
    expect(deveClassificarSujeito(anaf, [], true)).toBe(true);
  });
  it("roda quando há turno anterior do assistente substancial (possível lista)", () => {
    const msgs = [{ role: "assistant", content: "x".repeat(200) }];
    expect(deveClassificarSujeito(anaf, msgs, false)).toBe(true);
  });
  it("NÃO roda sem contexto (sem relatório e sem histórico relevante)", () => {
    expect(deveClassificarSujeito(anaf, [], false)).toBe(false);
    expect(deveClassificarSujeito(anaf, [{ role: "assistant", content: "ok" }], false)).toBe(false);
  });
  it("NÃO roda quando a mensagem não é anafórica (mesmo com contexto)", () => {
    expect(deveClassificarSujeito("qual o salário do João?", [], true)).toBe(false);
  });
});

describe("montarOpcoesSujeito", () => {
  it("agrupa quando há muitos candidatos + inclui relatório e geral", () => {
    const dec = { ambiguo: true, candidatos: ["Ana", "Bia", "Cid", "Dan", "Eva"], refereRelatorio: true };
    const ops = montarOpcoesSujeito(dec, true);
    expect(ops.map((o) => o.id)).toEqual(["listados", "relatorio", "geral"]);
    expect(String(ops[0]!.label)).toContain("Os 5 listados");
  });
  it("sem relatório → só listados + geral", () => {
    const ops = montarOpcoesSujeito({ ambiguo: true, candidatos: ["Ana"], refereRelatorio: false }, false);
    expect(ops.map((o) => o.id)).toEqual(["listados", "geral"]);
    expect(String(ops[0]!.label)).toBe("👥 Ana");
  });
});

describe("diretrizReferente", () => {
  it("listados/geral geram diretriz; vazio p/ o resto", () => {
    expect(diretrizReferente("listados")).toContain("LISTADOS");
    expect(diretrizReferente("geral")).toContain("GERAL");
    expect(diretrizReferente("relatorio")).toBe("");
    expect(diretrizReferente(undefined)).toBe("");
  });
});

describe("troca de tela reabre a ambiguidade", () => {
  const hist = [{ role: "assistant", content: "x".repeat(300) }];

  it("O CASO RELATADO: conversa sobre um colaborador, troca para tela com relatório, 'avalie os dados'", () => {
    // Sem a troca de tela, "os dados" não é ambíguo — são os da tela em que a
    // pessoa está. Com a troca, passa a haver dois candidatos: a tela nova e o
    // assunto em curso. Era este o caso em que o chat avaliou o colaborador.
    expect(deveClassificarSujeito("avalie os dados", hist, true, { mudouTela: false })).toBe(false);
    expect(deveClassificarSujeito("avalie os dados", hist, true, { mudouTela: true })).toBe(true);
  });

  it("pega descrição definida, que não é anáfora e por isso escapava", () => {
    // Nenhuma destas tem pronome nem demonstrativo — `pareceAnaforico` diz não
    // para todas, e é por isso que o esclarecimento nunca rodava.
    for (const f of ["analise os dados", "analisa a tabela", "resume o relatório", "verifica os registros", "compara os números"]) {
      expect(pareceAnaforico(f)).toBe(false);
      expect(referenciaVaga(f)).toBe(true);
    }
  });

  it("pedido de análise SEM objeto é o mais ambíguo de todos", () => {
    expect(referenciaVaga("faz uma análise")).toBe(true);
    expect(referenciaVaga("avalia aí")).toBe(true);
  });

  it("frase longa e específica não é vaga, mesmo com verbo de análise", () => {
    // "Analise o custo de horas extras da filial 3 em julho" nomeia o próprio
    // objeto — perguntar aí seria burocracia.
    expect(referenciaVaga("analise o custo de horas extras da filial 3 em julho")).toBe(false);
  });

  it("só AMPLIA: o que já disparava continua disparando, com ou sem troca", () => {
    expect(deveClassificarSujeito("qual o salário dele", hist, true, { mudouTela: false })).toBe(true);
    expect(deveClassificarSujeito("qual o salário dele", hist, true)).toBe(true);
  });

  it("sem contexto para referir, continua sem perguntar", () => {
    // A regra de ouro do módulo: nenhum candidato → não pergunta.
    expect(deveClassificarSujeito("avalie os dados", [], false, { mudouTela: true })).toBe(false);
  });
});

describe("acento não pode desligar a detecção", () => {
  it("'análise' com acento casa igual a 'analise' sem", () => {
    // A regex é escrita sem acento e o texto é dobrado antes. Escrever
    // `an[áa]lis` palavra por palavra é onde se esquece uma.
    expect(referenciaVaga("faz uma análise")).toBe(true);
    expect(referenciaVaga("faz uma analise")).toBe(true);
    expect(referenciaVaga("avalie as informações")).toBe(true);
    expect(referenciaVaga("resume o relatório")).toBe(true);
    expect(referenciaVaga("compara os números")).toBe(true);
  });
});
