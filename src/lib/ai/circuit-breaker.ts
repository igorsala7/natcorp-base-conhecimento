import "server-only";
import { getInfraSync } from "@/lib/settings/infra";

/**
 * Disjuntor (circuit breaker) por provedor+modelo. Quando o provedor de LLM
 * começa a falhar em série (429/5xx/timeout/rede), ABRE o circuito por um
 * cooldown e as chamadas falham RÁPIDO — em vez de martelar o provedor e
 * segurar réplicas web esperando. Estado em memória por instância (cada réplica
 * se protege). Limites do BANCO (infra_settings) via snapshot sync.
 */

type Estado = { falhas: number[]; abertoAte: number };
const estados = new Map<string, Estado>();

export class CircuitOpenError extends Error {
  constructor(provider: string) {
    super(`Provedor de IA (${provider}) temporariamente indisponível. Tente novamente em instantes.`);
    this.name = "CircuitOpenError";
  }
}

function est(key: string): Estado {
  let e = estados.get(key);
  if (!e) {
    e = { falhas: [], abertoAte: 0 };
    estados.set(key, e);
  }
  return e;
}

export function circuitoAberto(key: string): boolean {
  return est(key).abertoAte > Date.now();
}

export function registrarSucesso(key: string): void {
  const e = est(key);
  e.falhas = [];
  e.abertoAte = 0;
}

/** Só falhas de PROVEDOR (429/5xx/timeout/rede) contam para o disjuntor —
 *  erros de payload/validação (400) não abrem o circuito. */
export function ehFalhaDeProvedor(err: unknown): boolean {
  const e = err as { statusCode?: number; status?: number; message?: string; name?: string } | null;
  const code = e?.statusCode ?? e?.status;
  if (typeof code === "number" && (code === 429 || code >= 500)) return true;
  const msg = `${e?.name ?? ""} ${e?.message ?? ""}`.toLowerCase();
  return /timeout|timed out|econnreset|econnrefused|enotfound|fetch failed|network|socket hang|rate.?limit|overloaded|too many requests|service unavailable|\b(500|502|503|504)\b/.test(
    msg,
  );
}

export function registrarFalha(key: string, err: unknown): void {
  if (!ehFalhaDeProvedor(err)) return;
  const { cbFailures, cbWindowMs, cbCooldownMs } = getInfraSync();
  const e = est(key);
  const agora = Date.now();
  e.falhas = e.falhas.filter((t) => agora - t < cbWindowMs);
  e.falhas.push(agora);
  if (e.falhas.length >= cbFailures) {
    e.abertoAte = agora + cbCooldownMs;
    e.falhas = [];
    console.error(`[circuit] ABERTO para ${key} por ${cbCooldownMs}ms (${cbFailures} falhas de provedor)`);
  }
}

/** Snapshot para o endpoint de métricas. */
export function circuitSnapshot(): { key: string; aberto: boolean; falhas: number }[] {
  const agora = Date.now();
  const { cbWindowMs } = getInfraSync();
  return [...estados.entries()].map(([key, e]) => ({
    key,
    aberto: e.abertoAte > agora,
    falhas: e.falhas.filter((t) => agora - t < cbWindowMs).length,
  }));
}
