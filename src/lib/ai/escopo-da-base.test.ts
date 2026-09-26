import { describe, it, expect } from "vitest";
import { decidirEscopo } from "./escopo-da-base";

describe("decidirEscopo", () => {
  it("sem nada anexado, devolve o escopo da CHAVE e diz que a base não configurou nada", () => {
    const r = decidirEscopo({ documentacoes: [], documentos: [] }, ["sp-da-chave"]);
    expect(r.origem).toBe("chave");
    expect(r.spaceIds).toEqual(["sp-da-chave"]);
    expect(r.documentIds).toEqual([]);
  });

  /**
   * A MINA DA TAREFA 9, e a razão desta função ter deixado de cair.
   *
   * O primeiro ramo de `escopo_documentacao` não filtra por base: ele devolve
   * as universais para TODAS as bases. Com o ramo de queda, a primeira linha
   * habilitada em `documentacoes_universais` faria toda base resolver algo e
   * DESCARTAR o escopo da chave — apagando silenciosamente uma documentação de
   * cada uma das três instalações vivas em produção (`painel-do-gestor`,
   * `natcorp`, `painel-do-colaborador`, uma linha de `widget_key_spaces` cada),
   * sem erro em lugar nenhum. Este é o teste que impede a volta disso.
   */
  it("o escopo da chave SOBREVIVE à existência de uma universal", () => {
    const r = decidirEscopo(
      { documentacoes: [{ space_id: "sp-universal", origem: "universal" }], documentos: [] },
      ["sp-da-chave"],
    );
    expect(r.spaceIds.sort()).toEqual(["sp-da-chave", "sp-universal"]);
    expect(r.origem).toBe("base");
  });

  it("o escopo da chave sobrevive também a documentação anexada à base", () => {
    const r = decidirEscopo(
      { documentacoes: [{ space_id: "sp-cliente", origem: "base" }], documentos: [] },
      ["sp-da-chave"],
    );
    expect(r.spaceIds.sort()).toEqual(["sp-cliente", "sp-da-chave"]);
  });

  it("o escopo da chave sobrevive a arquivo anexado sozinho", () => {
    const r = decidirEscopo({ documentacoes: [], documentos: ["doc-1"] }, ["sp-da-chave"]);
    expect(r.spaceIds).toEqual(["sp-da-chave"]);
    expect(r.documentIds).toEqual(["doc-1"]);
    expect(r.origem).toBe("base");
  });

  /**
   * O caso que a spec chama de aditivo: universal, cliente e chave SOMAM, e
   * nada duplica. Duplicata aqui não quebraria a busca (o SQL filtra por
   * pertinência), mas inflaria o número de espaços consultados a cada turno.
   */
  it("chave, universal e cliente somam, sem duplicar", () => {
    const r = decidirEscopo(
      {
        documentacoes: [
          { space_id: "sp-natcorp", origem: "universal" },
          { space_id: "sp-cliente", origem: "base" },
          { space_id: "sp-natcorp", origem: "base" },
          { space_id: "sp-da-chave", origem: "universal" },
        ],
        documentos: ["doc-1", "doc-1"],
      },
      ["sp-da-chave", "sp-da-chave"],
    );
    expect(r.spaceIds.sort()).toEqual(["sp-cliente", "sp-da-chave", "sp-natcorp"]);
    expect(r.documentIds).toEqual(["doc-1"]);
  });

  /**
   * `origem` é INFORMATIVA depois desta rodada: ela diz se a base resolveu
   * algo próprio, não de onde vem o escopo. Quem decide `p_base` da cerca da
   * tarefa 7 não pode usá-la (ver o comentário em `rag.ts`).
   */
  it("origem diz 'base' quando a base resolveu algo próprio, mesmo com chave presente", () => {
    expect(decidirEscopo({ documentacoes: [], documentos: ["doc-1"] }, ["sp"]).origem).toBe("base");
    expect(decidirEscopo({ documentacoes: [], documentos: [] }, ["sp"]).origem).toBe("chave");
  });

  it("chave vazia e base vazia devolve escopo vazio, não explode", () => {
    const r = decidirEscopo({ documentacoes: [], documentos: [] }, []);
    expect(r.origem).toBe("chave");
    expect(r.spaceIds).toEqual([]);
    expect(r.documentIds).toEqual([]);
  });

  it("base configurada e chave VAZIA devolve só o que a base resolveu", () => {
    const r = decidirEscopo(
      { documentacoes: [{ space_id: "sp-cliente", origem: "base" }], documentos: ["doc-1"] },
      [],
    );
    expect(r.spaceIds).toEqual(["sp-cliente"]);
    expect(r.documentIds).toEqual(["doc-1"]);
    expect(r.origem).toBe("base");
  });
});
