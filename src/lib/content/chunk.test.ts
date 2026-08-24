import { describe, it, expect } from "vitest";
import { chunkArticle } from "./chunk-split";

/**
 * O chunker não tinha teste nenhum, e ele decide o que a busca consegue achar.
 *
 * O que se mede aqui é a regra que custou caro para descobrir: seção só com
 * título NÃO pode virar chunk. Trecho minúsculo compete na busca por semelhança
 * de letras e ganha de conteúdo de verdade — no acervo real, 300 dos 365 chunks
 * com menos de 40 caracteres eram exatamente isso, e um deles ("Campo de
 * Preenchimento", 22 caracteres) recuperava um documento inteiro para a
 * pergunta "preencha o campo".
 */
const h = (level: 1 | 2 | 3, texto: string) => ({
  id: `h${texto}`,
  type: "heading" as const,
  text: [{ text: texto }],
  data: { level },
  children: [],
  styles: {},
});
const p = (texto: string) => ({
  id: `p${texto}`,
  type: "paragraph" as const,
  text: [{ text: texto }],
  data: {},
  children: [],
  styles: {},
});

const doc = (blocks: unknown[]) => ({ type: "doc", version: 2, blocks });

describe("chunkArticle — seções sem corpo", () => {
  it("título seguido de outro título NÃO vira chunk sozinho", () => {
    const c = chunkArticle(doc([h(2, "Ativar Processos"), h(3, "Dados do Contrato"), p("Informe o número.")]));

    expect(c).toHaveLength(1);
    // O título órfão viaja para frente: nada se perde.
    expect(c[0]?.content).toContain("Ativar Processos");
    expect(c[0]?.content).toContain("Informe o número.");
  });

  it("o título órfão não fica só no heading_path — a trilha é filtrada por nível", () => {
    // "Seção Vazia" e "Outra Seção" são IRMÃS (mesmo nível): a segunda expulsa a
    // primeira da trilha. Se o texto não viajasse no conteúdo, sumiria.
    const c = chunkArticle(doc([h(2, "Seção Vazia"), h(2, "Outra Seção"), p("Conteúdo real.")]));

    expect(c).toHaveLength(1);
    expect(c[0]?.heading_path).toBe("Outra Seção");
    expect(c[0]?.content).toContain("Seção Vazia");
  });

  it("vários títulos vazios seguidos somam todos no próximo chunk", () => {
    const c = chunkArticle(doc([h(1, "A"), h(2, "B"), h(3, "C"), p("corpo")]));

    expect(c).toHaveLength(1);
    for (const t of ["A", "B", "C", "corpo"]) expect(c[0]?.content).toContain(t);
  });

  it("título no FIM sem corpo gruda no último chunk, não vira fragmento", () => {
    const c = chunkArticle(doc([h(2, "Introdução"), p("Texto da introdução."), h(2, "Anexos")]));

    expect(c).toHaveLength(1);
    expect(c[0]?.content).toContain("Texto da introdução.");
    expect(c[0]?.content).toContain("Anexos");
  });

  it("documento SÓ de títulos ainda produz um chunk — não pode sumir da busca", () => {
    // O risco da correção: zerar os chunks derruba o nó inteiro da busca.
    const c = chunkArticle(doc([h(1, "Manual"), h(2, "Capítulo 1"), h(2, "Capítulo 2")]));

    expect(c.length).toBeGreaterThanOrEqual(1);
    expect(c[0]?.content).toContain("Manual");
    expect(c[0]?.content).toContain("Capítulo 2");
  });
});

describe("chunkArticle — comportamento que não pode regredir", () => {
  it("seção com corpo continua trazendo o título junto do texto", () => {
    const c = chunkArticle(doc([h(2, "Emitir Nota"), p("Clique em Salvar.")]));

    expect(c).toHaveLength(1);
    expect(c[0]?.heading_path).toBe("Emitir Nota");
    expect(c[0]?.content).toBe("Emitir Nota\nClique em Salvar.");
  });

  it("cada seção com corpo vira seu próprio chunk", () => {
    const c = chunkArticle(doc([h(2, "Um"), p("texto um"), h(2, "Dois"), p("texto dois")]));

    expect(c).toHaveLength(2);
    expect(c[0]?.heading_path).toBe("Um");
    expect(c[1]?.heading_path).toBe("Dois");
  });

  it("heading_path acumula a trilha de níveis", () => {
    const c = chunkArticle(doc([h(1, "Manual"), p("intro"), h(2, "Cargos"), p("sobre cargos")]));

    expect(c[1]?.heading_path).toBe("Manual > Cargos");
  });

  it("parágrafo maior que o teto é fatiado por tamanho", () => {
    const gigante = "palavra ".repeat(600); // ~4800 chars, teto é 2000
    const c = chunkArticle(doc([h(2, "Longo"), p(gigante)]));

    expect(c.length).toBeGreaterThan(1);
    for (const ch of c) expect(ch.content.length).toBeLessThanOrEqual(2100);
  });

  it("documento vazio não produz chunk", () => {
    expect(chunkArticle(doc([]))).toEqual([]);
  });
});
