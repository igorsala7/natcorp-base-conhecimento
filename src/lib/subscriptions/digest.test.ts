import { describe, it, expect } from "vitest";
import { frequenciaDue } from "./rules";

// 2026-07-20 é segunda-feira.
const seg12 = new Date("2026-07-20T12:10:00Z");
const ter12 = new Date("2026-07-21T12:10:00Z");
const seg08 = new Date("2026-07-20T08:00:00Z");

describe("frequenciaDue", () => {
  it("instant: todo tick", () => {
    expect(frequenciaDue("instant", seg08, null)).toBe(true);
    expect(frequenciaDue("instant", seg08, seg08.toISOString())).toBe(true);
  });

  it("daily: só na janela das 12h UTC e com 20h desde o último envio", () => {
    expect(frequenciaDue("daily", seg08, null)).toBe(false); // fora da janela
    expect(frequenciaDue("daily", seg12, null)).toBe(true); // primeira vez, na janela
    const ontem = new Date(seg12.getTime() - 24 * 3_600_000).toISOString();
    expect(frequenciaDue("daily", seg12, ontem)).toBe(true);
    const haPouco = new Date(seg12.getTime() - 3_600_000).toISOString();
    expect(frequenciaDue("daily", seg12, haPouco)).toBe(false); // já enviou hoje
  });

  it("weekly: segunda 12h UTC, com ao menos 6 dias do último", () => {
    expect(frequenciaDue("weekly", seg12, null)).toBe(true);
    expect(frequenciaDue("weekly", ter12, null)).toBe(false); // terça não
    const semanaPassada = new Date(seg12.getTime() - 7 * 86_400_000).toISOString();
    expect(frequenciaDue("weekly", seg12, semanaPassada)).toBe(true);
    const anteontem = new Date(seg12.getTime() - 2 * 86_400_000).toISOString();
    expect(frequenciaDue("weekly", seg12, anteontem)).toBe(false);
  });
});
