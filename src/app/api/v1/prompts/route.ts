import type { NextRequest } from "next/server";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  clientIp,
  extractKey,
  rateLimitOk,
} from "@/lib/widget/auth";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import {
  listClientePrompts,
  saveClientePrompt,
  deleteClientePrompt,
  type ClienteIdentity,
} from "@/lib/portal/prompt-store";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

type Payload = {
  action?: "list" | "save" | "delete";
  key?: string;
  track?: unknown;
  id?: string | null;
  label?: string | null;
  texto?: string;
};

/**
 * POST /api/v1/prompts — biblioteca de prompts salvos do VISITANTE do widget.
 * Auth: chave pública (pk_...) + allowlist de origem + rate limit — o mesmo
 * portão do chat. Escopo: o espaço DONO da chave, chaveado por (p_base,
 * p_usuario) do `track`. Sem esse par, não há biblioteca (o widget nunca pede
 * login). `action`: 'list' | 'save' | 'delete'.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: cors });

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const key = await resolveWidgetKey(extractKey(req, payload.key));
  if (!key) return json({ error: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) {
    return json({ error: "Origem não autorizada." }, 403);
  }
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) {
    return json({ error: "Muitas requisições. Tente em instantes." }, 429);
  }

  const t = await decodeTrackForSpace(key.space_id, payload.track);
  if (!t.p_base || !t.p_usuario) {
    // Sem identidade não há como separar prompts entre visitantes: devolve uma
    // biblioteca vazia (nunca solicita login no widget).
    return json({ prompts: [] }, 200);
  }
  const identity: ClienteIdentity = { p_base: t.p_base, p_usuario: t.p_usuario };

  if (payload.action === "save") {
    const r = await saveClientePrompt(key.space_id, identity, {
      id: payload.id,
      label: payload.label,
      texto: payload.texto ?? "",
    });
    return json(r, r.ok ? 200 : 400);
  }
  if (payload.action === "delete") {
    if (!payload.id) return json({ ok: false, error: "id ausente." }, 400);
    const r = await deleteClientePrompt(key.space_id, identity, payload.id);
    return json(r, r.ok ? 200 : 400);
  }
  // Padrão: listar.
  const prompts = await listClientePrompts(key.space_id, identity);
  return json({ prompts }, 200);
}
