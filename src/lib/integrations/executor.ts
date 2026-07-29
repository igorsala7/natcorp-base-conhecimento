import type { AuthType } from "./credentials";
import type { ToolParam } from "./tools";
import { resolveParams, type Identity, type ResolvedBuckets } from "./params";
import { getOAuthToken, invalidateOAuthToken } from "./oauth";

/** A tool como o motor precisa dela (subconjunto de ai_tools). */
export type RuntimeTool = {
  key: string;
  name: string;
  description?: string;
  method: string;
  path_template: string;
  auth_type: AuthType;
  params: ToolParam[];
  response_hint?: string | null;
};

/** Credencial já DECIFRADA (o motor recebe o blob em claro; nunca a tela). */
export type RuntimeCredential = {
  id: string;
  auth_type: AuthType;
  secret: Record<string, string>;
};

export type ExecInput = {
  tool: RuntimeTool;
  baseUrl: string;
  credential: RuntimeCredential | null;
  /** Valores que a IA extraiu (só os params origem='modelo'). */
  modelArgs: Record<string, unknown>;
  /** Identidade confiável, decifrada do token. */
  identity: Identity;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type ExecResult = { ok: boolean; status: number; data: unknown };

/** Monta a requisição HTTP a partir dos buckets resolvidos (função pura). */
export function buildHttpRequest(
  tool: RuntimeTool,
  baseUrl: string,
  buckets: ResolvedBuckets,
): { url: string; method: string; headers: Record<string, string>; body?: string } {
  // Substitui {param} no caminho.
  let path = tool.path_template;
  for (const [k, v] of Object.entries(buckets.path)) {
    path = path.replaceAll(`{${k}}`, encodeURIComponent(v));
  }
  const base = baseUrl.replace(/\/+$/, "");
  const rel = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  const url = new URL(base + rel);
  for (const [k, v] of Object.entries(buckets.query)) url.searchParams.set(k, v);

  const headers: Record<string, string> = { ...buckets.header };
  const method = tool.method.toUpperCase();
  let body: string | undefined;
  if (method !== "GET" && method !== "DELETE" && Object.keys(buckets.body).length > 0) {
    body = JSON.stringify(buckets.body);
    headers["Content-Type"] = "application/json";
  }
  return { url: url.toString(), method, headers, body };
}

/** Cabeçalho de autenticação por tipo. OAuth busca/renova o token (cacheado). */
async function authHeaders(
  cred: RuntimeCredential | null,
  fetchImpl: typeof fetch,
): Promise<Record<string, string>> {
  if (!cred || cred.auth_type === "none") return {};
  const s = cred.secret;
  switch (cred.auth_type) {
    case "basic":
      return {
        Authorization: "Basic " + Buffer.from(`${s.username ?? ""}:${s.password ?? ""}`).toString("base64"),
      };
    case "bearer":
      return { Authorization: `Bearer ${s.token ?? ""}` };
    case "api_key":
      return { [s.header_name?.trim() || "Authorization"]: s.api_key ?? "" };
    case "oauth2": {
      const token = await getOAuthToken(cred.id, s, fetchImpl);
      return { Authorization: `Bearer ${token}` };
    }
    default:
      return {};
  }
}

/**
 * Executa uma tool: resolve params (identidade + máscara), monta a requisição,
 * autentica e chama a API. No 401 de OAuth, invalida o token e tenta 1×.
 */
export async function executeTool(input: ExecInput): Promise<ExecResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const buckets = resolveParams(input.tool.params, input.modelArgs, input.identity);
  const req = buildHttpRequest(input.tool, input.baseUrl, buckets);

  const auth = await authHeaders(input.credential, fetchImpl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 15_000);
  try {
    let res = await fetchImpl(req.url, {
      method: req.method,
      headers: { ...req.headers, ...auth },
      body: req.body,
      signal: controller.signal,
    });

    if (res.status === 401 && input.credential?.auth_type === "oauth2") {
      invalidateOAuthToken(input.credential.id);
      const auth2 = await authHeaders(input.credential, fetchImpl);
      res = await fetchImpl(req.url, {
        method: req.method,
        headers: { ...req.headers, ...auth2 },
        body: req.body,
        signal: controller.signal,
      });
    }

    const text = await res.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* resposta não-JSON: devolve o texto cru */
    }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}
