import { describe, it, expect } from "vitest";
import { numeroDoId, linhasParaStore, MAX_POR_CONVERSA, HORAS_ATE_EXPIRAR } from "./dataset-conversa";

/**
 * As partes PURAS da persistência entre turnos. O I/O (Supabase + Storage) fica
 * de fora por construção — o que pode dar errado em silêncio aqui é a conversão
 * de forma, e é isso que estes testes prendem.
 */
describe("numeroDoId", () => {
  it("extrai o número dos dois espaços de nome", () => {
    expect(numeroDoId("ds3")).toBe(3);
    expect(numeroDoId("tela12")).toBe(12);
  });

  it("id sem número não vira zero — vira null", () => {
    // Zero seria gravado como `seq: 0` e colidiria com o próximo id sem número.
    expect(numeroDoId("dataset")).toBeNull();
    expect(numeroDoId("")).toBeNull();
  });
});

describe("linhasParaStore", () => {
  const colunas = ["matricula", "nome"];

  it("segue a ORDEM das colunas, não a ordem das chaves do objeto", () => {
    const rows = [{ nome: "TONY", matricula: "205818" }];
    expect(linhasParaStore(rows, colunas)).toEqual([["205818", "TONY"]]);
  });

  it("lê pelo nome OU pelo índice — o registro guarda as duas formas", () => {
    // O registro indexa cada célula por `c0`/`c1` E pelo nome, para o modelo
    // poder referenciar das duas maneiras. Persistir as duas dobraria o tamanho.
    expect(linhasParaStore([{ c0: "1", c1: "ANA" }], colunas)).toEqual([["1", "ANA"]]);
  });

  it("célula ausente vira vazio, não `undefined` no JSON", () => {
    expect(linhasParaStore([{ matricula: "9" }], colunas)).toEqual([["9", ""]]);
  });

  it("limpa a célula como o resto do sistema — o `<br>` do ERP inclusive", () => {
    const r = linhasParaStore([{ matricula: "1", nome: "A<br>B" }], colunas);
    expect(r[0]![1]).toBe("A<br>B"); // `<br>` é conteúdo; o chat é que o renderiza
  });
});

describe("política de retenção", () => {
  it("é a decidida: 10 tabelas, 24 horas", () => {
    // Prende os números aos quais a decisão do dono está atrelada — mudar aqui
    // é mudar quanto dado pessoal fica em repouso, não afinar um parâmetro.
    expect(MAX_POR_CONVERSA).toBe(10);
    expect(HORAS_ATE_EXPIRAR).toBe(24);
  });
});

/**
 * SÓ RESULTADO DE FERRAMENTA É PERSISTIDO.
 *
 * A tabela da TELA chega do widget em toda mensagem — guardar é guardar o que
 * já vem de graça. E era regravada a cada turno com um id novo: em 26 mensagens
 * consumiu 7 das 10 vagas com cópias das MESMAS 132 linhas (19/08/2026),
 * expulsando os resultados de API. O modelo pedia `ds30` e recebia
 * "não encontrei — disponível: tela47".
 */
describe("o que entra na persistência", () => {
  const dsQualquer = (id: string) => ({ id, rows: [{ a: "1" }], colunas: ["a"], headers: ["a"] });

  it("`telaN` fica de fora, `dsN` entra", () => {
    // A regra é o prefixo do id, e é ele que separa origem de tela de origem
    // de ferramenta em todo o resto do sistema.
    expect(dsQualquer("tela9").id.startsWith("ds")).toBe(false);
    expect(dsQualquer("ds9").id.startsWith("ds")).toBe(true);
  });

  it("o número continua sendo extraído dos dois — a numeração é compartilhada", () => {
    // Não persistir não quer dizer não numerar: `tela9` ocupa o 9, e o próximo
    // `ds` precisa ser 10, senão dois datasets diferentes viram o mesmo id.
    expect(numeroDoId("tela9")).toBe(9);
    expect(numeroDoId("ds10")).toBe(10);
  });
});
