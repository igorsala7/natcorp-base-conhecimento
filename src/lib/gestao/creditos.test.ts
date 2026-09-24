import { describe, it, expect } from "vitest";
import {
  calcularSaldo,
  modoDoSaldo,
  precisaAvisar,
  precoDoAdicional,
  USD_POR_CREDITO_EXTRA,
  CREDITOS_POR_LOTE,
  type CicloFato,
} from "./creditos";

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
 * DEPOIS DE ZERAR, O CONSUMO SAI DO MÊS QUE VEM (regra do dono, 24/09).
 *
 * Antes este consumo não tinha dono: o `min(excedente, disponível)` impedia
 * que virasse dívida do cliente, e a conta ficava com a Natcorp. Agora tem
 * dono, que é a mensalidade seguinte.
 *
 * Duas coisas que o teste trava porque a frase do dono foi específica:
 * a dívida é cobrada do "plano contratado do próximo mês", então adicional
 * comprado NÃO é usado para quitá-la; e não há teto de profundidade, então
 * uma dívida maior que a mensalidade atravessa quantos meses precisar.
 */
describe("adiantamento da mensalidade seguinte", () => {
  it("o que passa de tudo vira adiantamento, e não mais prejuízo", () => {
    const s = calcularSaldo([ciclo(1, { compras: 100, consumo: 5000 })])!;
    expect(s.extraSaldo).toBe(0);
    expect(s.saldo).toBe(0);
    expect(s.adiantado).toBe(3900); // 5000 − 1000 contratados − 100 comprados
    expect(s.consumoSemCobertura).toBe(0);
  });

  it("o mês seguinte abre com a mensalidade já descontada", () => {
    const s = calcularSaldo([
      ciclo(1, { consumo: 1300 }), // adianta 300
      ciclo(2, { consumo: 0 }),
    ])!;
    expect(s.contratadoPlano).toBe(1000);
    expect(s.contratadoAbatido).toBe(300);
    expect(s.contratadoTotal).toBe(700);
    expect(s.adiantado).toBe(0);
  });

  it("encadeia sem limite: dívida maior que a mensalidade atravessa vários meses", () => {
    // 3.500 de dívida contra plano de 1.000 consome três meses inteiros e
    // ainda alcança o quarto. Sem teto, por decisão do dono.
    const meses = [ciclo(1, { consumo: 4500 }), ciclo(2), ciclo(3), ciclo(4)];
    expect(calcularSaldo(meses.slice(0, 1))!.adiantado).toBe(3500);
    expect(calcularSaldo(meses.slice(0, 2))!.adiantado).toBe(2500);
    expect(calcularSaldo(meses.slice(0, 3))!.adiantado).toBe(1500);
    const quarto = calcularSaldo(meses)!;
    expect(quarto.adiantado).toBe(500);
    expect(quarto.contratadoTotal).toBe(0); // o mês inteiro foi para a dívida
  });

  it("base SEM plano não adianta: não existe mensalidade futura de onde tirar", () => {
    // Sem esta guarda a NATCORP, que tinha contratado 0, acumularia dívida
    // para sempre por um consumo que a regra nunca quis cobrar dela.
    const s = calcularSaldo([ciclo(1, { contratado: 0, consumo: 800 })])!;
    expect(s.adiantado).toBe(0);
    expect(s.consumoSemCobertura).toBe(800);
  });

  it("a compra avulsa chega inteira e não quita dívida", () => {
    const s = calcularSaldo([
      ciclo(1, { consumo: 5000 }), // adianta 4000
      ciclo(2, { compras: 400 }),
    ])!;
    expect(s.extraDisponivel).toBe(400);
    expect(s.extraSaldo).toBe(400);
    expect(s.adiantado).toBe(3000); // 4000 menos a mensalidade do mês 2
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
    expect(modoDoSaldo(s)).toBe("economico");
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
    expect(modoDoSaldo(s, true)).toBe("economico");
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

/**
 * O PREÇO DO ADICIONAL, travado.
 *
 * Em 23/09 a tela de compra cotava 100 créditos a US$5,00 — o preço do
 * CONTRATADO — enquanto a ação gravava US$3,50. A cotação mentia (a favor do
 * cliente, mas mentia), porque o formulário recebia o preço por prop, vindo do
 * plano. Agora tela e ação leem a MESMA constante, e estes testes existem para
 * o número não voltar a divergir sem alguém ver.
 */
describe("preço do crédito adicional", () => {
  it("cobra US$3,50 pelo lote de 100, que é como o dono descreve o preço", () => {
    expect(CREDITOS_POR_LOTE).toBe(100);
    expect(precoDoAdicional(CREDITOS_POR_LOTE)).toBeCloseTo(3.5, 10);
  });

  it("NÃO é o preço do contratado — avulso é mais barato, de propósito", () => {
    const contratadoPorCredito = 0.05; // US$5,00 por 100 = US$5,00 por milhão
    expect(USD_POR_CREDITO_EXTRA).toBeLessThan(contratadoPorCredito);
    expect(precoDoAdicional(100)).not.toBeCloseTo(100 * contratadoPorCredito, 10);
  });

  it("escala linear e nunca devolve valor negativo", () => {
    expect(precoDoAdicional(1000)).toBeCloseTo(35, 10);
    expect(precoDoAdicional(0)).toBe(0);
    expect(precoDoAdicional(-500)).toBe(0);
  });
});

/**
 * O MODO SEM CRÉDITO MUDOU DE SIGNIFICADO EM 24/09, e o teste existe para o
 * nome não voltar a mentir.
 *
 * Até 23/09, `somente_documentacao`: crédito zerado cortava todas as
 * ferramentas e o chat seguia só com a documentação. Na prática isso apagava o
 * produto sem avisar — quem perguntava "quantos dias de férias eu tenho"
 * recebia um artigo explicando o que são férias.
 *
 * Agora `economico`: as ferramentas ficam e o turno roda num modelo mais
 * barato, configurado por finalidade em Sistema → Qual IA faz o quê. Quem
 * mexer aqui precisa mexer junto em `resolveAi` (a cascata da contingência) e
 * em `chat/route.ts` (que NÃO pode voltar a esvaziar `allToolsCru`).
 */
describe("modo sem crédito", () => {
  it("zerado vira economico, não corte", () => {
    const s = calcularSaldo([ciclo(1, { contratado: 100, consumo: 100 })])!;
    expect(s.saldo).toBe(0);
    expect(modoDoSaldo(s)).toBe("economico");
  });

  it("base sem plano nunca entra em economico", () => {
    // Sem contrato não é sem serviço: a NATCORP não tem plano cadastrado e
    // cairia no modo barato por um consumo qualquer.
    const s = calcularSaldo([ciclo(1, { contratado: 0, consumo: 50 })])!;
    expect(modoDoSaldo(s, false)).toBe("normal");
  });

  it("com saldo segue normal", () => {
    const s = calcularSaldo([ciclo(1, { contratado: 100, consumo: 40 })])!;
    expect(modoDoSaldo(s)).toBe("normal");
  });
});

/**
 * OS DOIS EXEMPLOS QUE O DONO DITOU EM 24/09, com os números dele.
 *
 * Existem porque a regra do adiantamento mudou duas vezes em dois dias e
 * porque as duas metades dela são fáceis de trocar de lugar: o que SOBRA do
 * contratado morre na virada, o que FALTA atravessa. Quem inverter isso por
 * engano faz o cliente ganhar saldo que não tem ou perder crédito que comprou,
 * e nos dois casos a tela continua parecendo certa.
 *
 * Se alguém "simplificar" o fold, é aqui que tem de estourar primeiro.
 */
describe("os dois exemplos do dono, 24/09", () => {
  it("exemplo 1: estourou 30.000 e o mês 2 abre com 70.000", () => {
    const mes1 = ciclo(1, { contratado: 100_000, compras: 50_000, consumo: 180_000 });

    const m1 = calcularSaldo([mes1])!;
    expect(m1.contratadoConsumido).toBe(100_000);
    expect(m1.extraConsumido).toBe(50_000); // o comprado foi todo usado
    expect(m1.extraSaldo).toBe(0);
    expect(m1.adiantado).toBe(30_000); // 180.000 − 100.000 − 50.000

    const m2 = calcularSaldo([mes1, ciclo(2, { contratado: 100_000 })])!;
    expect(m2.contratadoPlano).toBe(100_000);
    expect(m2.contratadoAbatido).toBe(30_000);
    expect(m2.contratadoTotal).toBe(70_000);
    expect(m2.disponivel).toBe(70_000); // nada de extra sobrou para somar
    expect(m2.adiantado).toBe(0); // a mensalidade cobriu a dívida inteira
  });

  it("exemplo 2: consumiu 80.000, o comprado fica intocado e o saldo do contrato morre", () => {
    const mes1 = ciclo(1, { contratado: 100_000, compras: 50_000, consumo: 80_000 });

    const m1 = calcularSaldo([mes1])!;
    expect(m1.contratadoConsumido).toBe(80_000);
    expect(m1.contratadoSaldo).toBe(20_000);
    expect(m1.extraConsumido).toBe(0); // intocáveis: o consumo nem chegou neles
    expect(m1.extraSaldo).toBe(50_000);
    expect(m1.adiantado).toBe(0);

    const m2 = calcularSaldo([mes1, ciclo(2, { contratado: 100_000 })])!;
    expect(m2.contratadoTotal).toBe(100_000); // renovou inteiro
    expect(m2.extraDisponivel).toBe(50_000); // o comprado atravessou
    expect(m2.disponivel).toBe(150_000);
    // Os 20.000 que sobraram do contrato no mês 1 NÃO aparecem em lugar nenhum.
    expect(m2.disponivel).toBe(100_000 + 50_000);
  });
});

