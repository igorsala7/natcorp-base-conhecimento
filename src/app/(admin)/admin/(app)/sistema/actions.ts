"use server";

import { revalidatePath } from "next/cache";
import { generateText, embed } from "ai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission, hasPermission } from "@/lib/auth/permissions";
import { currentMaxLevel } from "@/lib/auth/roles";
import { audit } from "@/lib/auth/audit";
import { encryptSecret, hasEncryptionKey } from "@/lib/crypto/secrets";
import { invalidateAiCache, resolveAi, languageModel, embeddingModel, embeddingCallOptions } from "@/lib/ai/config";
import type { ProviderKind, Purpose } from "@/lib/ai/catalog";
import { sendEmail } from "@/lib/email/send";

export type SysResult = { ok: true; msg?: string } | { ok: false; error: string };

/** Alterar SEGREDO é privilégio de Owner (100) — o banco também exige. */
async function exigirOwner(): Promise<string | null> {
  const nivel = await currentMaxLevel(null);
  return nivel >= 100 ? null : "Apenas o Owner pode alterar chaves e segredos.";
}

// ─────────────────────────────── IA ────────────────────────────────────────

export async function saveProvider(input: {
  id?: string;
  name: string;
  kind: ProviderKind;
  baseUrl?: string | null;
  active: boolean;
  /** Texto puro; só é gravado quando vem preenchido (vazio = manter a atual). */
  apiKey?: string | null;
}): Promise<SysResult> {
  try {
    await requirePermission("ai.configure", null);
  } catch {
    return { ok: false, error: "Sem permissão para configurar IA." };
  }
  const supabase = await createClient();
  const { name, kind, baseUrl, active, apiKey } = input;
  if (!name.trim()) return { ok: false, error: "Informe um nome." };

  let id = input.id;
  if (id) {
    const { error } = await supabase
      .from("ai_providers")
      .update({ name: name.trim(), kind, base_url: baseUrl?.trim() || null, active })
      .eq("id", id);
    if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("ai_providers")
      .insert({
        name: name.trim(),
        kind,
        base_url: baseUrl?.trim() || null,
        active,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: `Falha ao criar: ${error?.message}` };
    id = data.id;
  }

  if (apiKey && apiKey.trim()) {
    const negado = await exigirOwner();
    if (negado) return { ok: false, error: negado };
    if (!hasEncryptionKey()) {
      return {
        ok: false,
        error: "APP_ENCRYPTION_KEY não configurada no servidor — sem ela não é possível guardar chaves.",
      };
    }
    // A função no banco também exige nível 100: a checagem daqui existe para a
    // mensagem ser clara, não como única barreira.
    const { error } = await supabase.rpc("set_ai_provider_key", {
      p_provider_id: id!,
      p_key_enc: encryptSecret(apiKey.trim()),
    });
    if (error) return { ok: false, error: `Falha ao gravar a chave: ${error.message}` };
  }

  invalidateAiCache();
  await audit({ action: "space.update", entityType: "ai_provider", entityId: id!, spaceId: null });
  revalidatePath("/admin/sistema");
  return { ok: true, msg: "Provedor salvo." };
}

export async function deleteProvider(id: string): Promise<SysResult> {
  try {
    await requirePermission("ai.configure", null);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("ai_providers").delete().eq("id", id);
  if (error) return { ok: false, error: `Falha ao excluir: ${error.message}` };
  invalidateAiCache();
  revalidatePath("/admin/sistema");
  return { ok: true };
}

export async function assignPurpose(
  purpose: Purpose,
  providerId: string | null,
  model: string,
): Promise<SysResult> {
  try {
    await requirePermission("ai.configure", null);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const supabase = await createClient();

  // Sem provedor = volta ao fallback por env var.
  if (!providerId) {
    const { error } = await supabase.from("ai_assignments").delete().eq("purpose", purpose);
    if (error) return { ok: false, error: error.message };
    invalidateAiCache();
    revalidatePath("/admin/sistema");
    return { ok: true, msg: "Voltou a usar a configuração das variáveis de ambiente." };
  }

  if (!model.trim()) return { ok: false, error: "Informe o modelo." };
  const { error } = await supabase
    .from("ai_assignments")
    .upsert(
      { purpose, provider_id: providerId, model: model.trim(), updated_at: new Date().toISOString() },
      { onConflict: "purpose" },
    );
  if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };

  invalidateAiCache();
  revalidatePath("/admin/sistema");
  return {
    ok: true,
    msg:
      purpose === "embedding"
        ? "Salvo. Os vetores gerados com o modelo anterior ficaram desatualizados — reindexe as documentações."
        : "Salvo.",
  };
}

/**
 * Chamada mínima real ao provedor.
 *
 * Existe porque, sem isto, uma chave errada só se manifesta quando o chatbot
 * emudece — foi exatamente o que aconteceu quando o crédito da Anthropic
 * acabou: as fontes apareciam e a resposta, não.
 */
export async function testPurpose(purpose: Purpose): Promise<SysResult> {
  try {
    await requirePermission("ai.configure", null);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const cfg = await resolveAi(purpose);
  if (!cfg) return { ok: false, error: "Nada configurado para esta finalidade." };

  try {
    if (purpose === "embedding") {
      const { embedding } = await embed({
        model: await embeddingModel(),
        value: "teste de conexão",
        providerOptions: await embeddingCallOptions(),
      });
      // Dimensão errada aqui vira erro de INSERT lá na frente, artigo por
      // artigo — melhor descobrir agora.
      if (embedding.length !== 1536) {
        return {
          ok: false,
          error: `O modelo devolveu ${embedding.length} dimensões; a base exige 1536. Escolha outro modelo.`,
        };
      }
      return { ok: true, msg: `OK — ${cfg.kind}/${cfg.model}, 1536 dimensões (origem: ${cfg.origem}).` };
    }
    const { text } = await generateText({
      model: await languageModel(purpose),
      prompt: "Responda apenas: ok",
    });
    return {
      ok: true,
      msg: `OK — ${cfg.kind}/${cfg.model} respondeu "${text.trim().slice(0, 40)}" (origem: ${cfg.origem}).`,
    };
  } catch (e) {
    // A mensagem CRUA do provedor é o que resolve o problema de quem configura
    // ("crédito insuficiente", "modelo inexistente", "chave inválida").
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ────────────────────────────── E-mail ─────────────────────────────────────

export async function saveEmailSettings(input: {
  transport: "off" | "brevo" | "smtp";
  fromName: string;
  fromEmail: string;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpSecure?: boolean;
  brevoKey?: string | null;
  smtpPass?: string | null;
}): Promise<SysResult> {
  try {
    await requirePermission("integrations.manage", null);
  } catch {
    return { ok: false, error: "Sem permissão para configurar integrações." };
  }
  const supabase = await createClient();

  const { error } = await supabase
    .from("email_settings")
    .update({
      transport: input.transport,
      from_name: input.fromName.trim() || "Base de Conhecimento",
      from_email: input.fromEmail.trim() || null,
      smtp_host: input.smtpHost?.trim() || null,
      smtp_port: input.smtpPort ?? null,
      smtp_user: input.smtpUser?.trim() || null,
      smtp_secure: input.smtpSecure ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };

  for (const [campo, valor] of [
    ["brevo", input.brevoKey],
    ["smtp", input.smtpPass],
  ] as const) {
    if (!valor || !valor.trim()) continue;
    const negado = await exigirOwner();
    if (negado) return { ok: false, error: negado };
    if (!hasEncryptionKey()) {
      return { ok: false, error: "APP_ENCRYPTION_KEY não configurada no servidor." };
    }
    const { error: e2 } = await supabase.rpc("set_email_secret", {
      p_campo: campo,
      p_valor_enc: encryptSecret(valor.trim()),
    });
    if (e2) return { ok: false, error: `Falha ao gravar o segredo: ${e2.message}` };
  }

  await audit({ action: "space.update", entityType: "email_settings", entityId: "email", spaceId: null });
  revalidatePath("/admin/sistema");
  return { ok: true, msg: "Configuração de e-mail salva." };
}

/** Envia um e-mail de teste para o próprio usuário logado. */
export async function sendTestEmail(): Promise<SysResult> {
  try {
    await requirePermission("integrations.manage", null);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Sua conta não tem e-mail." };

  const res = await sendEmail({
    to: user.email,
    subject: "Teste de envio — Base de Conhecimento",
    html: "<p>Se você recebeu esta mensagem, o envio de e-mail está funcionando.</p>",
    text: "Se você recebeu esta mensagem, o envio de e-mail está funcionando.",
  });
  return res.ok
    ? { ok: true, msg: `Enviado para ${user.email} via ${res.via}. Confira a caixa de entrada.` }
    : { ok: false, error: res.reason };
}

/** A tela precisa saber SE há segredo gravado, nunca o valor. */
export async function secretsPresentes(): Promise<{
  brevo: boolean;
  smtp: boolean;
  providers: Record<string, boolean>;
}> {
  if (!(await hasPermission("ai.configure", null))) {
    return { brevo: false, smtp: false, providers: {} };
  }
  const admin = createAdminClient();
  const [{ data: keys }, { data: sec }] = await Promise.all([
    admin.from("ai_provider_keys").select("provider_id"),
    admin.from("email_secrets").select("brevo_api_key_enc, smtp_pass_enc").maybeSingle(),
  ]);
  return {
    brevo: !!sec?.brevo_api_key_enc,
    smtp: !!sec?.smtp_pass_enc,
    providers: Object.fromEntries((keys ?? []).map((k) => [k.provider_id, true])),
  };
}
