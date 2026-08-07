import { describe, it, expect } from "vitest";
import { mesclarPiso, VOCABULARIO_RH } from "./vocabulario-rh";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
type E = { matchNorms: string[]; forms: string[] };
const criar = (matchNorms: string[], forms: string[]): E => ({ matchNorms, forms });
const doPiso = (r: E[], termo: string) => r.find((e) => e.forms[0] === termo);

describe("VOCABULARIO_RH", () => {
  it("cobre os assuntos que o RH usa todo dia", () => {
    const termos = new Set(VOCABULARIO_RH.map((t) => t.termo));
    for (const t of ["holerite", "banco de horas", "período aquisitivo", "rescisão", "eSocial", "ASO", "CAT", "centro de custo", "headcount", "vale transporte"]) {
      expect(termos.has(t), t).toBe(true);
    }
  });

  it("nenhum termo se repete entre entradas (evita expansão cruzada)", () => {
    const vistos = new Set<string>();
    for (const t of VOCABULARIO_RH) {
      for (const f of [t.termo, ...t.sinonimos]) {
        const n = norm(f);
        expect(vistos.has(n), `forma duplicada: ${f}`).toBe(false);
        vistos.add(n);
      }
    }
  });
});

/**
 * O piso NUNCA pode sobrepor o vocabulário do cliente: quem cadastrou "folha" com
 * outro sentido tem razão sobre a base dele. Herdar metade dos sinônimos produziria
 * expansão cruzada — pior que expansão nenhuma —, então o conflito derruba a entrada
 * inteira.
 */
describe("mesclarPiso", () => {
  it("base sem ontologia recebe o piso inteiro", () => {
    const r = mesclarPiso<E>([], VOCABULARIO_RH, norm, criar);
    expect(r.length).toBe(VOCABULARIO_RH.length);
    expect(doPiso(r, "holerite")!.forms).toContain("contracheque");
  });

  it("termo do cliente VENCE e derruba a entrada do piso inteira", () => {
    const cliente: E[] = [{ matchNorms: ["folha de pagamento"], forms: ["Folha de Pagamento", "Folha Mensal"] }];
    const r = mesclarPiso(cliente, VOCABULARIO_RH, norm, criar);
    // A entrada do piso "folha de pagamento" não entrou — nem parcialmente.
    expect(doPiso(r, "folha de pagamento")).toBeUndefined();
    // E as outras entradas do piso continuam lá.
    expect(doPiso(r, "holerite")).toBeDefined();
  });

  it("conflito por SINÔNIMO também derruba a entrada", () => {
    const cliente: E[] = [{ matchNorms: [norm("contracheque")], forms: ["Contracheque"] }];
    const r = mesclarPiso(cliente, VOCABULARIO_RH, norm, criar);
    expect(doPiso(r, "holerite")).toBeUndefined();
  });

  it("o cliente vem sempre primeiro na lista", () => {
    const cliente: E[] = [{ matchNorms: ["xpto"], forms: ["XPTO"] }];
    const r = mesclarPiso(cliente, VOCABULARIO_RH, norm, criar);
    expect(r[0]!.forms[0]).toBe("XPTO");
  });

  it("VOCAB_RH_PISO=0 desliga o piso", () => {
    const antes = process.env.VOCAB_RH_PISO;
    process.env.VOCAB_RH_PISO = "0";
    expect(mesclarPiso<E>([], VOCABULARIO_RH, norm, criar)).toHaveLength(0);
    if (antes === undefined) delete process.env.VOCAB_RH_PISO; else process.env.VOCAB_RH_PISO = antes;
  });
});
