import type { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/permissions";
import { transcreverFormFile } from "@/lib/ai/transcribe-request";

export const runtime = "nodejs";

/** POST /api/transcribe — transcreve o áudio do chat do Assistente (admin autenticado). */
export async function POST(req: NextRequest) {
  if (!(await hasPermission("content.view"))) {
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Envio inválido." }, { status: 400 });
  }
  const { status, body } = await transcreverFormFile(form.get("file"));
  return Response.json(body, { status });
}
