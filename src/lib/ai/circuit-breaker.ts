import "server-only";

/**
 * Disjuntor (circuit breaker) por provedor+modelo. Quando o provedor de LLM
 * começa a falhar em série (429/5xx/timeout/rede), ABRE o circuito por um
 * cooldown e as chamadas falham RÁPIDO — em vez de martelar o provedor e
 * segurar réplicas web esperando. Estado em memória por instância (cada réplica
 * se protege). Complementa o retry nativo do SDK.
 */

type Estado = { falhas: number[]; abertoAte: number };
const estados = new Map<string, Estado>();

const LIMITE = Number(process.env.AI_CB_FAILURES ?? 5); // falhas na janela p/ abrir
const JANELA_MS = Number(process.env.AI_CB_WINDOW_MS ?? 30_000);
const COOLDOWN_MS = Number(process.env.AI_CB_COOLDOWN_MS ?? 20_000);

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
  const e = est(key);
  const agora = Date.now();
  e.falhas = e.falhas.filter((t) => agora - t < JANELA_MS);
  e.falhas.push(agora);
  if (e.falhas.length >= LIMITE) {
    e.abertoAte = agora + COOLDOWN_MS;
    e.falhas = [];
    console.error(`[circuit] ABERTO para ${key} por ${COOLDOWN_MS}ms (${LIMITE} falhas de provedor)`);
  }
}

/** Snapshot para o endpoint de métricas. */
export function circuitSnapshot(): { key: string; aberto: boolean; falhas: number }[] {
  const agora = Date.now();
  return [...estados.entries()].map(([key, e]) => ({
    key,
    aberto: e.abertoAte > agora,
    falhas: e.falhas.filter((t) => agora - t < JANELA_MS).length,
  }));
}
