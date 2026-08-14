"use server";

import { randomUUID } from "node:crypto";
import { motivoFila } from "@/lib/jobs/motivo-fila";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/permissions";
import { currentMaxLevel } from "@/lib/auth/roles";
import { audit } from "@/lib/auth/audit";
import { encryptSecret } from "@/lib/crypto/secrets";
import {
  enqueueBackup, enqueueRestore, enqueueBackupReschedule,
  enqueueBackupImport, enqueueGithubSave, enqueueGithubImport,
} from "@/lib/jobs/boss";
import { deleteBackupObjects } from "@/lib/backup/engine";

export type BackupResult = { ok: true; msg?: string; jobId?: string } | { ok: false; error: string };



/** Dispara um backup manual (banco + arquivos, conforme a configuração). */
export async function criarBackup(): Promise<BackupResult> {
  try {
    await requirePermission("system.backup", null);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: cfg } = await supabase.from("backup_settings").select("include_storage").eq("id", true).maybeSingle();
    const { data: job, error } = await supabase
      .from("backup_jobs")
      .insert({ kind: "manual", include_storage: cfg?.include_storage ?? true, created_by: user?.id ?? null })
      .select("id").single();
    if (error || !job) return { ok: false, error: error?.message ?? "Falha ao criar o backup." };
    try {
      await enqueueBackup(job.id);
    } catch (e) {
      await supabase.from("backup_jobs").update({ status: "error", error: motivoFila(e) }).eq("id", job.id);
      return { ok: false, error: motivoFila(e) };
    }
    await audit({ action: "space.update", entityType: "backup", entityId: job.id, spaceId: null });
    revalidatePath("/admin/sistema");
    return { ok: true, msg: "Backup iniciado.", jobId: job.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }
}

