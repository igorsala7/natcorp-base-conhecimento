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

/**
 * Núcleos de nome que denunciam segredo. Testados por SUBSTRING sobre o nome
 * normalizado — o casamento exato de antes deixava passar toda a convenção das
 * APIs ORDS deste projeto (`p_key`, `p_session_key`, `token_acesso`) sempre que
 * o valor fosse cadastrado como `origem='fixo'` em vez de credencial, um erro
 * de cadastro perfeitamente plausível na tela.
 */
const NUCLEOS_SEGREDO = ["key", "token", "secret", "senha", "password", "auth", "cookie", "session", "credential"];

/** Tira prefixo `p_`/`x-`, uniformiza separadores. `X-Session-Key` → `session_key`. */
function normalizarNome(nome: string): string {
  return nome.toLowerCase().replace(/[-\s]/g, "_").replace(/^(p_|x_)/, "");
}

export function nomeSensivel(nome: string, params: ToolParam[]): boolean {
  return sensivel(nome, nomesCredenciais(params));
}

function sensivel(nome: string, cred: Set<string>): boolean {
  const n = nome.toLowerCase();
  if (SEGREDO_NOMES.has(n) || cred.has(n)) return true;
  const norm = normalizarNome(nome);
  return NUCLEOS_SEGREDO.some((nucleo) => norm.includes(nucleo));
}

/**
 * Valor mínimo para redação por VALOR. Abaixo disso o `replaceAll` destruiria a
 * URL: um segredo cadastrado como "1" transformaria toda ocorrência do dígito 1
 * em `***`.
 */
const MIN_VALOR_REDIGIVEL = 6;

/**
 * Redige na URL os valores de params sensíveis.
 *
 * Duas camadas, porque uma só não cobre onde o segredo pode estar:
 *  1. por NOME, nos query params — o caso comum (`?key=...`);
 *  2. por VALOR, na URL inteira — o caminho. `path_template` aceita `{param}` de
 *     `origem='credencial'` exatamente como a query, e um endpoint no estilo
 *     `/ords/{key}/rh/v1/...` colocava o session_key no pathname, onde a busca
 *     por nome não tem o que morder. `rawPath` tem o mesmo furo.
 */
export function sanitizarUrl(url: string, params: ToolParam[], valoresSensiveis?: string[]): string {
  const cred = nomesCredenciais(params);
  let saida: string;
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (sensivel(k, cred)) u.searchParams.set(k, "***");
    }
    saida = u.toString();
  } catch {
    saida = url;
  }
  for (const v of valoresSensiveis ?? []) {
    if (!v || v.length < MIN_VALOR_REDIGIVEL) continue;
    saida = saida.replaceAll(v, "***").replaceAll(encodeURIComponent(v), "***");
  }
  return saida;
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
