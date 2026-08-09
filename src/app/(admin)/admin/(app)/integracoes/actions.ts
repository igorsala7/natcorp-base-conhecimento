"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { encryptSecret } from "@/lib/crypto/secrets";
import { CREDENTIAL_FIELDS, metaKeys, requiredKeys, type AuthType } from "@/lib/integrations/credentials";
import { syncBaseModules } from "@/lib/integrations/module-sync";
import type { Json } from "@/lib/database.types";

export type IntegResult = { ok: true; id?: string } | { ok: false; error: string };

async function garantirPermissao(): Promise<string | null> {
  try {
    await requirePermission("integrations.manage", null);
    return null;
  } catch {
    return "Sem permissão para gerenciar integrações.";
  }
}

/**
 * Sincroniza a taxonomia de módulos/submódulos da base a partir do endpoint do
 * cliente (Fase 2b) → alimenta o seletor de módulo/submódulo das tools. Reusa a
 * credencial da base (OAuth ORDS).
 */
export async function syncModulesAction(baseCode: string): Promise<IntegResult & { count?: number }> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const r = await syncBaseModules(String(baseCode ?? "").trim());
  if (!r.ok) return { ok: false, error: r.error ?? "Falha ao sincronizar módulos." };
  await audit({ action: "integrations.modules.sync", entityType: "ai_base", entityId: baseCode, spaceId: null, after: { count: r.count } });
  revalidatePath("/admin/integracoes");
  return { ok: true, count: r.count };
}

// ─────────────────────────────── Bases ──────────────────────────────────────
const baseSchema = z.object({
  base_code: z.string().trim().min(1, "Informe o código da base (p_base).").max(120),
  name: z.string().trim().min(1, "Informe o nome do cliente.").max(200),
  base_url: z.string().trim().nullish(),
  credential_id: z.string().uuid().nullish(),
  // Roteamento por assunto (Opção A): liga o recorte de tools por módulo nesta base.
  tool_routing: z.boolean().default(false),
  // API que lista os perfis do cliente (para a allowlist das ferramentas, #4).
  perfis_endpoint: z.string().trim().nullish(),
  perfis_campo: z.string().trim().nullish(),
  space_ids: z.array(z.string().uuid()).default([]),
});

/** Sincroniza as documentações do chatbot da base (ordem = position). */
async function syncBaseSpaces(
  supabase: Awaited<ReturnType<typeof createClient>>,
  baseId: string,
  spaceIds: string[],
): Promise<void> {
  await supabase.from("ai_base_spaces").delete().eq("base_id", baseId);
  const unicos = [...new Set(spaceIds)];
  if (unicos.length) {
    await supabase
      .from("ai_base_spaces")
      .insert(unicos.map((space_id, i) => ({ base_id: baseId, space_id, position: i })));
  }
}

export async function createBase(input: unknown): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("ai_bases")
    .insert({
      base_code: parsed.data.base_code,
      name: parsed.data.name,
      base_url: parsed.data.base_url?.trim() || null,
      credential_id: parsed.data.credential_id ?? null,
      tool_routing: parsed.data.tool_routing,
      perfis_endpoint: parsed.data.perfis_endpoint?.trim() || null,
      perfis_campo: parsed.data.perfis_campo?.trim() || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "Já existe uma base com esse código." };
    return { ok: false, error: `Falha ao criar: ${error?.message}` };
  }
  await syncBaseSpaces(supabase, data.id, parsed.data.space_ids);
  await audit({ action: "integrations.base.create", entityType: "ai_base", entityId: data.id, spaceId: null, after: parsed.data });
  revalidatePath("/admin/integracoes");
  return { ok: true, id: data.id };
}

