import { describe, it, expect } from "vitest";
import { PASSOS_IMPORT, passoDoJob, parseLog, isTerminal } from "./status";

describe("passos da importação", () => {
  it("job em curso acende o passo do próprio estado", () => {
    expect(passoDoJob("extracting", [])).toEqual({ atual: "extracting", falhou: false });
    expect(passoDoJob("preview", [])).toEqual({ atual: "preview", falhou: false });
  });

  it("concluído acende o último passo, sem erro", () => {
    expect(passoDoJob("done", [])).toEqual({ atual: "improving", falhou: false });
  });

  it("erro marca ONDE parou, lendo o log de trás para frente", () => {
    // Saber que quebrou "na extração" e não "na importação" é a diferença entre
    // suspeitar do arquivo e suspeitar do destino.
    const log = parseLog([
      { at: "1", msg: "Na fila" },
      { at: "2", msg: "Extraindo texto do PDF" },
      { at: "3", msg: "Inferindo estrutura a partir dos títulos" },
      { at: "4", msg: "falha ao chamar a IA" },
    ]);
    expect(passoDoJob("error", log)).toEqual({ atual: "inferring", falhou: true });
  });

  it("erro sem pista no log culpa a extração, não a fila", () => {
    // "Na fila" nunca falha sozinho; apontá-la mandaria olhar o lugar errado.
    expect(passoDoJob("error", [])).toEqual({ atual: "extracting", falhou: true });
  });

  it("todo passo tem rótulo em português e chave conhecida", () => {
    for (const p of PASSOS_IMPORT) {
      expect(p.rotulo.length).toBeGreaterThan(2);
      expect(p.key).toMatch(/^[a-z]+$/);
    }
  });

  it("preview é terminal — o job espera a pessoa, não o worker", () => {
    expect(isTerminal("preview")).toBe(true);
    expect(isTerminal("extracting")).toBe(false);
  });
});
