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
  local: z.enum(["query", "path", "body", "header"]).default("query"),
  mascara: z.string().nullish(),
  opcoes: z.array(z.string()).optional(),
  campoIdentidade: z.enum(["usuario", "cod_empresa", "matricula", "perfil", "portal", "cpf"]).nullish(),
  valorFixo: z.string().nullish(),
  campoCredencial: z.string().nullish(),
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
});

export async function saveTool(input: unknown): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = toolSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const t = parsed.data;

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
    updated_at: new Date().toISOString(),
  };

  if (t.id) {
    const { error } = await supabase.from("ai_tools").update(linha).eq("id", t.id);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Já existe uma tool com essa chave." };
      return { ok: false, error: `Falha ao salvar: ${error.message}` };
    }
    await audit({ action: "integrations.tool.update", entityType: "ai_tool", entityId: t.id, spaceId: null, after: { key: t.key } });
    revalidatePath("/admin/integracoes");
    return { ok: true, id: t.id };
  }

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
  await audit({ action: "integrations.tool.create", entityType: "ai_tool", entityId: data.id, spaceId: null, after: { key: t.key } });
  revalidatePath("/admin/integracoes");
  return { ok: true, id: data.id };
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

// ───────────────────── Ativação por base (ai_base_tools) ─────────────────────
const baseToolSchema = z.object({
  baseId: z.string().uuid(),
  toolId: z.string().uuid(),
  enabled: z.boolean().default(true),
  base_url: z.string().trim().nullish(),
  credentialId: z.string().uuid().nullish(),
});

export async function setBaseTool(input: unknown): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = baseToolSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { baseId, toolId, enabled, base_url, credentialId } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("ai_base_tools").upsert(
    {
      base_id: baseId,
      tool_id: toolId,
      enabled,
      base_url: base_url?.trim() || null,
      credential_id: credentialId ?? null,
    },
    { onConflict: "base_id,tool_id" },
  );
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
