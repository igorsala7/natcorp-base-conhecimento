import { describe, it, expect } from "vitest";
import { mesmoEmail } from "@/lib/chat/meus-dados";

describe("mesmoEmail", () => {
  it("ignora caixa e espaços — não distinguem caixa postal", () => {
    expect(mesmoEmail("Maria@Empresa.com", " maria@empresa.com ")).toBe(true);
  });

  it("contas diferentes não passam", () => {
    expect(mesmoEmail("maria@empresa.com", "maria@gmail.com")).toBe(false);
  });

  // O ponto de segurança: o callback só bloqueia quando SABE o alvo. Se vazio
  // fosse "igual", uma conta sem e-mail no perfil passaria pela checagem como
  // se tivesse sido validada.
  it("vazio nunca casa com vazio", () => {
    expect(mesmoEmail(null, null)).toBe(false);
    expect(mesmoEmail("", "")).toBe(false);
    expect(mesmoEmail(undefined, "maria@empresa.com")).toBe(false);
    expect(mesmoEmail("maria@empresa.com", null)).toBe(false);
  });
});
