import { describe, it, expect } from "vitest";
import { ehExpansaoDe, aliasSemLastro, soAlfanum, palavras } from "./ontology-reparo";

describe("é expansão do mesmo conceito?", () => {
  it("OS CASOS DO ENSAIO que estavam certos", () => {
    expect(ehExpansaoDe("Cadastro de Agências", "Cadastro de Agências Bancárias")).toBe(true);
    expect(ehExpansaoDe("Condição", "Condição para Valor Padrão")).toBe(true);
    expect(ehExpansaoDe("Adto salarial", "Adiantamento Salarial")).toBe(false); // abreviação ≠ palavra
  });

  it("O CASO QUE A PRIMEIRA VERSÃO IA FUNDIR ERRADO", () => {
    // Compartilham "plr" e nada mais. Desconto não é adiantamento — fundir os
    // dois teria apagado um conceito de folha de pagamento.
    expect(ehExpansaoDe("Desconto PLR Folha", "Adiantamento de PLR")).toBe(false);
  });

  it("palavras de ligação não decidem nada", () => {
    expect(ehExpansaoDe("Centro de Custo", "Centro Custo")).toBe(true);
    expect(palavras("Cadastro de Agências Bancárias")).toEqual(["cadastro", "agencias", "bancarias"]);
  });

  it("acento e caixa não separam o que é igual", () => {
    expect(ehExpansaoDe("Admissão", "ADMISSAO")).toBe(true);
  });

  it("vazio nunca é expansão de nada", () => {
    for (const v of ["", "  ", "de da do"]) {
      expect(ehExpansaoDe(v, "Qualquer Coisa")).toBe(false);
      expect(ehExpansaoDe("Qualquer Coisa", v)).toBe(false);
    }
  });
});

describe("o sinônimo de coluna está no termo errado?", () => {
  const base = { termo: "Médias HS", sinonimosDoTermo: [] as string[] };

  it("SIM quando o dicionário liga a coluna a outro conceito", () => {
    expect(
      aliasSemLastro({ ...base, alias: "INCID_MEDIA_13", rotulosDaColuna: ["Incidência média 13º"] }),
    ).toBe(true);
  });

  it("NÃO quando a coluna nem existe — sigla proposta pela IA não é contaminação", () => {
    // `CCH` para "Centro de Custo Hierárquico": não é coluna nenhuma, é uma
    // abreviação boa. A primeira versão apagava.
    expect(
      aliasSemLastro({ termo: "Centro de Custo Hierárquico", sinonimosDoTermo: [], alias: "CCH", rotulosDaColuna: [] }),
    ).toBe(false);
  });

  it("NÃO quando o alias é o próprio termo sem pontuação", () => {
    // `CID` É coluna, mas também é "C.I.D." escrito de outro jeito.
    expect(
      aliasSemLastro({ termo: "C.I.D.", sinonimosDoTermo: [], alias: "CID", rotulosDaColuna: ["Classificação de doença"] }),
    ).toBe(false);
  });

  it("NÃO quando o rótulo bate com o TERMO", () => {
    expect(
      aliasSemLastro({ termo: "Isenção INSS", sinonimosDoTermo: [], alias: "ISENCAO_INSS_FUNC", rotulosDaColuna: ["Isenção INSS"] }),
    ).toBe(false);
  });

  it("NÃO quando o rótulo bate com um SINÔNIMO — o caso da expansão", () => {
    // Depois de a IA expandir, o termo é "Adiantamento Salarial" e o rótulo do
    // dicionário continua "Adto salarial". Sem olhar os sinônimos, o reparo
    // apagaria justamente o vínculo que o conserto criou.
    expect(
      aliasSemLastro({
        termo: "Adiantamento Salarial",
        sinonimosDoTermo: ["Adto salarial", "adiantamento"],
        alias: "ADTO_SALARIAL",
        rotulosDaColuna: ["Adto salarial"],
      }),
    ).toBe(false);
  });

  it("SIM para identificador de banco que a IA INVENTOU", () => {
    // `PE_FOLGAS` não existe como coluna. Não é sigla de negócio (leva
    // underscore) — é nome técnico FALSO no vocabulário, e o chat pode
    // repeti-lo como se fosse campo real. Pior que sinônimo ruim.
    expect(
      aliasSemLastro({ termo: "Escala de Folgas", sinonimosDoTermo: [], alias: "PE_FOLGAS", rotulosDaColuna: [] }),
    ).toBe(true);
  });

  it("o underscore é o que separa sigla de identificador", () => {
    const semDic = { sinonimosDoTermo: [] as string[], rotulosDaColuna: [] as string[] };
    expect(aliasSemLastro({ ...semDic, termo: "Fundo de Garantia", alias: "FGTS" })).toBe(false);
    expect(aliasSemLastro({ ...semDic, termo: "Fundo de Garantia", alias: "FGTS_SALDO" })).toBe(true);
  });

  it("soAlfanum junta o que só difere em pontuação e acento", () => {
    expect(soAlfanum("C.I.D.")).toBe(soAlfanum("CID"));
    expect(soAlfanum("Admissão")).toBe("admissao");
  });
});
