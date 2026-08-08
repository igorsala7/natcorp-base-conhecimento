import { describe, it, expect } from "vitest";
import { pedidoComposto } from "./pedido-composto";

describe("pedidoComposto", () => {
  it("dois módulos = composto — o caso real que obrigava a escolher metade do pedido", () => {
    // "Quero saber meu histórico de férias e meu histórico de pagamento de março"
    expect(pedidoComposto({ modulos: ["FÉRIAS", "PAGAMENTO"] })).toBe(true);
  });

  it("um módulo só não é composto — aí perguntar 'qual dessas?' faz sentido", () => {
    expect(pedidoComposto({ modulos: ["PAGAMENTO"] })).toBe(false);
    expect(pedidoComposto({ modulos: [] })).toBe(false);
    expect(pedidoComposto({})).toBe(false);
  });

  it("submódulos do MESMO módulo não contam como dois assuntos", () => {
    expect(pedidoComposto({ modulos: ["PAGAMENTO/FOLHA", "PAGAMENTO/RECIBO"] })).toBe(false);
  });

  it("normaliza caixa e espaço antes de contar", () => {
    expect(pedidoComposto({ modulos: [" férias ", "FÉRIAS"] })).toBe(false);
  });

  it("os outros dois sinais bastam sozinhos", () => {
    expect(pedidoComposto({ compostoPorTool: true })).toBe(true);
    expect(pedidoComposto({ lexico: true })).toBe(true);
  });
});
