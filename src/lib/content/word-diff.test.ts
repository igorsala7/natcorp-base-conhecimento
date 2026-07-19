import { describe, it, expect } from "vitest";
import { wordDiff } from "./word-diff";

const text = (ops: ReturnType<typeof wordDiff>, side: "a" | "b") =>
  ops
    .filter((o) => o.type === "eq" || (side === "a" ? o.type === "del" : o.type === "ins"))
    .map((o) => o.text)
    .join("");

describe("wordDiff", () => {
  it("iguais → sem inserção/remoção", () => {
    const ops = wordDiff("um dois três", "um dois três");
    expect(ops.every((o) => o.type === "eq")).toBe(true);
  });

  it("detecta inserção", () => {
    const ops = wordDiff("um dois", "um dois três");
    expect(ops.some((o) => o.type === "ins" && o.text.includes("três"))).toBe(true);
    expect(ops.some((o) => o.type === "del")).toBe(false);
  });

  it("detecta remoção", () => {
    const ops = wordDiff("um dois três", "um dois");
    expect(ops.some((o) => o.type === "del" && o.text.includes("três"))).toBe(true);
  });

  it("reconstrói os dois lados", () => {
    const a = "o rato roeu a roupa";
    const b = "o gato roeu a roupa do rei";
    const ops = wordDiff(a, b);
    expect(text(ops, "a")).toBe(a);
    expect(text(ops, "b")).toBe(b);
  });
});
