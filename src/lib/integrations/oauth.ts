/**
 * Token OAuth2 (client_credentials) por credencial, com CACHE em memória.
 *
 * O deploy é um processo longo (web/worker), então um cache em processo já evita
 * bater no servidor de token a cada mensagem. Expira com folga (−60s) e é
 * invalidado no 401 para renovar na hora.
 */

type Cached = { token: string; exp: number };
const cache = new Map<string, Cached>();

export function invalidateOAuthToken(credId: string): void {
  cache.delete(credId);
}

export async function getOAuthToken(
  credId: string,
  secret: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const hit = cache.get(credId);
  if (hit && hit.exp > Date.now()) return hit.token;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: secret.client_id ?? "",
    client_secret: secret.client_secret ?? "",
  });
  if (secret.scope) body.set("scope", secret.scope);

  const res = await fetchImpl(secret.token_url ?? "", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Falha ao obter token OAuth (HTTP ${res.status}).`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Resposta OAuth sem access_token.");

  const ttlMs = (json.expires_in ?? 3600) * 1000;
  cache.set(credId, { token: json.access_token, exp: Date.now() + ttlMs - 60_000 });
  return json.access_token;
}
