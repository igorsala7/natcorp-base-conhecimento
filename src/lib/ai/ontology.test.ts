import { describe, it, expect } from "vitest";
import {
  normalizarTermo,
  contemTermo,
  expandirComOntologia,
  formasCasadas,
  enriquecerParaVetor,
  type EntradaOntologia,
} from "./ontology";

describe("ontologia — normalização", () => {
  it("tira acento, caixa e espaços extras", () => {
    expect(normalizarTermo("  Nota  Fiscal ")).toBe("nota fiscal");
    expect(normalizarTermo("Configuração")).toBe("configuracao");
    expect(normalizarTermo("NF-e")).toBe("nf-e");
  });
});

describe("ontologia — casamento por palavra inteira", () => {
  it("casa a palavra inteira", () => {
    expect(contemTermo("emitir nota fiscal", "nota")).toBe(true);
    expect(contemTermo("emitir nf-e agora", "nf-e")).toBe(true);
  });
  it("não casa pedaço dentro de outra palavra", () => {
    // "nf" existe dentro de "confirmar", mas não é palavra.
    expect(contemTermo("confirmar cadastro", "nf")).toBe(false);
  });
  it("ignora termo curto demais", () => {
    expect(contemTermo("a b c", "a")).toBe(false);
  });
});

describe("expandirComOntologia", () => {
  const onto: EntradaOntologia[] = [
    { matchNorms: ["nota fiscal", "nf", "nf-e"], forms: ["Nota Fiscal", "NF", "NF-e"] },
    { matchNorms: ["chamado", "ticket"], forms: ["Chamado", "ticket"] },
  ];

  it("expande com todas as formas quando um sinônimo casa", () => {
    const out = expandirComOntologia("como emitir NF?", onto);
    expect(out.startsWith("como emitir NF?")).toBe(true);
    expect(out).toContain('"Nota Fiscal"');
    expect(out).toContain('"NF-e"');
    expect(out).toContain(" or ");
  });

  it("preserva a pergunta original (não normaliza a saída)", () => {
    const out = expandirComOntologia("Abrir Chamado", onto);
    expect(out.startsWith("Abrir Chamado")).toBe(true);
    expect(out).toContain('"ticket"');
  });

  it("não expande quando nada casa", () => {
    expect(expandirComOntologia("qualquer coisa aleatória", onto)).toBe("qualquer coisa aleatória");
  });

  it("devolve a pergunta com ontologia vazia", () => {
    expect(expandirComOntologia("nf", [])).toBe("nf");
  });
});

describe("enriquecerParaVetor (expansão do embedding pela ontologia)", () => {
  const onto: EntradaOntologia[] = [
    {
      matchNorms: ["requisicao de ferias", "solicitacao de ferias", "pedido de ferias"],
      forms: ["Requisição de Férias", "Solicitação de Férias", "Pedido de Férias"],
    },
  ];

  it("acrescenta as formas casadas à pergunta (uma por linha, pergunta primeiro)", () => {
    const out = enriquecerParaVetor("Como abrir uma Requisição de Férias?", onto);
    expect(out.startsWith("Como abrir uma Requisição de Férias?\n")).toBe(true);
    expect(out).toContain("Solicitação de Férias");
    expect(out).toContain("Pedido de Férias");
  });

  it("sem casamento, devolve a pergunta crua (sem diluir o embedding)", () => {
    expect(enriquecerParaVetor("assunto qualquer", onto)).toBe("assunto qualquer");
  });

  it("formasCasadas devolve termo + sinônimos do conceito casado", () => {
    expect(formasCasadas("preciso de férias, faço a Solicitação de Férias", onto)).toEqual([
      "Requisição de Férias",
      "Solicitação de Férias",
      "Pedido de Férias",
    ]);
  });
});

describe("formasCasadas — a ordem É o corte", () => {
  // Todos os consumidores cortam (12 na léxica, 6 no vetor, 12 no boost).
  // O que sobrevive ao corte depende inteiramente desta ordem.

  it("conceito verboso não come as vagas dos outros (rodízio)", () => {
    // O defeito real: achatado conceito a conceito, "Férias" com 8 sinônimos
    // ocupava as 6 primeiras posições e "Banco de Horas" — casado na mesma
    // pergunta — não entrava nenhuma vez no vetor.
    const onto: EntradaOntologia[] = [
      {
        matchNorms: ["ferias"],
        forms: ["Férias", "descanso", "recesso", "folga", "afastamento", "gozo", "período aquisitivo", "abono"],
      },
      { matchNorms: ["banco de horas"], forms: ["Banco de Horas", "BH", "compensação"] },
    ];
    const formas = formasCasadas("saldo de banco de horas e ferias", onto);

    // "Banco de Horas" casou por um gatilho mais longo → abre a lista.
    expect(formas[0]).toBe("Banco de Horas");
    expect(formas[1]).toBe("Férias");
    // E o corte de 6 do vetor leva os DOIS conceitos, não um só.
    expect(formas.slice(0, 6)).toContain("Banco de Horas");
    expect(formas.slice(0, 6)).toContain("Férias");
    // O 8º sinônimo de férias só aparece depois que o outro conceito se serviu.
    expect(formas.indexOf("abono")).toBeGreaterThan(formas.indexOf("compensação"));
  });

  it("o gatilho mais específico decide quem vem primeiro", () => {
    const onto: EntradaOntologia[] = [
      { matchNorms: ["horas"], forms: ["Horas Trabalhadas"] },
      { matchNorms: ["banco de horas"], forms: ["Banco de Horas"] },
    ];
    // Casar "banco de horas" é mais específico que casar "horas".
    expect(formasCasadas("meu banco de horas", onto)[0]).toBe("Banco de Horas");
  });

  it("é estável: a mesma pergunta dá a mesma ordem, venha o banco como vier", () => {
    // Vetor de busca que muda sozinho entre execuções é bug irreproduzível.
    const a: EntradaOntologia[] = [
      { matchNorms: ["ferias"], forms: ["Férias"] },
      { matchNorms: ["folga"], forms: ["Folga"] },
    ];
    const b: EntradaOntologia[] = [...a].reverse();
    expect(formasCasadas("ferias e folga", a)).toEqual(formasCasadas("ferias e folga", b));
  });

  it("não inventa nem duplica quando nada casa", () => {
    expect(formasCasadas("qualquer coisa", [])).toEqual([]);
    const onto: EntradaOntologia[] = [{ matchNorms: ["ferias"], forms: ["Férias", "Férias", " "] }];
    expect(formasCasadas("ferias", onto)).toEqual(["Férias"]);
  });
});
