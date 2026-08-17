import { describe, it, expect } from "vitest";
import { normalizeReport } from "./report-spec";

describe("normalizeReport", () => {
  it("aceita blocos de texto, tabela e gráfico e preserva a ordem", () => {
    const r = normalizeReport({
      titulo: "Relatório de Folha",
      subtitulo: "2026",
      blocos: [
        { tipo: "texto", texto: "Resumo do período." },
        { tipo: "tabela", tabela: { colunas: ["Mês", "Líquido"], linhas: [["Jan", "4100"], ["Fev", "4100"]] } },
        { tipo: "grafico", grafico: { tipo: "colunas", titulo: "Líquido", categorias: ["Jan", "Fev"], series: [{ nome: "L", valores: [4100, 4100] }] } },
      ],
    });
    expect(r).not.toBeNull();
    expect(r!.blocos.map((b) => b.tipo)).toEqual(["texto", "tabela", "grafico"]);
  });

  it("coage células da tabela a texto e corta ao nº de colunas", () => {
    const r = normalizeReport({
      titulo: "T",
      blocos: [{ tipo: "tabela", tabela: { colunas: ["A", "B"], linhas: [[1, 2, 3]] } }],
    });
    const tab = r!.blocos[0] as { tipo: "tabela"; colunas: string[]; linhas: string[][] };
    expect(tab.linhas[0]).toEqual(["1", "2"]); // 3ª célula cortada
  });

  it("ignora blocos inválidos e retorna null se não sobrar nenhum", () => {
    expect(
      normalizeReport({ titulo: "X", blocos: [{ tipo: "texto" }, { tipo: "tabela", tabela: { colunas: [] } }] }),
    ).toBeNull();
    expect(normalizeReport({ titulo: "X", blocos: [] })).toBeNull();
    expect(normalizeReport("nao objeto")).toBeNull();
  });

  it("usa 'Relatório' quando falta título", () => {
    const r = normalizeReport({ blocos: [{ tipo: "texto", texto: "oi" }] });
    expect(r!.titulo).toBe("Relatório");
  });
});

describe("vocabulário de layout", () => {
  const bloco = (b: unknown) => normalizeReport({ titulo: "T", formato: "pptx", blocos: [b] })?.blocos ?? [];

  it("seção sem título é descartada — divisor vazio é página em branco", () => {
    expect(bloco({ tipo: "secao", titulo: "Panorama" })).toEqual([{ tipo: "secao", titulo: "Panorama" }]);
    expect(bloco({ tipo: "secao", titulo: "   " })).toEqual([]);
    expect(bloco({ tipo: "secao" })).toEqual([]);
  });

  it("destaques exige DOIS itens — destaque só existe em contraste", () => {
    const um = bloco({ tipo: "destaques", itens: [{ valor: "10", rotulo: "X" }] });
    expect(um).toEqual([]);
    const dois = bloco({ tipo: "destaques", itens: [{ valor: "10", rotulo: "X" }, { valor: "20", rotulo: "Y" }] });
    expect(dois).toHaveLength(1);
  });

  it("corta no quarto item em vez de recusar o bloco", () => {
    // Cinco números lado a lado deixam de ser destaque e viram tabela ruim.
    // Perder o quinto é melhor que perder os quatro.
    const b = bloco({ tipo: "destaques", itens: Array.from({ length: 6 }, (_, i) => ({ valor: String(i), rotulo: "R" + i })) })[0];
    expect(b && "itens" in b ? b.itens : []).toHaveLength(4);
  });

  it("item sem valor OU sem rótulo não entra", () => {
    const b = bloco({
      tipo: "destaques",
      itens: [{ valor: "10", rotulo: "Bom" }, { valor: "", rotulo: "Sem valor" }, { valor: "20", rotulo: "" }, { valor: "30", rotulo: "Também bom" }],
    })[0];
    // `itens` é união (destaques × cards); o narrow explícito mantém o teste tipado.
    const itens = b?.tipo === "destaques" ? b.itens : [];
    expect(itens.map((i) => i.rotulo)).toEqual(["Bom", "Também bom"]);
  });

  it("cards seguem a mesma regra de dois a quatro", () => {
    expect(bloco({ tipo: "cards", itens: [{ titulo: "A", texto: "a" }] })).toEqual([]);
    const b = bloco({ tipo: "cards", itens: [{ titulo: "A", texto: "a" }, { titulo: "B", texto: "b" }] })[0];
    expect(b && "itens" in b ? b.itens : []).toHaveLength(2);
  });

  it("a NOTA vale para qualquer bloco", () => {
    // É ela que carrega a narrativa sem custar uma segunda passada de IA:
    // notas do apresentador no PPTX, linha em itálico no PDF e no Word.
    for (const b of [
      { tipo: "texto", texto: "oi", nota: "N" },
      { tipo: "secao", titulo: "S", nota: "N" },
      { tipo: "tabela", colunas: ["a"], linhas: [["1"]], nota: "N" },
      { tipo: "destaques", itens: [{ valor: "1", rotulo: "a" }, { valor: "2", rotulo: "b" }], nota: "N" },
    ]) {
      const r = bloco(b)[0]!;
      expect("nota" in r ? r.nota : null).toBe("N");
    }
  });

  it("nota vazia não vira campo", () => {
    const r = bloco({ tipo: "texto", texto: "oi", nota: "   " })[0]!;
    expect("nota" in r).toBe(false);
  });

  it("texto ganhou título próprio — antes todo slide repetia o do relatório", () => {
    const r = bloco({ tipo: "texto", titulo: "Leitura", texto: "oi" })[0]!;
    expect(r).toMatchObject({ tipo: "texto", titulo: "Leitura" });
  });

  it("a ordem dos blocos novos é preservada junto com os antigos", () => {
    const r = normalizeReport({
      titulo: "T", formato: "pdf",
      blocos: [
        { tipo: "secao", titulo: "S" },
        { tipo: "destaques", itens: [{ valor: "1", rotulo: "a" }, { valor: "2", rotulo: "b" }] },
        { tipo: "texto", texto: "t" },
        { tipo: "cards", itens: [{ titulo: "A", texto: "a" }, { titulo: "B", texto: "b" }] },
      ],
    });
    expect(r?.blocos.map((b) => b.tipo)).toEqual(["secao", "destaques", "texto", "cards"]);
  });
});
