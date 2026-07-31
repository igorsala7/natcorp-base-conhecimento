"use server";

import { revalidatePath } from "next/cache";
import { generateText, embed, experimental_transcribe as transcribe } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission, hasPermission } from "@/lib/auth/permissions";
import { currentMaxLevel } from "@/lib/auth/roles";
import { audit } from "@/lib/auth/audit";
import { encryptSecret } from "@/lib/crypto/secrets";
import {
  invalidateAiCache,
  resolveAi,
  languageModel,
  embeddingModel,
  embeddingCallOptions,
  aiTimeout,
  ehTimeout,
} from "@/lib/ai/config";
import type { ProviderKind, Purpose } from "@/lib/ai/catalog";
import { sendEmail } from "@/lib/email/send";
import { loadEmailWrapper } from "@/lib/email/template";
import { emailParagraph } from "@/lib/blocks/email-html";
import { BlockDocSchema } from "@/lib/blocks/schema";
import { normalizeDoc } from "@/lib/blocks/convert";

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
  /** Base dona do provedor ('' = padrão global). Só usado ao CRIAR. */
  base?: string;
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
        base_code: (input.base ?? "").trim(),
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
    // Sem APP_ENCRYPTION_KEY o segredo é gravado em CLARO (prefixo `plain:`),
    // por escolha do ambiente de desenvolvimento. A função no banco continua
    // exigindo nível 100; a checagem daqui é só para a mensagem ser clara.
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
  base = "",
): Promise<SysResult> {
  try {
    await requirePermission("ai.configure", null);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const supabase = await createClient();

  // Sem provedor = remove o override desta base (herda o padrão/env).
  if (!providerId) {
    const { error } = await supabase.from("ai_assignments").delete().eq("purpose", purpose).eq("base_code", base);
    if (error) return { ok: false, error: error.message };
    invalidateAiCache();
    revalidatePath("/admin/sistema");
    return { ok: true, msg: base ? "Removido — esta base volta a herdar o padrão." : "Voltou a usar a configuração das variáveis de ambiente." };
  }

  if (!model.trim()) return { ok: false, error: "Informe o modelo." };
  const { error } = await supabase
    .from("ai_assignments")
    .upsert(
      { base_code: base, purpose, provider_id: providerId, model: model.trim(), updated_at: new Date().toISOString() },
      { onConflict: "base_code,purpose" },
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
/** WAV mono 16 kHz de ~1s de silêncio — áudio válido para testar o Whisper. */
function wavSilencioTeste(): Uint8Array {
  const sampleRate = 16000;
  const numSamples = sampleRate; // ~1s (acima do mínimo de 0,1s do Whisper)
  const dataBytes = numSamples * 2; // PCM 16 bits, mono
  const buf = Buffer.alloc(44 + dataBytes); // cabeçalho WAV + dados (já zerados = silêncio)
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // tamanho do bloco fmt
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits por amostra
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);
  return new Uint8Array(buf);
}

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
        abortSignal: aiTimeout("embedding_query"),
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
    if (purpose === "transcricao") {
      // Whisper NÃO é modelo de chat: testar com um `generateText` falha (ou, se
      // não configurado, cai no provedor do Chat e "passa" com o modelo errado).
      // Aqui transcrevemos um áudio de teste de verdade.
      if (cfg.kind !== "openai") {
        return {
          ok: false,
          error: "A transcrição exige um provedor OpenAI-compatível (Whisper). Selecione OpenAI.",
        };
      }
      const openai = createOpenAI({ apiKey: cfg.apiKey, ...(cfg.baseUrl ? { baseURL: cfg.baseUrl } : {}) });
      const r = await transcribe({
        model: openai.transcription(cfg.model),
        audio: wavSilencioTeste(),
        abortSignal: aiTimeout("transcricao"),
      });
      const trecho = (r.text ?? "").trim().slice(0, 40);
      return {
        ok: true,
        msg: `OK — ${cfg.kind}/${cfg.model} transcreveu o áudio de teste${trecho ? ` ("${trecho}")` : ""} (origem: ${cfg.origem}).`,
      };
    }
    const { text } = await generateText({
      model: await languageModel(purpose),
      prompt: "Responda apenas: ok",
      abortSignal: aiTimeout("chat"),
    });
    return {
      ok: true,
      msg: `OK — ${cfg.kind}/${cfg.model} respondeu "${text.trim().slice(0, 40)}" (origem: ${cfg.origem}).`,
    };
  } catch (e) {
    if (ehTimeout(e)) {
      return {
        ok: false,
        error: "O provedor não respondeu dentro do tempo limite. Verifique a rede ou tente um modelo mais rápido.",
      };
    }
    // A mensagem CRUA do provedor é o que resolve o problema de quem configura
    // ("crédito insuficiente", "modelo inexistente", "chave inválida").
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type AiUsageRow = {
  provider: string;
  model: string;
  purpose: string;
  input: number;
  output: number;
  total: number;
  calls: number;
};

/** Dia seguinte (só a parte da data, em UTC) — limite superior exclusivo. */
function proximoDia(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Consumo de IA (tokens de envio/recebimento) por provedor e modelo num
 * intervalo de datas. Agrega no banco (RPC `ai_usage_report`, `[from, to]`
 * inclusivo). Só leitura, gateada por `ai.configure`.
 */
export async function getAiUsageReport(input: {
  from: string;
  to: string;
  /** Tipo: sistema (importador/editor/…), usuário (chat) ou todos (null). */
  kind?: "system" | "user" | null;
  /** Filtros de identidade (só fazem sentido no tipo "usuário"). */
  base?: string;
  usuario?: string;
  portal?: string;
  empresa?: string;
  matricula?: string;
  perfil?: string;
}): Promise<{ ok: true; rows: AiUsageRow[] } | { ok: false; error: string }> {
  if (!(await hasPermission("ai.configure", null))) {
    return { ok: false, error: "Sem permissão." };
  }
  const admin = createAdminClient();
  const limpo = (s?: string) => (s && s.trim() ? s.trim() : null);
  const { data, error } = await admin.rpc("ai_usage_report", {
    p_from: `${input.from}T00:00:00`,
    p_to: `${proximoDia(input.to)}T00:00:00`,
    p_kind: input.kind ?? null,
    pf_base: limpo(input.base),
    pf_usuario: limpo(input.usuario),
    pf_portal: limpo(input.portal),
    pf_empresa: limpo(input.empresa),
    pf_matricula: limpo(input.matricula),
    pf_perfil: limpo(input.perfil),
  });
  if (error) return { ok: false, error: error.message };
  const rows: AiUsageRow[] = (data ?? []).map((r) => ({
    provider: r.provider,
    model: r.model,
    purpose: r.purpose,
    input: Number(r.input_tokens),
    output: Number(r.output_tokens),
    total: Number(r.total_tokens),
    calls: Number(r.calls),
  }));
  return { ok: true, rows };
}

/**
 * Valores DISTINTOS já registrados em ai_usage (kind='user') para popular os
 * filtros do relatório como listas (o admin digita e filtra pelos dados reais,
 * não em campo livre). Só leitura, gateada por `ai.configure`.
 */
export async function getAiUsageFacets(): Promise<
  { ok: true; facets: Record<string, string[]> } | { ok: false; error: string }
> {
  if (!(await hasPermission("ai.configure", null))) return { ok: false, error: "Sem permissão." };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_usage")
    .select("p_base, p_portal, p_perfil, p_usuario, p_empresa, p_matricula")
    .eq("kind", "user")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return { ok: false, error: error.message };
  const col: Record<string, keyof (typeof data)[number]> = {
    base: "p_base", portal: "p_portal", perfil: "p_perfil", usuario: "p_usuario", empresa: "p_empresa", matricula: "p_matricula",
  };
  const facets: Record<string, string[]> = {};
  for (const [campo, coluna] of Object.entries(col)) {
    const set = new Set<string>();
    for (const r of data ?? []) {
      const v = r[coluna];
      if (typeof v === "string" && v.trim()) set.add(v.trim());
    }
    facets[campo] = [...set].sort((a, b) => a.localeCompare(b, "pt-BR")).slice(0, 500);
  }
  return { ok: true, facets };
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

  // Aplica o template salvo — o teste vira a pré-visualização do design real.
  const wrap = await loadEmailWrapper();
  const res = await sendEmail({
    to: user.email,
    subject: "Teste de envio — Base de Conhecimento",
    html: wrap(
      emailParagraph("Se você recebeu esta mensagem, o envio de e-mail está funcionando. ✅") +
        emailParagraph(
          "Este é o layout do seu template de e-mail aplicado ao corpo da mensagem — é assim que os convites, confirmações e novidades vão chegar.",
        ),
    ),
    text: "Se você recebeu esta mensagem, o envio de e-mail está funcionando.",
  });
  return res.ok
    ? { ok: true, msg: `Enviado para ${user.email} via ${res.via}. Confira a caixa de entrada.` }
    : { ok: false, error: res.reason };
}

/** Salva o template de e-mail (BlockDoc) da instalação em email_settings. */
export async function saveEmailTemplate(doc: unknown): Promise<SysResult> {
  try {
    await requirePermission("integrations.manage", null);
  } catch {
    return { ok: false, error: "Sem permissão para configurar integrações." };
  }
  const parsed = BlockDocSchema.safeParse(doc);
  if (!parsed.success) return { ok: false, error: "Template inválido." };
  const { blocks } = normalizeDoc(parsed.data);

  const supabase = await createClient();
  const { error } = await supabase
    .from("email_settings")
    .update({ template: { version: 2, blocks } as never, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { ok: false, error: `Falha ao salvar o template: ${error.message}` };

  await audit({ action: "space.update", entityType: "email_settings", entityId: "email", spaceId: null });
  revalidatePath("/admin/sistema/email-template");
  return { ok: true, msg: "Template de e-mail salvo." };
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
