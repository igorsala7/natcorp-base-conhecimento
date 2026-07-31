import { describe, it, expect } from "vitest";
import { montarCsv, resumoDeterministico, parseNum, estimarTokens, parseCsv, detectarDelimitador, decodeBytesToText } from "./core";

describe("parseNum", () => {
  it("aceita número BR (1.234,56) e inteiro", () => {
    expect(parseNum("1.234,56")).toBeCloseTo(1234.56);
    expect(parseNum("100")).toBe(100);
    expect(parseNum(42)).toBe(42);
    expect(parseNum("-5,5")).toBeCloseTo(-5.5);
  });
  it("rejeita texto não-numérico", () => {
    expect(parseNum("ABC")).toBeNull();
    expect(parseNum("")).toBeNull();
    expect(parseNum(null)).toBeNull();
  });
});

describe("montarCsv", () => {
  it("gera cabeçalho + linhas, aceita arrays e objetos", () => {
    const cols = ["NOME", "VALOR"];
    expect(montarCsv(cols, [["Ana", 10], ["Bia", 20]])).toBe("NOME,VALOR\nAna,10\nBia,20");
    expect(montarCsv(cols, [{ NOME: "Ana", VALOR: 10 }])).toBe("NOME,VALOR\nAna,10");
  });
  it("escapa vírgula/aspas/quebra de linha", () => {
    expect(montarCsv(["A"], [['x,y']])).toBe('A\n"x,y"');
    expect(montarCsv(["A"], [['ele disse "oi"']])).toBe('A\n"ele disse ""oi"""');
  });
  it("só cabeçalho quando não há linhas", () => {
    expect(montarCsv(["A", "B"], [])).toBe("A,B");
  });
});

describe("resumoDeterministico", () => {
  it("classifica coluna numérica com soma/média/min/máx exatos", () => {
    const r = resumoDeterministico(["EMP", "SALARIO"], [
      ["700", "1.000,00"],
      ["700", "2.000,00"],
      ["701", "3.000,00"],
    ]);
    expect(r.linhas).toBe(3);
    expect(r.colunas).toBe(2);
    const sal = r.por_coluna[1]!;
    expect(sal.tipo).toBe("numérica");
    if (sal.tipo === "numérica") {
      expect(sal.soma).toBeCloseTo(6000);
      expect(sal.media).toBeCloseTo(2000);
      expect(sal.min).toBeCloseTo(1000);
      expect(sal.max).toBeCloseTo(3000);
    }
  });
  it("classifica coluna de texto com distintos e top", () => {
    const r = resumoDeterministico(["EMP"], [["A"], ["A"], ["B"]]);
    const emp = r.por_coluna[0]!;
    expect(emp.tipo).toBe("texto");
    if (emp.tipo === "texto") {
      expect(emp.distintos).toBe(2);
      expect(emp.top[0]).toEqual({ valor: "A", qtd: 2 });
    }
  });
});

describe("estimarTokens", () => {
  it("~4 chars por token", () => {
    expect(estimarTokens("abcd")).toBe(1);
    expect(estimarTokens("a".repeat(400))).toBe(100);
  });
});

describe("parseCsv", () => {
  it("detecta delimitador e faz parse (vírgula)", () => {
    expect(parseCsv("A,B\n1,2\n3,4")).toEqual([["A", "B"], ["1", "2"], ["3", "4"]]);
  });
  it("suporta ponto-e-vírgula (Excel BR) e CRLF", () => {
    expect(parseCsv("NOME;VALOR\r\nAna;10\r\nBia;20")).toEqual([["NOME", "VALOR"], ["Ana", "10"], ["Bia", "20"]]);
    expect(detectarDelimitador("NOME;VALOR;DATA")).toBe(";");
  });
  it("respeita aspas com delimitador/quebra dentro e '' escapado", () => {
    expect(parseCsv('A,B\n"x,y","ele disse ""oi"""')).toEqual([["A", "B"], ["x,y", 'ele disse "oi"']]);
    expect(parseCsv('A\n"linha1\nlinha2"')).toEqual([["A"], ["linha1\nlinha2"]]);
  });
  it("ignora BOM e linhas vazias", () => {
    expect(parseCsv("﻿A,B\n1,2\n\n")).toEqual([["A", "B"], ["1", "2"]]);
  });
});

describe("decodeBytesToText", () => {
  it("decodifica UTF-8", () => {
    expect(decodeBytesToText(new TextEncoder().encode("Programação"))).toBe("Programação");
  });
  it("cai para windows-1252 quando não é UTF-8 válido", () => {
    // 0xE7 = 'ç' em windows-1252/latin1, byte inválido como UTF-8 isolado
    expect(decodeBytesToText(new Uint8Array([0x61, 0xe7, 0x61]))).toBe("aça");
  });
});