/** Restaura um backup concluído. DESTRUTIVO: substitui os dados atuais. Só Owner. */
export async function restaurarBackup(sourceBackupId: string): Promise<BackupResult> {
  try {
    await requirePermission("system.backup", null);
    if ((await currentMaxLevel(null)) < 100) {
      return { ok: false, error: "Apenas o Owner pode restaurar um backup." };
    }
    const supabase = await createClient();
    const { data: src } = await supabase
      .from("backup_jobs").select("id, status, storage_path, include_storage")
      .eq("id", sourceBackupId).maybeSingle();
    if (!src || src.status !== "done" || !src.storage_path) {
      return { ok: false, error: "Backup inválido ou ainda não concluído." };
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: job, error } = await supabase
      .from("backup_jobs")
      .insert({
        kind: "restore", include_storage: src.include_storage, storage_path: src.storage_path,
        source_backup_id: src.id, created_by: user?.id ?? null,
      })
      .select("id").single();
    if (error || !job) return { ok: false, error: error?.message ?? "Falha ao iniciar a restauração." };
    try {
      await enqueueRestore(job.id);
    } catch (e) {
      await supabase.from("backup_jobs").update({ status: "error", error: motivoFila(e) }).eq("id", job.id);
      return { ok: false, error: motivoFila(e) };
    }
    await audit({ action: "space.update", entityType: "backup_restore", entityId: job.id, spaceId: null });
    revalidatePath("/admin/sistema");
    return { ok: true, msg: "Restauração iniciada.", jobId: job.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }
}

/** Exclui um backup (registro + arquivos). */
export async function excluirBackup(id: string): Promise<BackupResult> {
  try {
    await requirePermission("system.backup", null);
    const supabase = await createClient();
    const { data: b } = await supabase.from("backup_jobs").select("id, storage_path, kind").eq("id", id).maybeSingle();
    if (!b) return { ok: false, error: "Backup não encontrado." };
    // Só o backup detém arquivos próprios; um registro de 'restore' não.
    if (b.kind !== "restore" && b.storage_path) {
      await deleteBackupObjects(createAdminClient(), b.storage_path).catch(() => {});
    }
    await supabase.from("backup_jobs").delete().eq("id", id);
    revalidatePath("/admin/sistema");
    return { ok: true, msg: "Backup excluído." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }
}

/** Salva o agendador e a retenção; pede ao worker para reprogramar. */
export async function salvarConfigBackup(input: {
  auto_enabled: boolean;
  frequency: "daily" | "weekly";
  hour: number;
  weekday: number;
  include_storage: boolean;
  retention_days: number;
}): Promise<BackupResult> {
  try {
    await requirePermission("system.backup", null);
    const supabase = await createClient();
    const patch = {
      auto_enabled: input.auto_enabled,
      frequency: input.frequency === "weekly" ? "weekly" : "daily",
      hour: Math.min(23, Math.max(0, Math.round(input.hour))),
      weekday: Math.min(6, Math.max(0, Math.round(input.weekday))),
      include_storage: input.include_storage,
      retention_days: Math.min(3650, Math.max(1, Math.round(input.retention_days))),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("backup_settings").update(patch).eq("id", true);
    if (error) return { ok: false, error: error.message };
    try { await enqueueBackupReschedule(); } catch (e) { /* worker off: aplica ao subir */ }
    await audit({ action: "space.update", entityType: "backup_settings", entityId: "backup", spaceId: null });
    revalidatePath("/admin/sistema");
    return { ok: true, msg: "Configurações de backup salvas." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }
}

// ── Upload de um backup externo ────────────────────────────────────────────────
/** Devolve uma URL assinada para o navegador enviar o .zip direto ao Storage. */
export async function criarUploadUrl(): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  try {
    await requirePermission("system.backup", null);
    const path = `_incoming/${randomUUID()}.zip`;
    const { data, error } = await createAdminClient().storage.from("backups").createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: error?.message ?? "Falha ao preparar o envio." };
    return { ok: true, path, token: data.token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }
}

/** Depois do upload, desempacota o .zip e traz o backup para a lista. */
export async function importarUpload(incomingPath: string): Promise<BackupResult> {
  try {
    await requirePermission("system.backup", null);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: job, error } = await supabase.from("backup_jobs")
      .insert({ kind: "upload", status: "queued", phase: "importando", created_by: user?.id ?? null })
      .select("id").single();
    if (error || !job) return { ok: false, error: error?.message ?? "Falha ao registrar o upload." };
    try { await enqueueBackupImport(job.id, incomingPath); }
    catch (e) { await supabase.from("backup_jobs").update({ status: "error", error: motivoFila(e) }).eq("id", job.id); return { ok: false, error: motivoFila(e) }; }
    revalidatePath("/admin/sistema");
    return { ok: true, msg: "Backup enviado — importando…", jobId: job.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }
}

// ── GitHub ──────────────────────────────────────────────────────────────────────
/** Salva repositório/branch/pasta e (se informado) o token cifrado. */
export async function salvarConfigGithub(input: {
  repo: string; branch: string; path: string; token?: string;
}): Promise<BackupResult> {
  try {
    await requirePermission("system.backup", null);
    const supabase = await createClient();
    const { error } = await supabase.from("backup_settings").update({
      github_repo: input.repo.trim() || null,
      github_branch: input.branch.trim() || "main",
      github_path: input.path.trim() || "backups",
      updated_at: new Date().toISOString(),
    }).eq("id", true);
    if (error) return { ok: false, error: error.message };
    if (input.token && input.token.trim()) {
      const admin = createAdminClient();
      await admin.from("backup_secrets").upsert({ id: true, github_token_enc: encryptSecret(input.token.trim()), updated_at: new Date().toISOString() });
    }
    await audit({ action: "space.update", entityType: "backup_github", entityId: "backup", spaceId: null });
    revalidatePath("/admin/sistema");
    return { ok: true, msg: "GitHub configurado." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }
}

/** Envia um backup existente para o repositório GitHub configurado. */
export async function enviarParaGithub(sourceBackupId: string): Promise<BackupResult> {
  try {
    await requirePermission("system.backup", null);
    const supabase = await createClient();
    const { data: src } = await supabase.from("backup_jobs").select("id, status, storage_path").eq("id", sourceBackupId).maybeSingle();
    if (!src || src.status !== "done" || !src.storage_path) return { ok: false, error: "Backup inválido." };
    const { data: { user } } = await supabase.auth.getUser();
    const { data: job, error } = await supabase.from("backup_jobs")
      .insert({ kind: "github", status: "queued", phase: "GitHub", source_backup_id: sourceBackupId, created_by: user?.id ?? null })
      .select("id").single();
    if (error || !job) return { ok: false, error: error?.message ?? "Falha ao registrar." };
    try { await enqueueGithubSave(job.id, sourceBackupId); }
    catch (e) { await supabase.from("backup_jobs").update({ status: "error", error: motivoFila(e) }).eq("id", job.id); return { ok: false, error: motivoFila(e) }; }
    revalidatePath("/admin/sistema");
    return { ok: true, msg: "Enviando ao GitHub…", jobId: job.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }
}

/** Traz o backup mais recente do GitHub para a lista (depois é só restaurar). */
export async function importarDoGithub(): Promise<BackupResult> {
  try {
    await requirePermission("system.backup", null);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: job, error } = await supabase.from("backup_jobs")
      .insert({ kind: "upload", status: "queued", phase: "GitHub", created_by: user?.id ?? null })
      .select("id").single();
    if (error || !job) return { ok: false, error: error?.message ?? "Falha ao registrar." };
    try { await enqueueGithubImport(job.id); }
    catch (e) { await supabase.from("backup_jobs").update({ status: "error", error: motivoFila(e) }).eq("id", job.id); return { ok: false, error: motivoFila(e) }; }
    revalidatePath("/admin/sistema");
    return { ok: true, msg: "Importando do GitHub…", jobId: job.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }
}
