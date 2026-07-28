import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveExtToken, extractExtToken, extCorsHeaders } from "@/lib/ext/auth";
import { assertActiveSession } from "@/lib/ext/store";
import { montarRascunho, criarNoRascunho, type TrailEvent } from "@/lib/ext/assemble";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: extCorsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/ext/finalize — encerra a sessão e cria um artigo RASCUNHO a
 * partir da trilha (5.2). Auth: token; sessão do dono e ATIVA; e o usuário
 * precisa poder CRIAR conteúdo na documentação escolhida. Corpo:
 * `{ sessionId, spaceId, parentId?, title? }`.
 */
export async function POST(req: NextRequest) {
  const cors = extCorsHeaders(req.headers.get("origin"));
  const json = (b: unknown, s: number) => Response.json(b, { status: s, headers: cors });

  const token = await resolveExtToken(extractExtToken(req));
  if (!token) return json({ error: "Token inválido ou revogado." }, 401);

  let body: { sessionId?: string; spaceId?: string; parentId?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const session = await assertActiveSession(String(body.sessionId ?? ""), token.user_id);
  if (!session) return json({ error: "Sessão inválida, encerrada ou de outro usuário." }, 403);

  const spaceId = String(body.spaceId ?? "");
  if (!spaceId) return json({ error: "Escolha a documentação de destino." }, 400);

  const supabase = createAdminClient();
  // Permissão de autoria na documentação escolhida (mesma função da RLS).
  const { data: pode } = await supabase.rpc("has_permission", {
    p_user_id: token.user_id,
    p_permission_key: "content.create",
    p_space_id: spaceId,
  });
  if (pode !== true) return json({ error: "Sem permissão para criar conteúdo nessa documentação." }, 403);

  // Trilha em ordem (navegação + prints).
  const { data: eventos } = await supabase
    .from("extension_events")
    .select("kind, url, title, label, storage_path, created_at, t_ms, meta")
    .eq("session_id", session.id)
    .eq("discarded", false)
    .order("created_at", { ascending: true });

  const title = (typeof body.title === "string" && body.title.trim().slice(0, 200)) || "Rascunho da captura";
  const doc = await montarRascunho(spaceId, (eventos ?? []) as TrailEvent[]);
  const criado = await criarNoRascunho(
    token.user_id,
    spaceId,
    typeof body.parentId === "string" && body.parentId ? body.parentId : null,
    title,
    doc,
  );
  if (!criado.ok) return json({ error: criado.error }, 500);

  await supabase
    .from("extension_sessions")
    .update({ status: "finalized", ended_at: new Date().toISOString(), space_id: spaceId, node_id: criado.nodeId })
    .eq("id", session.id);

  return json({ nodeId: criado.nodeId, title }, 200);
}
