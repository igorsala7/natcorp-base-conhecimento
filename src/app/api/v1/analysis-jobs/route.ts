import type { NextRequest } from "next/server";
import { resolveWidgetKey, originAllowed, corsHeaders, clientIp, extractKey, rateLimitOk } from "@/lib/widget/auth";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/v1/analysis-jobs — estado do job de ANÁLISE SEMÂNTICA (modo B) por polling.
 *
 * O widget é anônimo (não abre Realtime): dispara o job pelo chat (scope.analiseB) e
 * consulta o progresso/resultado aqui. Mesma auth/isolamento do saved-reports — TODA
 * leitura filtra por space_id + user_ref (um id sozinho nunca basta).
 *
 * Ação: "get" → { id } → { ok, status, progress, processed, total, result?, error? }.
 */
export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

  let p: { action?: unknown; key?: unknown; track?: unknown; id?: unknown };
  try { p = await req.json(); } catch { return json({ ok: false, erro: "JSON inválido." }, 400); }

  const key = await resolveWidgetKey(extractKey(req, p.key));
  if (!key) return json({ ok: false, erro: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) return json({ ok: false, erro: "Origem não autorizada." }, 403);
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) return json({ ok: false, erro: "Muitas requisições. Tente em instantes." }, 429);

  const track = await decodeTrackForSpace(key.space_id, p.track);
  const ident = String(track.p_usuario || track.p_matricula || "").trim();
  if (!ident) return json({ ok: false, erro: "Sem identidade no rastreio." }, 400);
  const userRef = `${String(track.p_base || "").trim()}:${ident}`;

  const db = createAdminClient();
  const action = String(p.action ?? "").trim();

  if (action === "get") {
    const id = String(p.id ?? "");
    if (!id) return json({ ok: false, erro: "Informe o id." }, 400);
    const { data, error } = await db
      .from("widget_analysis_jobs")
      .select("status, progress, processed, total, result, error")
      .eq("id", id)
      .eq("space_id", key.space_id)   // fronteira de isolamento
      .eq("user_ref", userRef)
      .maybeSingle();
    if (error) { console.error("[analysis-jobs] get:", error); return json({ ok: false, erro: "Falha ao consultar o job." }, 500); }
    if (!data) return json({ ok: false, erro: "Análise não encontrada." }, 404);
    return json({
      ok: true,
      status: data.status,
      progress: data.progress,
      processed: data.processed,
      total: data.total,
      result: data.status === "done" ? data.result : null,
      error: data.status === "error" ? data.error : null,
    }, 200);
  }

  return json({ ok: false, erro: "Ação desconhecida." }, 400);
}
