import { describe, it, expect } from "vitest";
import { deduplicar } from "./gravar";

const l = (o: Partial<Record<string, unknown>>) =>
  ({ space_id: "sp", kind: "apex_page", name: "Home", source: "apex_dict", ...o }) as never;

describe("deduplicar antes de gravar", () => {
  it("O CASO REAL: duas páginas com o mesmo nome derrubavam 500 linhas", () => {
    // O índice é (space_id, kind, name, coalesce(parent_name,'')). No f200.json
    // real isso custou 3.000 linhas — seis lotes inteiros, incluindo TODAS as
    // páginas e quase todas as regiões.
    const { unicas, duplicadas } = deduplicar([l({}), l({})]);
    expect(unicas).toHaveLength(1);
    expect(duplicadas).toBe(1);
  });

  it("parent_name nulo e vazio são a MESMA chave — como no índice", () => {
    // `coalesce(parent_name,'')`: se a dedup não fizer igual, ela deixa passar
    // uma colisão que o banco vai recusar.
    const { unicas } = deduplicar([l({ parent_name: null }), l({ parent_name: "" })]);
    expect(unicas).toHaveLength(1);
  });

  it("vence a linha MAIS RICA, não a primeira", () => {
    // Entre {label: null} e {label: "Filial"}, guardar a primeira porque chegou
    // antes jogaria fora justamente o que se veio buscar.
    const { unicas } = deduplicar([
      l({ name: "COD", label: null, db_table: null }),
      l({ name: "COD", label: "Filial", db_table: "FILIAIS" }),
    ]);
    expect(unicas[0]).toMatchObject({ label: "Filial", db_table: "FILIAIS" });
  });

  it("kind diferente não é duplicata", () => {
    // "Home" como página e "Home" como região são coisas distintas.
    const { unicas } = deduplicar([l({ kind: "apex_page" }), l({ kind: "apex_region" })]);
    expect(unicas).toHaveLength(2);
  });

  it("parent_name diferente separa homônimos", () => {
    // Duas colunas "COD" em tabelas diferentes convivem, e precisam conviver.
    const { unicas } = deduplicar([l({ name: "COD", parent_name: "FILIAIS" }), l({ name: "COD", parent_name: "CENTRO_DE_CUSTO" })]);
    expect(unicas).toHaveLength(2);
  });

  it("lista vazia não quebra", () => {
    expect(deduplicar([])).toEqual({ unicas: [], duplicadas: 0 });
  });
});
