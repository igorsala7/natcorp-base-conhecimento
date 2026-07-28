"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { webFetchPolicy } from "@/lib/ai/web-fetch-policy";
import { encryptSecret } from "@/lib/crypto/secrets";
import { enqueueCapture } from "@/lib/jobs/boss";

export type CaptureResult = { ok: true; jobId: string } | { ok: false; error: string };

/**
 * Inicia uma captura de telas cujo destino é um artigo de uma sessão do Estúdio:
 * ao terminar, o worker anexa os prints como mídia do artigo-alvo e o texto da
 * página como material. Espelha `importar/capture-actions.ts:createCaptureImport`.
 */
export async function createCaptureStudio(input: {
  sessionId: string;
  targetTmpId: string;
  url: string;
  mode: "static" | "interactive";
  login?: { usuario: string; senha: string } | null;
  instrucao?: string | null;
}): Promise<CaptureResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sua sessão expirou. Recarregue a página (F5) e entre de novo." };

  const supabase = await createClient();
  const { data: sess } = await supabase
    .from("studio_sessions")
    .select("space_id")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (!sess) return { ok: false, error: "Sessão não encontrada." };
  try {
    await requirePermission("content.create", sess.space_id);
  } catch {
    return { ok: false, error: "Sem permissão para criar conteúdo." };
  }
  if (!(await webFetchPolicy()).authoring) {
    return { ok: false, error: "O acesso à web para autoria está desligado (Sistema → IA → Acesso à web)." };
  }
  let u: URL;
  try {
    u = new URL(input.url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
  } catch {
    return { ok: false, error: "Informe uma URL http(s) válida." };
  }

  const admin = createAdminClient();
  const { data: liberado } = await admin.rpc("rate_limit_hit", {
    p_bucket: `capture:${user.id}`,
    p_max: 10,
    p_window_seconds: 60,
  });
  if (liberado === false) return { ok: false, error: "Muitas capturas seguidas. Tente em instantes." };

  const login = input.login?.usuario && input.login?.senha ? input.login : null;
  const { data: job, error } = await supabase
    .from("capture_jobs")
    .insert({
      space_id: sess.space_id,
      url: u.toString(),
      mode: input.mode,
      needs_login: !!login,
      destino: {
        kind: "studio",
        sessionId: input.sessionId,
        targetTmpId: input.targetTmpId,
        ...(input.instrucao?.trim() ? { instrucao: input.instrucao.trim().slice(0, 8000) } : {}),
      },
      created_by: user.id,
      status: "queued",
    })
    .select("id")
    .single();
  if (error || !job) return { ok: false, error: `Falha: ${error?.message}` };

  if (login) {
    await admin.from("capture_secrets").insert({
      job_id: job.id,
      usuario_enc: encryptSecret(login.usuario),
      senha_enc: encryptSecret(login.senha),
    });
  }

  try {
    await enqueueCapture(job.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("capture_jobs").update({ status: "error", error: `Fila indisponível: ${msg}` }).eq("id", job.id);
    return { ok: false, error: `Fila indisponível (o worker está rodando?): ${msg}` };
  }
  await audit({ action: "content.studio_create", entityType: "capture_job", entityId: job.id, spaceId: sess.space_id });
  return { ok: true, jobId: job.id };
}
