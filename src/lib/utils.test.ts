import { describe, expect, it } from "vitest";
import { cn } from "./utils";

/**
 * Smoke test — existe para dar sentido ao CI desde a Fase 0.
 * Testa o utilitário de classes (resolução de conflito do Tailwind).
 */
describe("cn", () => {
  it("junta classes", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("resolve conflitos do tailwind (a última vence)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("aplica classes condicionais", () => {
    expect(cn("base", false && "off", true && "on")).toBe("base on");
  });
});
