"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { webFetchPolicy } from "@/lib/ai/web-fetch-policy";
import { encryptSecret } from "@/lib/crypto/secrets";
import { enqueueCapture } from "@/lib/jobs/boss";
import { SessaoCaptura } from "@/lib/capture/browser";
import { sugerirCaminho } from "@/lib/capture/generate";
import type { CaminhoSugerido } from "@/lib/capture/plan-schema";

export type CaptureResult = { ok: true; jobId: string } | { ok: false; error: string };
export type SugestaoResult = { ok: true; sugestao: CaminhoSugerido } | { ok: false; error: string };

/**
 * Abre a página (navegador real) e pede à IA um CAMINHO de navegação sugerido +
 * os campos que ela precisa que o autor preencha (Fase 2). Não captura ainda; é
 * o passo conversacional antes de rodar a captura interativa.
 */
export async function sugerirCaminhoCaptura(input: {
  spaceId: string;
  url: string;
  instrucao?: string | null;
  login?: { usuario: string; senha: string } | null;
}): Promise<SugestaoResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sua sessão expirou. Recarregue a página." };
  const podeImport = await requirePermissaoCaptura(input.spaceId);
  if (!podeImport.ok) return podeImport;
  if (!(await webFetchPolicy()).authoring) {
    return { ok: false, error: "O acesso à web para autoria está desligado (Sistema → IA)." };
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
  if (liberado === false) return { ok: false, error: "Muitas ações seguidas. Tente em instantes." };

  const login = input.login?.usuario && input.login?.senha ? input.login : undefined;
  let sessao: SessaoCaptura | null = null;
  try {
    sessao = await SessaoCaptura.iniciar({ url: u.toString(), modo: "interactive", ...(login ? { login } : {}) });
    const sugestao = await sugerirCaminho(sessao.inventario, input.instrucao ?? "");
    return { ok: true, sugestao };
  } catch (e) {
    return { ok: false, error: `Não consegui abrir a página: ${e instanceof Error ? e.message : "?"}` };
  } finally {
    await sessao?.fechar();
  }
}

/** content.import OU content.create — as duas portas da captura. */
async function requirePermissaoCaptura(spaceId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requirePermission("content.import", spaceId);
    return { ok: true };
  } catch {
    try {
      await requirePermission("content.create", spaceId);
      return { ok: true };
    } catch {
      return { ok: false, error: "Sem permissão." };
    }
  }
}

/**
 * Inicia uma captura de telas de uma URL cujo destino é a PRÉVIA do Importador.
 * Cria só o capture_job (o import_job em 'preview' nasce no worker, ao terminar).
 * Credenciais de login (opcionais) vão cifradas numa tabela isolada e são
 * apagadas pelo worker assim que usadas.
 */
export async function createCaptureImport(input: {
  spaceId: string;
  url: string;
  mode: "static" | "interactive";
  targetParentId?: string | null;
  login?: { usuario: string; senha: string } | null;
  /** Passo a passo de navegação (modo interativo) — o worker lê em destino.instrucao. */
  instrucao?: string | null;
}): Promise<CaptureResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sua sessão expirou. Recarregue a página (F5) e entre de novo." };
  try {
    await requirePermission("content.import", input.spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para importar." };
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

  // Captura é cara (browser headless): teto por usuário.
  const admin = createAdminClient();
  const { data: liberado } = await admin.rpc("rate_limit_hit", {
    p_bucket: `capture:${user.id}`,
    p_max: 10,
    p_window_seconds: 60,
  });
  if (liberado === false) return { ok: false, error: "Muitas capturas seguidas. Tente em instantes." };

  const login = input.login?.usuario && input.login?.senha ? input.login : null;
  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("capture_jobs")
    .insert({
      space_id: input.spaceId,
      url: u.toString(),
      mode: input.mode,
      needs_login: !!login,
      destino: {
        kind: "import",
        parentId: input.targetParentId ?? null,
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
  await audit({ action: "content.import_start", entityType: "capture_job", entityId: job.id, spaceId: input.spaceId });
  revalidatePath("/admin/importar");
  return { ok: true, jobId: job.id };
}
