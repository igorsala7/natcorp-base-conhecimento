"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import type { Json } from "@/lib/database.types";
import type { IntegResult } from "./actions";

async function garantirPermissao(): Promise<string | null> {
  try {
    await requirePermission("integrations.manage", null);
    return null;
  } catch {
    return "Sem permissão para gerenciar integrações.";
  }
}

// ─────────────────────────────── Params ─────────────────────────────────────
const paramSchema = z.object({
  nome: z.string().trim().min(1, "Todo parâmetro precisa de nome."),
  descricao: z.string().trim().default(""),
  tipo: z.enum(["string", "number", "date", "enum", "boolean"]),
  origem: z.enum(["modelo", "identidade", "fixo", "credencial"]),
  obrigatorio: z.boolean().default(false),
  local: z.enum(["query", "path", "body", "header", "none"]).default("query"),
  mascara: z.string().nullish(),
  opcoes: z.array(z.string()).optional(),
  campoIdentidade: z.enum(["usuario", "cod_empresa", "matricula", "perfil", "portal", "cpf"]).nullish(),
  valorFixo: z.string().nullish(),
  campoCredencial: z.string().nullish(),
});

/** Loop/expansão — ver LoopConfig / ai_tools.loop. `month` usa from/to; `values` só param. */
const loopSchema = z.object({
  unit: z.enum(["month", "values"]),
  param: z.string().trim().min(1),
  from: z.string().trim().nullish(),
  to: z.string().trim().nullish(),
  max: z.number().int().positive().nullish(),
});

const toolSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .min(1, "Informe uma chave.")
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Chave: só minúsculas, números e _."),
  name: z.string().trim().min(1, "Informe um nome.").max(200),
  description: z.string().trim().min(1, "Descreva o que a API faz (a IA usa isto)."),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path_template: z.string().trim().default(""),
  auth_type: z.enum(["none", "basic", "api_key", "bearer", "oauth2"]),
  params: z.array(paramSchema).default([]),
  response_hint: z.string().trim().nullish(),
  active: z.boolean().default(true),
  // Reestrutura: endpoint externo + prompt próprio + campos avançados.
  endpoint_kind: z.enum(["base", "external"]).default("base"),
  external_url: z.string().trim().nullish(),
  credential_id: z.string().uuid().nullish(),
  system_prompt: z.string().trim().default(""),
  body_mode: z.string().trim().nullish(),
  guard: z.string().trim().nullish(),
  cache_ttl: z.number().int().positive().nullish(),
  loop: loopSchema.nullish(),
  /** Bases onde a tool fica ATIVA (grava ai_base_tools.enabled). undefined = não mexe. */
  baseIds: z.array(z.string().uuid()).optional(),
});

export async function saveTool(input: unknown): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = toolSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const t = parsed.data;

  const externa = t.endpoint_kind === "external";
  const supabase = await createClient();
  const linha = {
    key: t.key,
    name: t.name,
    description: t.description,
    method: t.method,
    path_template: t.path_template,
    auth_type: t.auth_type,
    params: t.params as unknown as Json,
    response_hint: t.response_hint?.trim() || null,
    active: t.active,
    endpoint_kind: t.endpoint_kind,
    external_url: externa ? t.external_url?.trim() || null : null,
    credential_id: externa ? t.credential_id ?? null : null,
    system_prompt: t.system_prompt ?? "",
    body_mode: t.body_mode?.trim() || null,
    guard: t.guard?.trim() || null,
    cache_ttl: t.cache_ttl ?? null,
    loop: (t.loop ?? null) as unknown as Json,
    updated_at: new Date().toISOString(),
  };

  let toolId = t.id;
  if (t.id) {
    const { error } = await supabase.from("ai_tools").update(linha).eq("id", t.id);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Já existe uma tool com essa chave." };
      return { ok: false, error: `Falha ao salvar: ${error.message}` };
    }
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("ai_tools")
      .insert({ ...linha, created_by: user?.id ?? null })
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") return { ok: false, error: "Já existe uma tool com essa chave." };
      return { ok: false, error: `Falha ao criar: ${error?.message}` };
    }
    toolId = data.id;
  }

  // Acesso por base: reescreve ai_base_tools.enabled a partir do seletor de bases.
  // Só quando `baseIds` foi enviado (o diálogo sempre envia a seleção atual).
  if (t.baseIds) {
    await supabase.from("ai_base_tools").delete().eq("tool_id", toolId!);
    if (t.baseIds.length) {
      await supabase
        .from("ai_base_tools")
        .insert([...new Set(t.baseIds)].map((base_id) => ({ base_id, tool_id: toolId!, enabled: true })));
    }
  }

  await audit({
    action: t.id ? "integrations.tool.update" : "integrations.tool.create",
    entityType: "ai_tool",
    entityId: toolId!,
    spaceId: null,
    after: { key: t.key, endpoint_kind: t.endpoint_kind, bases: t.baseIds?.length },
  });
  revalidatePath("/admin/integracoes");
  return { ok: true, id: toolId };
}

export async function deleteTool(id: string): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const supabase = await createClient();
  // As ativações por base (ai_base_tools) e os vínculos com agentes caem por cascade.
  const { error } = await supabase.from("ai_tools").delete().eq("id", id);
  if (error) return { ok: false, error: `Falha ao excluir: ${error.message}` };
  await audit({ action: "integrations.tool.delete", entityType: "ai_tool", entityId: id, spaceId: null });
  revalidatePath("/admin/integracoes");
  return { ok: true };
}

// ─────────── Ativação de UMA tool em UMA base (ai_base_tools.enabled) ─────────
// A URL base e a credencial vivem na base/tool (não mais aqui); resta só o flag.
const baseToolSchema = z.object({
  baseId: z.string().uuid(),
  toolId: z.string().uuid(),
  enabled: z.boolean().default(true),
});

export async function setBaseTool(input: unknown): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = baseToolSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { baseId, toolId, enabled } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_base_tools")
    .upsert({ base_id: baseId, tool_id: toolId, enabled }, { onConflict: "base_id,tool_id" });
  if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };
  await audit({ action: "integrations.base_tool.set", entityType: "ai_base_tool", entityId: `${baseId}:${toolId}`, spaceId: null, after: { enabled } });
  revalidatePath("/admin/integracoes");
  return { ok: true };
}

export async function removeBaseTool(baseId: string, toolId: string): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const supabase = await createClient();
  const { error } = await supabase.from("ai_base_tools").delete().eq("base_id", baseId).eq("tool_id", toolId);
  if (error) return { ok: false, error: `Falha ao remover: ${error.message}` };
  await audit({ action: "integrations.base_tool.remove", entityType: "ai_base_tool", entityId: `${baseId}:${toolId}`, spaceId: null });
  revalidatePath("/admin/integracoes");
  return { ok: true };
}