export async function updateBase(input: unknown): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const schema = baseSchema.extend({ id: z.string().uuid(), active: z.boolean() });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { id, base_code, name, active, base_url, credential_id, tool_routing, perfis_endpoint, perfis_campo, space_ids } = parsed.data;
  const { error } = await supabase
    .from("ai_bases")
    .update({
      base_code,
      name,
      active,
      base_url: base_url?.trim() || null,
      credential_id: credential_id ?? null,
      tool_routing,
      perfis_endpoint: perfis_endpoint?.trim() || null,
      perfis_campo: perfis_campo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe uma base com esse código." };
    return { ok: false, error: `Falha ao salvar: ${error.message}` };
  }
  await syncBaseSpaces(supabase, id, space_ids);
  await audit({ action: "integrations.base.update", entityType: "ai_base", entityId: id, spaceId: null, after: { base_code, name, active } });
  revalidatePath("/admin/integracoes");
  return { ok: true, id };
}

/** Salva o layout do mapa visual (posições dos nós) de uma base. Cosmético — sem auditoria. */
const layoutSchema = z.object({
  baseId: z.string().uuid(),
  layout: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
});

export async function saveFlowLayout(input: unknown): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = layoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Layout inválido." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_bases")
    .update({ flow_layout: parsed.data.layout as unknown as Json })
    .eq("id", parsed.data.baseId);
  if (error) return { ok: false, error: `Falha ao salvar o layout: ${error.message}` };
  // Cosmético: não revalida (evita refetch a cada arraste).
  return { ok: true };
}

export async function deleteBase(id: string): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const supabase = await createClient();
  // As credenciais (e seus segredos) e ativações caem por ON DELETE CASCADE.
  const { error } = await supabase.from("ai_bases").delete().eq("id", id);
  if (error) return { ok: false, error: `Falha ao excluir: ${error.message}` };
  await audit({ action: "integrations.base.delete", entityType: "ai_base", entityId: id, spaceId: null });
  revalidatePath("/admin/integracoes");
  return { ok: true };
}

// ──────────────────────────── Credenciais ───────────────────────────────────
const credSchema = z.object({
  id: z.string().uuid().optional(),
  baseId: z.string().uuid(),
  name: z.string().trim().min(1, "Dê um nome à credencial.").max(120),
  auth_type: z.enum(["none", "basic", "api_key", "bearer", "oauth2", "oauth2_user"]),
  active: z.boolean().default(true),
  /** Blob de segredo por tipo; ausente/vazio no update = manter o atual. */
  secret: z.record(z.string(), z.string()).nullish(),
});

