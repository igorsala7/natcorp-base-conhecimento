import { describe, it, expect } from "vitest";
import { calcularSaldo, modoDoSaldo, precisaAvisar, type CicloFato } from "./creditos";

const ciclo = (n: number, p: Partial<CicloFato> = {}): CicloFato => ({
  ciclo_inicio: `2026-0${n}-01T03:00:00.000Z`,
  ciclo_fim: `2026-0${n + 1}-01T03:00:00.000Z`,
  contratado: 1000,
  consumo: 0,
  compras: 0,
  ...p,
});

/**
 * O exemplo que o dono ditou, passo a passo. Se algum dia alguém "simplificar"
 * a regra, é este teste que tem de falhar primeiro — ele É a especificação.
 */
describe("o exemplo do dono, mês a mês", () => {
  it("mês 1: consome os 1000 contratados e compra 400 → fecha com 400 de extra", () => {
    const s = calcularSaldo([ciclo(1, { consumo: 1000, compras: 400 })])!;
    expect(s.contratadoConsumido).toBe(1000);
    expect(s.contratadoSaldo).toBe(0);
    expect(s.extraSaldo).toBe(400);
    expect(s.saldo).toBe(400);
  });

  it("mês 2: abre com 1400 (1000 renovados + 400 que atravessaram)", () => {
    const s = calcularSaldo([
      ciclo(1, { consumo: 1000, compras: 400 }),
      ciclo(2),
    ])!;
    expect(s.disponivel).toBe(1400);
  });

  it("mês 2: consome 800 e tudo sai do contratado, não do extra", () => {
    const s = calcularSaldo([
      ciclo(1, { consumo: 1000, compras: 400 }),
      ciclo(2, { consumo: 800 }),
    ])!;
    expect(s.contratadoConsumido).toBe(800);
    expect(s.contratadoSaldo).toBe(200);
    expect(s.extraConsumido).toBe(0);
    expect(s.extraSaldo).toBe(400);
  });

  it("virada do mês 2 para o 3: os 200 do contratado morrem, os 400 ficam", () => {
    const s = calcularSaldo([
      ciclo(1, { consumo: 1000, compras: 400 }),
      ciclo(2, { consumo: 800 }),
      ciclo(3),
    ])!;
    expect(s.disponivel).toBe(1400); // 1000 renovados + 400 de extra
    expect(s.extraDisponivel).toBe(400);
    expect(s.saldo).toBe(1400);
  });
});

describe("prioridade do contratado", () => {
  it("só toca no extra depois de esgotar o contratado", () => {
    const s = calcularSaldo([
      ciclo(1, { compras: 400 }),
      ciclo(2, { consumo: 1200 }),
    ])!;
    expect(s.contratadoConsumido).toBe(1000);
    expect(s.extraConsumido).toBe(200);
    expect(s.extraSaldo).toBe(200);
  });

  it("consumo abaixo do contratado não encosta no extra, por maior que ele seja", () => {
    const s = calcularSaldo([ciclo(1, { compras: 9999, consumo: 1 })])!;
    expect(s.extraConsumido).toBe(0);
    expect(s.extraSaldo).toBe(9999);
  });
});

/**
 * A parte fácil de errar: depois de zerar, o chat continua (só documentação) e
 * continua gastando token. Esse consumo NÃO pode virar dívida, senão come a
 * próxima compra e o cliente paga 400 para receber menos.
 */
describe("modo documentação não consome crédito", () => {
  it("consumo além de tudo que havia não deixa o extra negativo", () => {
    const s = calcularSaldo([ciclo(1, { compras: 100, consumo: 5000 })])!;
    expect(s.extraSaldo).toBe(0);
    expect(s.saldo).toBe(0);
    expect(s.consumoSemCobertura).toBe(3900); // 5000 − 1000 − 100
  });

  it("a compra seguinte chega inteira, sem ser abatida pelo estouro anterior", () => {
    const s = calcularSaldo([
      ciclo(1, { consumo: 5000 }), // estourou muito, rodou em documentação
      ciclo(2, { compras: 400 }),
    ])!;
    expect(s.extraDisponivel).toBe(400);
    expect(s.extraSaldo).toBe(400);
  });
});

describe("plano versionado", () => {
  it("usa o contratado vigente em CADA ciclo, não o de hoje", () => {
    const s = calcularSaldo([
      ciclo(1, { contratado: 500, consumo: 600, compras: 300 }), // estourou 100
      ciclo(2, { contratado: 2000, consumo: 0 }),
    ])!;
    expect(s.extraSaldo).toBe(200); // 300 comprados − 100 de excedente no mês 1
    expect(s.disponivel).toBe(2200);
  });
});

describe("modo e aviso", () => {
  it("saldo zerado manda para o modo documentação", () => {
    const s = calcularSaldo([ciclo(1, { consumo: 1000 })]);
    expect(modoDoSaldo(s)).toBe("somente_documentacao");
  });

  it("sem plano não é sem serviço", () => {
    expect(modoDoSaldo(null)).toBe("normal");
    expect(precisaAvisar(null)).toBe(false);
  });

  /**
   * Pego contra o banco real: a natcorp não tem plano, então `contratado = 0`,
   * e qualquer consumo a zerava. Sem esta guarda o cliente principal perderia
   * todas as ferramentas por uma regra feita para cobrar quem contratou.
   */
  it("base COM consumo e SEM plano continua normal", () => {
    const s = calcularSaldo([ciclo(1, { contratado: 0, consumo: 825 })])!;
    expect(s.saldo).toBe(0);
    expect(modoDoSaldo(s, false)).toBe("normal");
    expect(modoDoSaldo(s, true)).toBe("somente_documentacao");
    expect(precisaAvisar(s, false)).toBe(false);
  });

  it("avisa a partir de 10% restantes, não antes", () => {
    expect(precisaAvisar(calcularSaldo([ciclo(1, { consumo: 890 })]))).toBe(false); // 11%
    expect(precisaAvisar(calcularSaldo([ciclo(1, { consumo: 900 })]))).toBe(true); // 10%
    expect(precisaAvisar(calcularSaldo([ciclo(1, { consumo: 950 })]))).toBe(true); // 5%
  });

  it("zerado não avisa — já não é aviso, é bloqueio", () => {
    expect(precisaAvisar(calcularSaldo([ciclo(1, { consumo: 1000 })]))).toBe(false);
  });

  it("o percentual considera o extra, não só o contratado", () => {
    const s = calcularSaldo([ciclo(1, { compras: 1000, consumo: 1800 })])!;
    expect(s.disponivel).toBe(2000);
    expect(s.pctRestante).toBe(10);
  });
});
