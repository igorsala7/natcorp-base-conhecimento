import { describe, it, expect } from "vitest";
import { lerDicionarioCsv } from "./dicionario-csv";

describe("dicionário por CSV", () => {
  it("lê o caso que motivou a funcionalidade", () => {
    // Os dois exemplos do Igor. Nenhum deles aparece como DB_TABLE_NAME no
    // f200.json — vêm de query, não de item ligado a tabela. O CSV afirma o
    // que o metadado do APEX só insinua.
    const r = lerDicionarioCsv(
      "tabela,coluna,label\nFILIAIS,COD_FILIAL,Filial\nCENTRO_DE_CUSTO,COD,Código",
    );
    expect(r.linhas).toEqual([
      { tabela: "FILIAIS", coluna: "COD_FILIAL", label: "Filial", descricao: null, tipo: null },
      { tabela: "CENTRO_DE_CUSTO", coluna: "COD", label: "Código", descricao: null, tipo: null },
    ]);
  });

  it("aceita o cabeçalho do SQL Developer e o escrito à mão", () => {
    // Exigir um nome exato transformaria a primeira tentativa em erro.
    const oracle = lerDicionarioCsv("TABLE_NAME,COLUMN_NAME,DATA_TYPE,COMMENTS\nFILIAIS,COD_FILIAL,NUMBER,Código da filial");
    expect(oracle.linhas[0]).toEqual({
      tabela: "FILIAIS",
      coluna: "COD_FILIAL",
      label: null,
      descricao: "Código da filial",
      tipo: "NUMBER",
    });

    const mao = lerDicionarioCsv("Nome da Tabela;Campo;Rótulo\nfiliais;cod_filial;Filial");
    expect(mao.linhas[0]?.tabela).toBe("FILIAIS");
    expect(mao.linhas[0]?.label).toBe("Filial");
  });

  it("normaliza tabela e coluna para MAIÚSCULA", () => {
    // É como o Oracle as guarda, e é o que faz "centro_de_custo" e
    // "CENTRO_DE_CUSTO" virarem o mesmo endereço.
    const r = lerDicionarioCsv("tabela,coluna\ncentro_de_custo,cod");
    expect(r.linhas[0]).toMatchObject({ tabela: "CENTRO_DE_CUSTO", coluna: "COD" });
  });

  it("descarta linha sem tabela ou sem coluna, e conta", () => {
    const r = lerDicionarioCsv("tabela,coluna,label\nFILIAIS,COD,Filial\n,ORFA,x\nSEMCOL,,y");
    expect(r.linhas).toHaveLength(1);
    expect(r.descartadas).toBe(2);
  });

  it("a primeira ocorrência vence quando o arquivo repete", () => {
    // Exportação que junta views e tabelas repete a mesma coluna.
    const r = lerDicionarioCsv("tabela,coluna,label\nFILIAIS,COD,Primeiro\nFILIAIS,COD,Segundo");
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]?.label).toBe("Primeiro");
  });

  it("sem tabela ou sem coluna no cabeçalho, recusa e devolve o que veio", () => {
    // O par tabela+coluna é o que dá endereço ao dado; sem ele não há dicionário.
    const r = lerDicionarioCsv("nome,valor\nx,y");
    expect(r.linhas).toEqual([]);
    expect(r.ignoradas).toEqual(["nome", "valor"]);
  });

  it("relata os cabeçalhos que ignorou", () => {
    // Quem exporta demais precisa saber o que NÃO foi aproveitado.
    const r = lerDicionarioCsv("tabela,coluna,nullable,owner\nFILIAIS,COD,N,RH");
    expect(r.ignoradas).toEqual(["nullable", "owner"]);
  });

  it("respeita aspas e vírgula dentro do campo (RFC 4180)", () => {
    const r = lerDicionarioCsv('tabela,coluna,descricao\nFILIAIS,COD,"Código, único por empresa"');
    expect(r.linhas[0]?.descricao).toBe("Código, único por empresa");
  });

  it("arquivo só com cabeçalho não quebra", () => {
    expect(lerDicionarioCsv("tabela,coluna").linhas).toEqual([]);
    expect(lerDicionarioCsv("").linhas).toEqual([]);
  });
});
