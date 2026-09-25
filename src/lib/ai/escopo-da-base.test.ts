import { describe, it, expect } from "vitest";
import { decidirEscopo } from "./escopo-da-base";

describe("decidirEscopo", () => {
  it("sem nada anexado, manda usar o escopo da CHAVE", () => {
    const r = decidirEscopo({ documentacoes: [], documentos: [] }, ["sp-da-chave"]);
    expect(r.origem).toBe("chave");
    expect(r.spaceIds).toEqual(["sp-da-chave"]);
    expect(r.documentIds).toEqual([]);
  });

  it("com documentação anexada, usa a da BASE e ignora a da chave", () => {
    const r = decidirEscopo(
      { documentacoes: [{ space_id: "sp-natcorp", origem: "universal" }], documentos: [] },
      ["sp-da-chave"],
    );
    expect(r.origem).toBe("base");
    expect(r.spaceIds).toEqual(["sp-natcorp"]);
  });

  /**
   * O caso que a spec chama de aditivo: universal e do cliente SOMAM, não
   * substituem. Se substituíssem, anexar um PDF ao cliente tiraria dele a
   * documentação do sistema — e ninguém pediria isso de propósito.
   */
  it("universal e do cliente somam, sem duplicar", () => {
    const r = decidirEscopo(
      {
        documentacoes: [
          { space_id: "sp-natcorp", origem: "universal" },
          { space_id: "sp-cliente", origem: "base" },
          { space_id: "sp-natcorp", origem: "base" },
        ],
        documentos: [],
      },
      ["sp-da-chave"],
    );
    expect(r.spaceIds.sort()).toEqual(["sp-cliente", "sp-natcorp"]);
  });

  /**
   * Arquivo do cliente SOZINHO já é escopo. Sem isto, um cliente que só
   * anexou o PDF de regras internas cairia no escopo da chave e o PDF não
   * entraria na busca — o pedido original ficaria sem efeito.
   */
  it("só arquivo anexado já conta como escopo da base", () => {
    const r = decidirEscopo({ documentacoes: [], documentos: ["doc-1"] }, ["sp-da-chave"]);
    expect(r.origem).toBe("base");
    expect(r.spaceIds).toEqual([]);
    expect(r.documentIds).toEqual(["doc-1"]);
  });

  it("chave vazia e base vazia devolve escopo vazio, não explode", () => {
    const r = decidirEscopo({ documentacoes: [], documentos: [] }, []);
    expect(r.origem).toBe("chave");
    expect(r.spaceIds).toEqual([]);
  });
});
