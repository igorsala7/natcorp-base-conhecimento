import { describe, it, expect } from "vitest";
import {
  heuristicTree,
  numberingLevel,
  tituloLimpo,
  precisaAgruparComIa,
  contarNos,
  profundidade,
} from "./tree";
import type { ProposedNode } from "./tree";
import type { Extraction, ExtractedBlock } from "./extract";

const doc = (blocks: ExtractedBlock[], images: Extraction["images"] = []): Extraction => ({
  source: "html",
  blocks,
  images,
});
const t = (text: string, level = 0, extra: Partial<ExtractedBlock> = {}): ExtractedBlock => ({
  text,
  level,
  ...extra,
});

describe("numberingLevel", () => {
  it("aceita numeração com separador", () => {
    expect(numberingLevel("1. Configuração")).toBe(1);
    expect(numberingLevel("4) Relatórios")).toBe(1);
  });

  it("aceita numeração de vários níveis mesmo sem ponto final", () => {
    expect(numberingLevel("1.2 Faturamento")).toBe(2);
    expect(numberingLevel("1.2.3 Emitir NF")).toBe(3);
    expect(numberingLevel("1.2.3.4 Detalhe")).toBe(3); // teto de 3
  });

  // O caso real: célula de tabela com prazo virava a pasta "dia" na árvore.
  it("número solto sem separador NÃO é título", () => {
    expect(numberingLevel("1 dia")).toBeNull();
    expect(numberingLevel("30 dias úteis")).toBeNull();
    expect(numberingLevel("2024 foi o ano de maior volume")).toBeNull();
  });

  it("parágrafo longo não é título, mesmo numerado", () => {
    expect(numberingLevel(`1. ${"palavra ".repeat(30)}`)).toBeNull();
  });
});

describe("precisaAgruparComIa", () => {
  const no = (title: string, children: ProposedNode[] = []): ProposedNode => ({
    title,
    content: [],
    children,
  });
  const planos = (n: number) => Array.from({ length: n }, (_, i) => no(`Seção ${i}`));

  it("mede tamanho e profundidade", () => {
    const arvore = [no("A", [no("B", [no("C")])]), no("D")];
    expect(contarNos(arvore)).toBe(4);
    expect(profundidade(arvore)).toBe(3);
    expect(profundidade([])).toBe(0);
  });

  // O caso que motivou o portão: o manual de Chamado Interno já vem com 35
  // seções em 4 níveis, e toda reorganização da IA piorou a árvore.
  it("dispensa a IA quando o documento já traz hierarquia", () => {
    expect(precisaAgruparComIa([no("Capítulo", planos(20))])).toBe(false);
  });

  it("chama a IA quando a árvore é plana e grande (o PDF sem aninhamento)", () => {
    expect(precisaAgruparComIa(planos(20))).toBe(true);
  });

  it("não chama por causa de meia dúzia de seções — não há o que agrupar", () => {
    expect(precisaAgruparComIa(planos(3))).toBe(false);
    expect(precisaAgruparComIa([])).toBe(false);
  });
});

describe("tituloLimpo", () => {
  it("aceita limpeza: numeração, capitalização e sobra da extração", () => {
    expect(tituloLimpo("1.2 Faturamento", "Faturamento")).toBe("Faturamento");
    expect(tituloLimpo("EMITIR NOTA FISCAL", "Emitir nota fiscal")).toBe("Emitir nota fiscal");
    expect(tituloLimpo("Área  de   atendimento", "Área de atendimento")).toBe("Área de atendimento");
  });

  it("recusa título que inventa palavra — o gpt-4o grudava o trecho no rótulo", () => {
    expect(tituloLimpo("Fases de análise", "Fases de análise Surgem Muitas Vezes ao se Trabalhar")).toBe(
      "Fases de análise",
    );
    expect(tituloLimpo("Área de atendimento", "Área de atendimento (Cadastro) — Passo a Passo")).toBe(
      "Área de atendimento",
    );
  });

  it("sem sugestão, fica o original", () => {
    expect(tituloLimpo("Cadastros", null)).toBe("Cadastros");
    expect(tituloLimpo("Cadastros", "   ")).toBe("Cadastros");
  });

  it("acento e caixa não contam como palavra nova", () => {
    expect(tituloLimpo("relatorios GERENCIAIS", "Relatórios gerenciais")).toBe("Relatórios gerenciais");
  });
});

describe("heuristicTree", () => {
  it("usa os títulos da origem e ignora a numeração quando ela existe", () => {
    // Réplica do manual importado: sumário numerado + capítulos reais em h2/h3.
    const tree = heuristicTree(
      doc([
        t("Sumário", 2),
        t("1. Configuração"),
        t("2. Colaborador"),
        t("3. Operador"),
        t("Cadastros", 2),
        t("Área de atendimento", 3),
      ]),
    );
    // Os itens do sumário continuam sendo corpo dele, não seções irmãs.
    expect(tree.map((n) => n.title)).toEqual(["Sumário", "Cadastros"]);
    expect(tree[0]!.content.map((c) => (c.type === "p" ? c.text : "img"))).toEqual([
      "1. Configuração",
      "2. Colaborador",
      "3. Operador",
    ]);
    expect(tree[1]!.children.map((n) => n.title)).toEqual(["Área de atendimento"]);
  });

  it("sem títulos na origem, a numeração volta a valer", () => {
    const tree = heuristicTree(doc([t("1. Cadastro"), t("corpo"), t("2. Relatórios")]));
    expect(tree.map((n) => n.title)).toEqual(["Cadastro", "Relatórios"]);
  });

  it("item de lista numerado nunca vira seção", () => {
    const tree = heuristicTree(
      doc([t("1. Clique em Salvar", 0, { listItem: true }), t("2. Confirme", 0, { listItem: true })]),
    );
    expect(tree).toHaveLength(1);
    expect(tree[0]!.title).toBe("Documento importado");
    expect(tree[0]!.content).toHaveLength(2);
  });

  it("mantém a numeração no título quando ela veio do próprio documento", () => {
    const tree = heuristicTree(doc([t("A", 2), t("B", 2), t("1 · Área de atendimento", 3)]));
    expect(tree[1]!.children[0]!.title).toBe("1 · Área de atendimento");
  });

  it("posiciona cada imagem depois do bloco a que pertence", () => {
    const img = (afterBlock: number) => ({
      name: "i",
      contentBase64: "x",
      mime: "image/png",
      afterBlock,
    });
    const tree = heuristicTree(
      doc([t("Seção", 2), t("texto"), t("Outra", 2), t("mais")], [img(1), img(3)]),
    );
    expect(tree[0]!.content).toEqual([
      { type: "p", text: "texto" },
      { type: "img", image: 0 },
    ]);
    expect(tree[1]!.content).toEqual([
      { type: "p", text: "mais" },
      { type: "img", image: 1 },
    ]);
  });
});