export async function saveCredential(input: unknown): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = credSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { id, baseId, name, auth_type, active } = parsed.data;

  // Normaliza o blob: remove campos vazios; só o que sobrar é "informado".
  const bruto = parsed.data.secret ?? {};
  const secret: Record<string, string> = {};
  for (const [k, v] of Object.entries(bruto)) if (v && v.trim()) secret[k] = v.trim();

  // `provider` chega junto do blob porque o formulário renderiza os campos a
  // partir de CREDENTIAL_FIELDS, mas ele NÃO é segredo: vai para uma coluna, de
  // onde a tela e a rota de consentimento o leem sem decifrar nada. Sai do blob
  // aqui para não ser cifrado à toa nem sumir da consulta.
  // Campos `meta` vao para COLUNA, nao para o blob cifrado. Saem daqui antes de
  // qualquer validacao de segredo — sem isso eram cobrados como "faltando" logo
  // depois de removidos, e a tela pedia para preencher o que ja estava.
  const provider = secret.provider?.trim().toLowerCase() || null;
  for (const k of metaKeys(auth_type as AuthType)) delete secret[k];

  const informouSegredo = Object.keys(secret).length > 0;

  // ── VALIDAR ANTES DE CRIAR ────────────────────────────────────────────
  // A ordem importava: os metadados eram gravados primeiro e o segredo depois,
  // entao qualquer recusa na validacao deixava uma credencial CRIADA E VAZIA na
  // tela — e o usuario nao tinha como saber que precisava excluir aquilo.
  if (auth_type === "oauth2_user" && provider !== "microsoft" && provider !== "google") {
    return { ok: false, error: "Escolha o provedor: Microsoft ou Google." };
  }
  // Os campos avançados apontam para o PROVEDOR. Apontados para nós mesmos, o
  // servidor faz POST no proprio callback (que so aceita GET) e o consentimento
  // morre com um "HTTP 405" que nao explica nada. Aconteceu de verdade: e a
  // confusao natural entre "URL do token" e a URL de callback que se cadastra
  // no portal do Azure.
  if (auth_type === "oauth2_user") {
    const proprio = (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").host.toLowerCase();
      } catch {
        return "";
      }
    })();
    for (const campo of ["token_url", "authorize_url"] as const) {
      const v = secret[campo];
      if (!v) continue;
      let host = "";
      try {
        host = new URL(v).host.toLowerCase();
      } catch {
        return { ok: false, error: `A ${campo === "token_url" ? "URL do token" : "URL de consentimento"} não é uma URL válida. Deixe em branco para usar o padrão do provedor.` };
      }
      if ((proprio && host === proprio) || /\/connect\//.test(v)) {
        return {
          ok: false,
          error:
            "Esse campo é o endereço DO PROVEDOR, não o seu callback. O callback se cadastra no portal do Azure/Google. Deixe em branco para usar o padrão.",
        };
      }
    }
  }
  if (auth_type !== "none" && informouSegredo) {
    const faltando = requiredKeys(auth_type).filter((k) => !secret[k]);
    if (faltando.length) {
      const rotulos = CREDENTIAL_FIELDS[auth_type as AuthType]
        .filter((f) => faltando.includes(f.key))
        .map((f) => f.label)
        .join(", ");
      return { ok: false, error: `Preencha: ${rotulos}.` };
    }
  }
  // Credencial NOVA sem segredo nenhum tambem nao passa: seria uma linha inerte
  // que so falha na primeira chamada, longe daqui.
  if (!id && auth_type !== "none" && !informouSegredo) {
    return { ok: false, error: "Preencha as credenciais antes de salvar." };
  }

  const supabase = await createClient();

  // 1) metadados
  let credId = id;
  if (credId) {
    const { error } = await supabase
      .from("ai_base_credentials")
      .update({ name, auth_type, active, ...(provider ? { provider } : {}), updated_at: new Date().toISOString() })
      .eq("id", credId);
    if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("ai_base_credentials")
      .insert({ base_id: baseId, name, auth_type, active, provider, created_by: user?.id ?? null })
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") return { ok: false, error: "Já existe uma credencial com esse nome nesta base." };
      return { ok: false, error: `Falha ao criar: ${error?.message}` };
    }
    credId = data.id;
  }

  // 2) segredo (cifrado). 'none' não tem segredo → limpa.
  if (auth_type === "none") {
    await supabase.rpc("set_base_credential_secret", { p_credential_id: credId!, p_secret_enc: null as unknown as string });
  } else if (informouSegredo) {
    // Ja validado acima, antes de criar a linha.
    const { error } = await supabase.rpc("set_base_credential_secret", {
      p_credential_id: credId!,
      p_secret_enc: encryptSecret(JSON.stringify(secret)),
    });
    if (error) return { ok: false, error: `Falha ao gravar as credenciais: ${error.message}` };
  } else if (!id) {
    // Credencial NOVA de um tipo que exige segredo, mas nada foi informado.
    return { ok: false, error: "Informe as credenciais deste tipo de autenticação." };
  }

  await audit({
    action: id ? "integrations.credential.update" : "integrations.credential.create",
    entityType: "ai_base_credential",
    entityId: credId!,
    spaceId: null,
    after: { name, auth_type, active, segredoAtualizado: informouSegredo || auth_type === "none" },
  });
  revalidatePath("/admin/integracoes");
  return { ok: true, id: credId };
}

export async function deleteCredential(id: string): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const supabase = await createClient();
  // O segredo cai por ON DELETE CASCADE de ai_base_credential_secrets.
  const { error } = await supabase.from("ai_base_credentials").delete().eq("id", id);
  if (error) return { ok: false, error: `Falha ao excluir: ${error.message}` };
  await audit({ action: "integrations.credential.delete", entityType: "ai_base_credential", entityId: id, spaceId: null });
  revalidatePath("/admin/integracoes");
  return { ok: true };
}
