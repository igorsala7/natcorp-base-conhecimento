import { describe, it, expect } from "vitest";
import { resolverReferente, temReferencia, nomeiaAlvoProprio } from "./referente-destacado";

const destaque = [
  { coluna: "MATRICULA", valor: "1937" },
  { coluna: "MATRICULA", valor: "1943" },
];

describe("O CASO DO IGOR", () => {
  it('"Me traga o cargo deles" depois de um destaque → os destacados', () => {
    const r = resolverReferente({ mensagem: "Me traga o(s) cargo(s) dele(s)", destacadasAntes: destaque });
    expect(r.tipo).toBe("destacados");
    if (r.tipo !== "destacados") return;
    // A diretriz cita os VALORES: sem eles o modelo teria de reencontrá-los no
    // histórico, que é exatamente o passo em que ele erra e consulta a lista toda.
    expect(r.diretriz).toContain("1937");
    expect(r.diretriz).toContain("1943");
    expect(r.diretriz).toContain("MATRICULA");
  });

  it("agrupa por coluna em vez de repetir o nome dela", () => {
    const r = resolverReferente({
      mensagem: "e a situação desses?",
      destacadasAntes: [{ coluna: "SITUAÇÃO", valor: "Férias" }, { coluna: "MATRICULA", valor: "9" }],
    });
    if (r.tipo !== "destacados") throw new Error("esperava destacados");
    expect(r.diretriz).toMatch(/SITUAÇÃO = Férias/);
    expect(r.diretriz).toMatch(/MATRICULA = 9/);
  });
});

describe("as três famílias de referência que o Igor listou", () => {
  it("pronome oblíquo, demonstrativo e neutro", () => {
    for (const m of [
      "qual o cargo dele", "o salário dela", "traga os dados deles", "a matrícula delas",
      "me explica esse", "detalha essa", "quero esses", "aquelas ali",
      "o que é isso", "me fala disso", "e aquilo?", "explica aquele caso",
    ]) {
      expect(temReferencia(m), m).toBe(true);
    }
  });

  it("acento não decide — 'aquele' e 'aquilo' entram digitados de qualquer jeito", () => {
    expect(temReferencia("e aquilo")).toBe(true);
    expect(temReferencia("e AQUILO")).toBe(true);
  });

  it("não casa dentro de outra palavra", () => {
    // "candela", "modeste", "prestes" contêm "dela"/"este" — casar dentro delas
    // faria toda frase virar anáfora.
    expect(temReferencia("acenda a candela")).toBe(false);
    expect(temReferencia("estamos prestes a fechar")).toBe(false);
  });

  it("mensagem sem referência não aciona", () => {
    for (const m of ["quantos colaboradores temos", "liste as férias de agosto", "gere um relatório"]) {
      expect(temReferencia(m), m).toBe(false);
    }
  });
});

describe("quando o usuário NOMEIA o alvo, o destaque não manda", () => {
  it("é a segunda metade da regra: 'caso contrário o usuário vai informar de quem'", () => {
    expect(nomeiaAlvoProprio("o cargo do João Silva")).toBe(true);
    expect(nomeiaAlvoProprio("a matrícula 4821")).toBe(true);
    expect(resolverReferente({ mensagem: "e o cargo da Maria Souza?", destacadasAntes: destaque }).tipo).toBe("nenhum");
  });

  it("é conservador: na dúvida o destaque continua valendo", () => {
    // "cargo" sozinho não é nome próprio; frase capitalizada no início também não.
    expect(nomeiaAlvoProprio("Qual o cargo")).toBe(false);
    expect(resolverReferente({ mensagem: "Qual o cargo dele", destacadasAntes: destaque }).tipo).toBe("destacados");
  });
});

describe("sem destaque, não inventa referente", () => {
  it("devolve 'nenhum' e deixa o subject-clarify perguntar", () => {
    for (const d of [null, undefined, [], [{ coluna: "", valor: "" }]]) {
      expect(resolverReferente({ mensagem: "o cargo dele", destacadasAntes: d }).tipo).toBe("nenhum");
    }
  });

  it("destaque sem referência na mensagem também não aciona", () => {
    // "liste todos os cargos" depois de um destaque é pergunta nova, não anáfora.
    expect(resolverReferente({ mensagem: "liste todos os cargos", destacadasAntes: destaque }).tipo).toBe("nenhum");
  });
});
