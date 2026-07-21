import { describe, it, expect } from "vitest";
import { limitarHistorico, MAX_MENSAGENS } from "./history";

const msg = (role: "user" | "assistant", content: string) => ({ role, content });

describe("limitarHistorico", () => {
  it("entrada que não é array vira lista vazia", () => {
    expect(limitarHistorico(undefined)).toEqual([]);
    expect(limitarHistorico(null)).toEqual([]);
    expect(limitarHistorico("texto")).toEqual([]);
  });

  it("conversa curta passa intacta", () => {
    const h = [msg("user", "oi"), msg("assistant", "olá")];
    expect(limitarHistorico(h)).toEqual(h);
  });

  it("mantém as ÚLTIMAS mensagens — a pergunta atual é a que importa", () => {
    const h = Array.from({ length: 60 }, (_, i) => msg("user", `m${i}`));
    const out = limitarHistorico(h);
    expect(out).toHaveLength(MAX_MENSAGENS);
    expect(out.at(-1)!.content).toBe("m59");
  });

  it("trunca mensagem gigante em vez de descartá-la", () => {
    const out = limitarHistorico([msg("user", "a".repeat(50_000))]);
    expect(out).toHaveLength(1);
    expect(out[0]!.content.length).toBe(8_000);
  });

  it("respeita o teto total descartando o histórico ANTIGO", () => {
    const h = Array.from({ length: 20 }, (_, i) => msg("user", `${i}` + "x".repeat(5_000)));
    const out = limitarHistorico(h);
    const total = out.reduce((n, m) => n + m.content.length, 0);
    expect(total).toBeLessThanOrEqual(24_000);
    // A última mensagem sobrevive sempre.
    expect(out.at(-1)!.content.startsWith("19")).toBe(true);
  });

  it("a pergunta atual sobrevive mesmo sozinha estourando o total", () => {
    const out = limitarHistorico([msg("user", "antiga"), msg("user", "b".repeat(8_000))]);
    expect(out.at(-1)!.content.length).toBe(8_000);
  });

  it("descarta entradas malformadas e vazias", () => {
    const out = limitarHistorico([
      msg("user", "válida"),
      { role: "hacker", content: "injeção" },
      { role: "user" },
      { role: "user", content: "   " },
      null,
    ]);
    expect(out).toEqual([msg("user", "válida")]);
  });
});
