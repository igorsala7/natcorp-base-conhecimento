import { describe, it, expect } from "vitest";

/**
 * O prompt é o comportamento aqui — não há função pura para testar sem chamar a
 * IA. Estes testes travam o CONTRATO do texto: se alguém reintroduzir a frase que
 * bloqueava a expansão, quebra.
 *
 * Vale porque o defeito foi exatamente esse: a instrução anti-alucinação e a
 * instrução de expandir são a mesma frase mal escrita, e a regressão é invisível
 * (a IA obedece em silêncio e os termos saem abreviados).
 */
async function promptDeSinonimos(): Promise<string> {
  const src = await import("node:fs/promises");
  return src.readFile("src/lib/ai/ontology-scan.ts", "utf-8");
}

describe("o prompt de sinônimos do dicionário", () => {
  it("MANDA expandir abreviação — era o que faltava", async () => {
    const s = await promptDeSinonimos();
    expect(s).toContain("por EXTENSO");
    expect(s).toMatch(/Adto salarial.*Adiantamento Salarial/);
  });

  it("continua proibindo INVENTAR conceito fora da lista", async () => {
    // O conserto não pode virar licença para alucinar: as duas regras convivem,
    // e a segunda frase é o que as separa.
    const s = await promptDeSinonimos();
    expect(s).toContain("PROIBIDO inventar um conceito que não esteja na lista");
    expect(s).toContain("Expandir a abreviação");
  });

  it("exige a forma ABREVIADA de volta como sinônimo", async () => {
    // Sem isso o conserto trocaria um buraco por outro: quem digita "adto"
    // deixaria de encontrar o que passou a se chamar "Adiantamento".
    const s = await promptDeSinonimos();
    expect(s).toContain("INCLUA");
    expect(s).toMatch(/forma abreviada/i);
  });

  it("NÃO diz mais 'mantenha o sentido' — era a frase que bloqueava", async () => {
    const s = await promptDeSinonimos();
    const instrucao = s.slice(s.indexOf("const instrucao"));
    expect(instrucao).not.toContain("mas mantenha o sentido");
  });
});

describe("o que NÃO vai para a IA", () => {
  it("o worker não manda nome de coluna no lote", async () => {
    // 2.011 de 4.312 aliases de coluna acabaram no termo ERRADO porque o modelo
    // cruzava os nomes entre as 60 linhas do prompt. O par coluna↔rótulo o
    // servidor já tem — mandá-lo só abria espaço para errar.
    const w = await (await import("node:fs/promises")).readFile("worker/index.ts", "utf-8");
    const bloco = w.slice(w.indexOf('if (job.scope === "dicionario")'), w.indexOf('if (job.scope === "document"'));
    expect(bloco).toContain("aliases: [] as string[]");
    expect(bloco).toContain("colunasPorTermo");
    expect(bloco).not.toMatch(/aliases:\s*\[\.\.\.e\.aliases\]/);
  });
});
