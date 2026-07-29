import "server-only";
import { resolveApiKey, hasScope, type ApiKeyCtx } from "./keys";

/** Resposta JSON com CORS básico (as rotas /api/manage são server-to-server). */
export function apiJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * Autoriza a requisição por chave de API + escopo. Retorna o contexto OU uma
 * Response de erro (401 sem chave, 403 sem escopo) — a rota faz early-return.
 */
export async function authorize(
  req: Request,
  scope: string,
): Promise<{ ctx: ApiKeyCtx } | { error: Response }> {
  const ctx = await resolveApiKey(req);
  if (!ctx) return { error: apiJson({ error: "Chave de API inválida ou ausente (use Authorization: Bearer sk_...)." }, 401) };
  if (!hasScope(ctx, scope)) return { error: apiJson({ error: `A chave não tem o escopo obrigatório "${scope}".` }, 403) };
  return { ctx };
}
