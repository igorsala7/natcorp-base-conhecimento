import { describe, it, expect } from "vitest";
import { rateLimitOk, maskPhone } from "./util";

describe("rateLimitOk", () => {
  it("libera até o limite e barra o excedente (por remetente)", () => {
    const key = "5511999" + Math.random().toString().slice(2, 8);
    let liberadas = 0;
    for (let i = 0; i < 20; i++) if (rateLimitOk(key)) liberadas++;
    expect(liberadas).toBe(15); // MAX por janela
    expect(rateLimitOk(key)).toBe(false);
  });

  it("remetentes diferentes não interferem", () => {
    const a = "a" + Math.random();
    const b = "b" + Math.random();
    expect(rateLimitOk(a)).toBe(true);
    expect(rateLimitOk(b)).toBe(true);
  });
});

describe("maskPhone", () => {
  it("mantém só os 4 últimos dígitos", () => {
    expect(maskPhone("5511988202334")).toBe("***2334");
    expect(maskPhone("123")).toBe("****");
  });
});
