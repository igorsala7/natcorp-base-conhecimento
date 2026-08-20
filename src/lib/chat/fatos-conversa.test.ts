import { describe, it, expect } from "vitest";
import { extrairFatos, mesclarFatos, blocoDeFatos, temPeriodoFixado, MAX_FATOS, type Fato } from "./fatos-conversa";

const em = (d: string) => `2026-08-20T${d}:00.000Z`;

describe("extrairFatos", () => {
  it("pega os parâmetros da chamada que deu certo, normalizando o nome", () => {
    const f = extrairFatos([
      { tool: "historico_financeiro", ok: true, params: { p_matricula: "205818", data_ini: "2025-02-01", cod_centro_custo: "10970104" } },
    ], em("10"));
    expect(f.map((x) => x.chave).sort()).toEqual(["centro_custo", "matricula", "periodo_ini"]);
    expect(f.find((x) => x.chave === "matricula")!.valor).toBe("205818");
  });

  it("IGNORA chamada que falhou — parâmetro pode ter sido o motivo da recusa", () => {
    expect(extrairFatos([{ tool: "x", ok: false, params: { matricula: "999" } }])).toHaveLength(0);
  });

  it("aceita lista de um item e descarta lista múltipla", () => {
    const um = extrairFatos([{ tool: "t", ok: true, params: { matricula: ["205818"] } }]);
    expect(um[0]!.valor).toBe("205818");
    expect(extrairFatos([{ tool: "t", ok: true, params: { matricula: ["1", "2"] } }])).toHaveLength(0);
  });

  it("descarta o que não identifica nada", () => {
    for (const p of [{ matricula: "" }, { matricula: "todos" }, { matricula: null }, { matricula: { a: 1 } }]) {
      expect(extrairFatos([{ tool: "t", ok: true, params: p }]), JSON.stringify(p)).toHaveLength(0);
    }
  });

  it("não guarda nome nem valor — só código e data", () => {
    const f = extrairFatos([{ tool: "t", ok: true, params: { nome: "Tony Oliveira", salario: "12500.00", matricula: "205818" } }]);
    expect(f).toHaveLength(1);
    expect(f[0]!.chave).toBe("matricula");
  });
});

describe("mesclarFatos", () => {
  it("o mais RECENTE de cada chave vence — abril substitui março", () => {
    const antes: Fato[] = [{ chave: "competencia", valor: "2025-03", tool: "t", em: em("10") }];
    const agora: Fato[] = [{ chave: "competencia", valor: "2025-04", tool: "t", em: em("11") }];
    const r = mesclarFatos(antes, agora);
    expect(r).toHaveLength(1);
    expect(r[0]!.valor).toBe("2025-04");
  });

  it("não deixa o antigo sobrescrever o novo", () => {
    const novo: Fato[] = [{ chave: "matricula", valor: "205818", tool: "t", em: em("12") }];
    const velho: Fato[] = [{ chave: "matricula", valor: "111", tool: "t", em: em("09") }];
    expect(mesclarFatos(novo, velho)[0]!.valor).toBe("205818");
  });

  it("respeita o teto, mantendo os mais recentes", () => {
    const muitos: Fato[] = Array.from({ length: MAX_FATOS + 6 }, (_, i) => ({
      chave: `k${i}`, valor: String(i), tool: "t", em: em(String(10 + (i % 10)).padStart(2, "0")),
    }));
    expect(mesclarFatos([], muitos)).toHaveLength(MAX_FATOS);
  });
});

describe("blocoDeFatos", () => {
  it("vazio não vira bloco — nem um cabeçalho", () => {
    expect(blocoDeFatos([])).toBe("");
  });

  it("é curto e diz que a mensagem atual vence", () => {
    const b = blocoDeFatos([
      { chave: "centro_custo", valor: "10970104", tool: "t", em: em("10") },
      { chave: "competencia", valor: "2025-03", tool: "t", em: em("10") },
    ]);
    expect(b).toContain("centro de custo: 10970104");
    expect(b).toContain("competência: 2025-03");
    expect(b).toMatch(/o dela vence/);
    // Entra em TODO turno: precisa caber em poucas centenas de caracteres.
    expect(b.length).toBeLessThan(700);
  });
});

describe("temPeriodoFixado", () => {
  it("reconhece período e competência", () => {
    expect(temPeriodoFixado([{ chave: "periodo_ini", valor: "2025-02-01", tool: "t", em: em("10") }])).toBe(true);
    expect(temPeriodoFixado([{ chave: "competencia", valor: "2025-03", tool: "t", em: em("10") }])).toBe(true);
  });

  it("matrícula sozinha não é período", () => {
    expect(temPeriodoFixado([{ chave: "matricula", valor: "205818", tool: "t", em: em("10") }])).toBe(false);
  });
});
