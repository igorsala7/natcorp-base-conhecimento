/**
 * O MOLDE DOS ALERTAS — e a cerca que ele é, não o formato que ele parece.
 *
 * O caso que justifica o arquivo é o terceiro: `alertas_para` hoje NÃO devolve
 * `regra`, e a migration de campanhas tem uma assertiva que quebra se alguém
 * acrescentar. Mas a assertiva do banco não sabe o que o TypeScript faz com a
 * linha depois — um `{...linha}` aqui publicaria a coluna nova na resposta de
 * `/api/v1/config`, que chega ao navegador de qualquer visitante.
 *
 * Então o teste não verifica "os campos certos saem" (isso seria testar um
 * mapeamento). Verifica que um campo que NÃO está na lista não sai, mesmo quando
 * o banco o entrega.
 */
import { describe, it, expect } from "vitest";
import { alertasDoWidget } from "./alertas";

describe("alertasDoWidget", () => {
  it("molda as quatro colunas de alertas_para", () => {
    const r = alertasDoWidget([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        titulo: "Folha fechada",
        corpo: "A folha de setembro foi fechada em 25/09.",
        publicar_em: "2026-09-25T12:00:00.000Z",
      },
    ]);
    expect(r).toEqual([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        titulo: "Folha fechada",
        corpo: "A folha de setembro foi fechada em 25/09.",
        publicarEm: "2026-09-25T12:00:00.000Z",
      },
    ]);
  });

  it("NÃO repassa a regra do cliente, mesmo se o banco devolver", () => {
    const r = alertasDoWidget([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        titulo: "Aviso",
        corpo: "",
        publicar_em: "2026-09-25T12:00:00.000Z",
        // O dia em que alguém acrescentar isto ao retorno da função: os centros
        // de custo e os sindicatos do cliente viram dado público.
        regra: { centro_custo: ["1001", "1002"], sindicato: ["SINDPD"] },
      },
    ]);
    expect(r).toHaveLength(1);
    expect(Object.keys(r[0]!).sort()).toEqual(["corpo", "id", "publicarEm", "titulo"]);
    expect(JSON.stringify(r)).not.toContain("1001");
    expect(JSON.stringify(r)).not.toContain("SINDPD");
  });

  it("corpo vazio é alerta legítimo: título sozinho é um aviso", () => {
    const r = alertasDoWidget([
      { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", titulo: "Ponto fecha hoje", corpo: "", publicar_em: "x" },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.corpo).toBe("");
  });

  it("descarta linha sem id (não há onde gravar a visualização) e título em branco", () => {
    const r = alertasDoWidget([
      { id: "", titulo: "sem id", corpo: "", publicar_em: "x" },
      { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", titulo: "   ", corpo: "corpo sem título", publicar_em: "x" },
      { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", titulo: "válido", corpo: "", publicar_em: "x" },
    ]);
    expect(r.map((a) => a.titulo)).toEqual(["válido"]);
  });

  it("RPC com erro (null) ou resposta fora de forma vira lista vazia, nunca exceção", () => {
    // Abrir o widget não pode quebrar por causa de um alerta: bolha sem alerta é
    // o comportamento de sempre, bolha que não monta é regressão.
    expect(alertasDoWidget(null)).toEqual([]);
    expect(alertasDoWidget(undefined)).toEqual([]);
    expect(alertasDoWidget({ id: "x" })).toEqual([]);
    expect(alertasDoWidget("[]")).toEqual([]);
    expect(alertasDoWidget([null, 7, "x", []])).toEqual([]);
  });
});
