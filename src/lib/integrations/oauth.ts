/**
 * Token OAuth2 (client_credentials) por credencial, com CACHE em memória.
 *
 * O deploy é um processo longo (web/worker), então um cache em processo já evita
 * bater no servidor de token a cada mensagem. Expira com folga (−60s) e é
 * invalidado no 401 para renovar na hora.
 *
 * Autenticação do cliente: dois estilos convivem no mundo real —
 *  - `client_secret_post`  → client_id/secret no CORPO (form-urlencoded);
 *  - `client_secret_basic` → client_id/secret no header `Authorization: Basic`.
 * Tentamos o corpo primeiro (compatível com o comportamento anterior) e, se o
 * servidor recusar, caímos para Basic (exigido por ORDS/APEX e vários outros).
 * O estilo que funcionou fica memorizado por credencial para não repetir a
 * tentativa nas próximas renovações.
 */

import { montarTrace, resumirCorpoErro, type ChamadaTrace } from "./http-trace";

type Cached = { token: string; exp: number };
type Style = "body" | "basic";
const cache = new Map<string, Cached>();
const styleMemo = new Map<string, Style>();

export function invalidateOAuthToken(credId: string): void {
  cache.delete(credId);
}

/** Monta e envia UMA requisição de token no estilo pedido. */
function requestToken(
  secret: Record<string, string>,
  style: Style,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  if (secret.scope) body.set("scope", secret.scope);
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };

  if (style === "basic") {
    const basic = Buffer.from(`${secret.client_id ?? ""}:${secret.client_secret ?? ""}`).toString("base64");
    headers.Authorization = `Basic ${basic}`;
  } else {
    body.set("client_id", secret.client_id ?? "");
    body.set("client_secret", secret.client_secret ?? "");
  }

  return fetchImpl(secret.token_url ?? "", { method: "POST", headers, body: body.toString() });
}

/**
 * `onTrace` entra por ÚLTIMO na assinatura de propósito: acrescentar parâmetro
 * no meio deslocaria silenciosamente os argumentos dos seis pontos que já
 * chamam esta função. Recebe uma entrada por TENTATIVA — inclusive as que
 * falharam, que são justamente as que interessam num diagnóstico ("tentou body,
 * levou 401; tentou basic, passou").
 */
export async function getOAuthToken(
  credId: string,
  secret: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
  onTrace?: (t: ChamadaTrace & { etapa: string }) => void,
): Promise<string> {
  const hit = cache.get(credId);
  if (hit && hit.exp > Date.now()) return hit.token;

  // Ordem: o estilo que já deu certo para esta credencial primeiro; senão body→basic.
  const memo = styleMemo.get(credId);
  const order: Style[] = memo === "basic" ? ["basic", "body"] : ["body", "basic"];

  let lastStatus = 0;
  let lastCorpo = "";
  for (const style of order) {
    const inicio = Date.now();
    const res = await requestToken(secret, style, fetchImpl);
    // Lê o corpo SEMPRE: no 401 é ele que diz se o segredo está errado ou se o
    // servidor recusou o estilo de autenticação — coisas com correções opostas.
    const texto = onTrace || !res.ok ? await res.text().catch(() => "") : "";

    if (onTrace) {
      onTrace({
        etapa: `oauth/token (${style})`,
        ...montarTrace(
          {
            method: "POST",
            url: secret.token_url ?? "",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: style === "basic" ? "grant_type=client_credentials (credenciais no header Basic)" : "grant_type=client_credentials&client_id=***&client_secret=***",
          },
          { status: res.status, corpo: texto },
          Date.now() - inicio,
          [secret.client_secret, secret.session_key],
        ),
      });
    }

    if (!res.ok) {
      lastStatus = res.status;
      lastCorpo = texto;
      continue;
    }
    const json = (texto ? JSON.parse(texto) : await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error("Resposta OAuth sem access_token.");

    styleMemo.set(credId, style);
    const ttlMs = (json.expires_in ?? 3600) * 1000;
    cache.set(credId, { token: json.access_token, exp: Date.now() + ttlMs - 60_000 });
    return json.access_token;
  }
  // O corpo entra na mensagem: "HTTP 401" sozinho não distingue segredo errado
  // de cliente desativado no provedor.
  const detalhe = resumirCorpoErro(lastCorpo, 200);
  throw new Error(`Falha ao obter token OAuth (HTTP ${lastStatus})${detalhe ? `: ${detalhe}` : ""}.`);
}
