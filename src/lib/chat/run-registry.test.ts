import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clienteSumiu,
  encerrarRun,
  motivoDaRun,
  pararRun,
  registrarRun,
  runIdValido,
  runsEmVoo,
  TETO_ORFAO_MS,
} from "./run-registry";

afterEach(() => {
  vi.useRealTimers();
});

describe("runIdValido", () => {
  it("aceita uuid e nanoid", () => {
    expect(runIdValido("3f2b9c10-4a5d-4e2f-9b77-0c1d2e3f4a5b")).toBeTruthy();
    expect(runIdValido("V1StGXR8_Z5jdHi6B-myT")).toBeTruthy();
  });

  it("recusa o que viraria chave permanente no Map", () => {
    // Id gigante ou com lixo é vazamento de memória acionável de fora.
    expect(runIdValido("a".repeat(65))).toBeNull();
    expect(runIdValido("curto")).toBeNull();
    expect(runIdValido("id com espaço")).toBeNull();
    expect(runIdValido({ id: "x" })).toBeNull();
    expect(runIdValido(undefined)).toBeNull();
  });
});

describe("parar × desconectar", () => {
  it("PARAR aborta na hora", () => {
    const c = registrarRun("run-parar-0001");
    expect(pararRun("run-parar-0001")).toBe(true);
    expect(c.signal.aborted).toBe(true);
    expect(motivoDaRun("run-parar-0001")).toBe("parou");
    encerrarRun("run-parar-0001");
  });

  it("DESCONECTAR não aborta — é a razão de este módulo existir", () => {
    vi.useFakeTimers();
    const c = registrarRun("run-sumiu-0001");
    clienteSumiu("run-sumiu-0001");
    // Passaram 9min59s: a resposta ainda está sendo gerada e será gravada.
    vi.advanceTimersByTime(TETO_ORFAO_MS - 1000);
    expect(c.signal.aborted).toBe(false);
    encerrarRun("run-sumiu-0001");
  });

  it("o teto corta o órfão em 10 minutos", () => {
    vi.useFakeTimers();
    const c = registrarRun("run-teto-00001");
    clienteSumiu("run-teto-00001");
    vi.advanceTimersByTime(TETO_ORFAO_MS + 1);
    expect(c.signal.aborted).toBe(true);
    expect(motivoDaRun("run-teto-00001")).toBe("teto");
    encerrarRun("run-teto-00001");
  });

  it("parar depois de desconectar continua valendo", () => {
    vi.useFakeTimers();
    const c = registrarRun("run-ambos-0001");
    clienteSumiu("run-ambos-0001");
    expect(pararRun("run-ambos-0001")).toBe(true);
    expect(c.signal.aborted).toBe(true);
    expect(motivoDaRun("run-ambos-0001")).toBe("parou");
    encerrarRun("run-ambos-0001");
  });

  it("parar um id desconhecido não explode", () => {
    expect(pararRun("nao-existe-0001")).toBe(false);
  });
});

describe("higiene do registro", () => {
  it("encerrar limpa a entrada — senão o Map cresce para sempre", () => {
    const antes = runsEmVoo();
    registrarRun("run-limpa-0001");
    expect(runsEmVoo()).toBe(antes + 1);
    encerrarRun("run-limpa-0001");
    expect(runsEmVoo()).toBe(antes);
  });

  it("reenvio do mesmo id aborta o anterior", () => {
    // Dois streams gravando a mesma conversa é pior que perder o primeiro.
    const a = registrarRun("run-dup-000001");
    const b = registrarRun("run-dup-000001");
    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(false);
    expect(runsEmVoo()).toBeGreaterThan(0);
    encerrarRun("run-dup-000001");
  });

  it("o teto não sobrevive ao encerramento", () => {
    vi.useFakeTimers();
    const c = registrarRun("run-teto-limpo1");
    clienteSumiu("run-teto-limpo1");
    encerrarRun("run-teto-limpo1");
    vi.advanceTimersByTime(TETO_ORFAO_MS * 2);
    // Já foi gravada e encerrada: abortar agora seria mexer em run alheia.
    expect(c.signal.aborted).toBe(false);
  });
});
