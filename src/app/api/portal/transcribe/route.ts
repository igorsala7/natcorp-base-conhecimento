import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { transcreverFormFile } from "@/lib/ai/transcribe-request";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

/** POST /api/portal/transcribe — transcreve o áudio do "Perguntar à IA" do portal (mesma origem, rate-limit por IP). */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  const { data: allowed } = await supabase.rpc("rate_limit_hit", {
    p_bucket: `transcribe:${clientIp(req)}`,
    p_max: 20,
    p_window_seconds: 60,
  });
  if (allowed === false) return Response.json({ error: "Muitas requisições. Tente em instantes." }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Envio inválido." }, { status: 400 });
  }
  const { status, body } = await transcreverFormFile(form.get("file"));
  return Response.json(body, { status });
}
