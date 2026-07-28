import type { NextRequest } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateExtToken,
  hashExtToken,
  extTokenPrefix,
  extCorsHeaders,
  extClientIp,
} from "@/lib/ext/auth";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: extCorsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/ext/login — a extensão autentica com E-MAIL + SENHA da plataforma
 * (em vez de colar um token). Verificamos as credenciais via Supabase Auth e, se
 * válidas, cunhamos um TOKEN pessoal de extensão para aquele usuário e o
 * devolvemos (a extensão o guarda internamente). Sessão do Supabase não é
 * persistida — só serve para conferir a senha.
 */
export async function POST(req: NextRequest) {
  const cors = extCorsHeaders(req.headers.get("origin"));
  const json = (b: unknown, s: number) => Response.json(b, { status: s, headers: cors });

  let body: { email?: unknown; password?: unknown; label?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return json({ error: "Informe e-mail e senha." }, 400);

  const admin = createAdminClient();
  // Freio anti-força-bruta por IP (além do rate limit do próprio Supabase Auth).
  const { data: ok } = await admin.rpc("rate_limit_hit", {
    p_bucket: `ext:login:${extClientIp(req)}`,
    p_max: 10,
    p_window_seconds: 60,
  });
  if (ok === false) return json({ error: "Muitas tentativas. Aguarde um minuto." }, 429);

  // Verifica a senha com um cliente ANÔNIMO sem persistir sessão.
  const sb = createSbClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  await sb.auth.signOut().catch(() => {});
  if (error || !data?.user) return json({ error: "E-mail ou senha inválidos." }, 401);

  // Cunha um token pessoal para a extensão usar nas demais rotas.
  const token = generateExtToken();
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 80) : "Extensão";
  const { error: insErr } = await admin.from("extension_tokens").insert({
    user_id: data.user.id,
    label,
    token_hash: hashExtToken(token),
    token_prefix: extTokenPrefix(token),
  });
  if (insErr) return json({ error: "Falha ao autorizar a extensão." }, 500);

  return json({ token, email: data.user.email ?? email }, 200);
}
