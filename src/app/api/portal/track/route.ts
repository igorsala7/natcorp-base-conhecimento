import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalAccess } from "@/lib/portal/data";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

const KINDS = new Set(["home", "folder", "article"]);
const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/**
 * POST /api/portal/track — registra um acesso a uma página do portal
 * (documentação, diretório ou artigo), com os parâmetros de rastreio do leitor.
 * Mesmo alcance/gate do portal (só espaço público/acessível). Rate limit por IP.
 * Responde 204 sem corpo — é um beacon; o cliente não espera nada.
 */
export async function POST(req: NextRequest) {
  const json = (b: unknown, s: number) => Response.json(b, { status: s });

  let payload: {
    spaceSlug?: string;
    nodeId?: string | null;
    kind?: string;
    title?: string;
    path?: string;
    sessionId?: string;
    track?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  if (!payload.spaceSlug) return json({ error: "Espaço ausente." }, 400);
  const access = await getPortalAccess(payload.spaceSlug);
  if (!access || access.locked) return json({ error: "Espaço indisponível." }, 403);

  const supabase = createAdminClient();

  const { data: allowed } = await supabase.rpc("rate_limit_hit", {
    p_bucket: `portal:track:${clientIp(req)}`,
    p_max: 120,
    p_window_seconds: 60,
  });
  if (allowed === false) return new Response(null, { status: 204 });

  const kind = payload.kind && KINDS.has(payload.kind) ? payload.kind : "article";

  await supabase.from("page_views").insert({
    space_id: access.space.id,
    node_id: str(payload.nodeId, 40),
    kind,
    title: str(payload.title, 300),
    path: str(payload.path, 500),
    session_id: str(payload.sessionId, 80),
    ...(await decodeTrackForSpace(access.space.id, payload.track)),
  });

  return new Response(null, { status: 204 });
}
