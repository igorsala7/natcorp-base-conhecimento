import { describe, it, expect } from "vitest";
import { escopoAcessoDirective } from "./report-tools";

const EU = { matricula: "365785", empresa: "700" };

describe("escopoAcessoDirective — identidade do usuário no prompt", () => {
  it("PO recebe a própria matrícula e empresa", () => {
    const d = escopoAcessoDirective("PO", "MASTER", EU);
    expect(d).toContain("365785");
    expect(d).toContain("700");
  });

  it("PG também recebe — um gestor pede os próprios dados como qualquer um", () => {
    expect(escopoAcessoDirective("PG", "GESTOR", EU)).toContain("365785");
  });

  it("PC NÃO recebe: ali a regra é deixar a matrícula VAZIA (o escopo injeta a dele)", () => {
    const d = escopoAcessoDirective("PC", "PORTAL", EU);
    expect(d).not.toContain("365785");
    expect(d).toContain("VAZIA");
  });

  it("sem identidade no token, nada é inventado", () => {
    const d = escopoAcessoDirective("PO", "MASTER", { matricula: null, empresa: null });
    expect(d).not.toContain("QUEM ESTÁ FALANDO");
  });

  it("enuncia os TRÊS casos — a identidade é informação, não filtro fixo", () => {
    const d = escopoAcessoDirective("PO", "MASTER", EU);
    expect(d).toContain("NÃO é um filtro fixo");
    // (1) o próprio, (2) outra pessoa, (3) amplo/sem filtro. O caso (3) é o que se
    // perde quando alguém "conserta" isto fixando a identidade no parâmetro:
    // "quantos colaboradores tenho" viraria uma contagem de 1.
    expect(d).toMatch(/pr[óo]pria pessoa/i);
    expect(d).toMatch(/OUTRA pessoa/i);
    expect(d).toMatch(/EM BRANCO/);
    expect(d).toMatch(/100% do escopo/i);
  });

  it("só a empresa também vale (usuário sem matrícula no token)", () => {
    const d = escopoAcessoDirective("PO", "MASTER", { empresa: "700" });
    // Só o bloco de identidade importa: "matrícula" aparece legitimamente noutras
    // partes fixas da diretriz (como consultar OUTRA pessoa).
    // Só a lista de VALORES importa aqui (o resto da instrução cita "matrícula"
    // legitimamente, ao explicar os três casos).
    const bloco = d.slice(d.indexOf("QUEM ESTÁ FALANDO"), d.indexOf("Isto NÃO é um filtro fixo"));
    expect(bloco).toContain("empresa 700");
    expect(bloco).not.toContain("matrícula");
  });
});
