import type { ToolParam } from "./tools";

/**
 * Sanitização do log de execução (puro, testável). Nunca deixa segredo entrar no
 * `ai_tool_runs`: redige valores sensíveis na URL e no corpo (por nome conhecido
 * e por parâmetros `origem='credencial'`) e trunca a saída numa amostra.
 */

/** Nomes de campo/param cujo VALOR é sempre mascarado no log. */
export const SEGREDO_NOMES = new Set([
  "key",
  "session_key",
  "token",
  "access_token",
  "refresh_token",
  "client_secret",
  "client_id",
  "secret",
  "password",
  "senha",
  "apikey",
  "api_key",
  "authorization",
  "auth",
]);

function nomesCredenciais(params: ToolParam[]): Set<string> {
  return new Set(params.filter((p) => p.origem === "credencial").map((p) => p.nome.toLowerCase()));
}

function sensivel(nome: string, cred: Set<string>): boolean {
  const n = nome.toLowerCase();
  return SEGREDO_NOMES.has(n) || cred.has(n);
}

/** Redige na URL os valores de query params sensíveis (por nome ou origem=credencial). */
export function sanitizarUrl(url: string, params: ToolParam[]): string {
  const cred = nomesCredenciais(params);
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (sensivel(k, cred)) u.searchParams.set(k, "***");
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Redige, num objeto/JSON, os campos sensíveis (recursivo). */
export function sanitizarBody(body: string | undefined, params: ToolParam[]): unknown {
  if (!body) return undefined;
  let obj: unknown;
  try {
    obj = JSON.parse(body);
  } catch {
    return "(corpo não-JSON)";
  }
  const cred = nomesCredenciais(params);
  const redigir = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(redigir);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = sensivel(k, cred) ? "***" : redigir(val);
      }
      return out;
    }
    return v;
  };
  return redigir(obj);
}

const MAX_PREVIEW = 4000;

/** Amostra truncada da saída (bytes originais + prévia). */
export function previewSaida(data: unknown): { bytes: number; truncated: boolean; preview: string } {
  let s: string;
  try {
    s = typeof data === "string" ? data : JSON.stringify(data);
  } catch {
    s = String(data);
  }
  s = s ?? "";
  const truncated = s.length > MAX_PREVIEW;
  return { bytes: s.length, truncated, preview: truncated ? `${s.slice(0, MAX_PREVIEW)}…` : s };
}
