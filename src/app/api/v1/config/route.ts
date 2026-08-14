import type { NextRequest } from "next/server";
import { hasAiKey } from "@/lib/ai/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeTrackDetalhado } from "@/lib/tracking/resolve";
import { widgetLiberado } from "@/lib/widget/disponibilidade";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  extractKey,
} from "@/lib/widget/auth";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * GET /api/v1/config?key=pk_... — bootstrap do widget: devolve a config visual
 * (cor, avatar, boas-vindas, sugestões, posição) do widget_keys.config.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const key = await resolveWidgetKey(extractKey(req));
  if (!key) return Response.json({ error: "Chave inválida." }, { status: 401, headers: cors });
  if (!originAllowed(key.allowed_origins, origin)) {
    return Response.json({ error: "Origem não autorizada." }, { status: 403, headers: cors });
  }
  // Widget desligado NESTA base + painel → o bootstrap avisa e o widget nem
  // desenha a bolha. Bloquear só no /chat deixaria a bolha na tela para abrir e
  // receber uma recusa, o que é pior que não existir.
  const track = req.nextUrl.searchParams.get("track");
  let liberado = true;
  if (track) {
    const { campos } = await decodeTrackDetalhado(key.space_id, track);
    const baseCode = String(campos.p_base ?? "").trim();
    if (baseCode) {
      const db = createAdminClient();
      const { data: base } = await db
        .from("ai_bases")
        .select("active, widget_paineis")
        .ilike("base_code", baseCode.replace(/([\\%_])/g, "\\$1"))
        .maybeSingle();
      // Base que não existe no catálogo não é motivo para sumir com o widget:
      // instalação sem integração é um caso legítimo.
      if (base) liberado = widgetLiberado(base.widget_paineis, campos.p_portal, base.active);
    }
  }
  if (!liberado) {
    return Response.json({ desativado: true }, { headers: { ...cors, "Cache-Control": "no-store" } });
  }
  return Response.json(
    { config: key.config, aiEnabled: await hasAiKey() },
    // no-store: mudança de config (ícone/cor/título) reflete no próximo load,
    // sem o navegador servir uma versão cacheada da config.
    { headers: { ...cors, "Cache-Control": "no-store" } },
  );
}
