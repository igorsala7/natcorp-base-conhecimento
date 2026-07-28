import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveExtToken, extractExtToken, extCorsHeaders } from "@/lib/ext/auth";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: extCorsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/ext/spaces — documentações onde o dono do token pode CRIAR
 * conteúdo (para escolher onde o rascunho da captura vai nascer). Usa a mesma
 * função `has_permission` da RLS, por espaço.
 */
export async function POST(req: NextRequest) {
  const cors = extCorsHeaders(req.headers.get("origin"));
  const json = (b: unknown, s: number) => Response.json(b, { status: s, headers: cors });

  const token = await resolveExtToken(extractExtToken(req));
  if (!token) return json({ error: "Token inválido ou revogado." }, 401);

  const supabase = createAdminClient();
  const { data: espacos } = await supabase
    .from("spaces")
    .select("id, name, type")
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  const lista = espacos ?? [];
  const permitidos = await Promise.all(
    lista.map(async (s) => {
      const { data } = await supabase.rpc("has_permission", {
        p_user_id: token.user_id,
        p_permission_key: "content.create",
        p_space_id: s.id,
      });
      return data === true ? { id: s.id, name: s.name, type: s.type } : null;
    }),
  );

  return json({ spaces: permitidos.filter(Boolean) }, 200);
}
