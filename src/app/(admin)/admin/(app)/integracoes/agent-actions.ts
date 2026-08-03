"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { invalidateBaseContext } from "@/lib/integrations/resolve";
import type { IntegResult } from "./actions";

async function garantirPermissao(): Promise<string | null> {
  try {
    await requirePermission("integrations.manage", null);
    return null;
  } catch {
    return "Sem permissão para gerenciar integrações.";
  }
}

const agentSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .min(1, "Informe uma chave.")
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Chave: só minúsculas, números e _."),
  name: z.string().trim().min(1, "Informe um nome.").max(200),
  description: z.string().trim().min(1, "Descreva quando usar este agente (o roteador usa isto)."),
  providerId: z.string().uuid().nullish(),
  model: z.string().trim().nullish(),
  system_prompt: z.string().default(""),
  parentAgentId: z.string().uuid().nullish(),
  scope_permission: z.string().trim().nullish(),
  priority: z.number().int().default(0),
  active: z.boolean().default(true),
  toolIds: z.array(z.string().uuid()).default([]),
});

export async function saveAgent(input: unknown): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = agentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const a = parsed.data;
  if (a.id && a.parentAgentId === a.id) return { ok: false, error: "Um agente não pode ser pai de si mesmo." };

  const supabase = await createClient();
  const linha = {
    key: a.key,
    name: a.name,
    description: a.description,
    provider_id: a.providerId ?? null,
    model: a.model?.trim() || null,
    system_prompt: a.system_prompt,
    parent_agent_id: a.parentAgentId ?? null,
    scope_permission: a.scope_permission?.trim() || null,
    priority: a.priority,
    active: a.active,
    updated_at: new Date().toISOString(),
  };

  let agentId = a.id;
  if (agentId) {
    const { error } = await supabase.from("ai_agents").update(linha).eq("id", agentId);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Já existe um agente com essa chave." };
      return { ok: false, error: `Falha ao salvar: ${error.message}` };
    }
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("ai_agents")
      .insert({ ...linha, created_by: user?.id ?? null })
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") return { ok: false, error: "Já existe um agente com essa chave." };
      return { ok: false, error: `Falha ao criar: ${error?.message}` };
    }
    agentId = data.id;
  }

  // Sincroniza as tools do agente: apaga as atuais e insere a seleção.
  const { error: delErr } = await supabase.from("ai_agent_tools").delete().eq("agent_id", agentId!);
  if (delErr) return { ok: false, error: `Falha ao vincular tools: ${delErr.message}` };
  if (a.toolIds.length) {
    const { error: insErr } = await supabase
      .from("ai_agent_tools")
      .insert(a.toolIds.map((tool_id) => ({ agent_id: agentId!, tool_id })));
    if (insErr) return { ok: false, error: `Falha ao vincular tools: ${insErr.message}` };
  }

  await audit({
    action: a.id ? "integrations.agent.update" : "integrations.agent.create",
    entityType: "ai_agent",
    entityId: agentId!,
    spaceId: null,
    after: { key: a.key, tools: a.toolIds.length },
  });
  invalidateBaseContext();
  revalidatePath("/admin/integracoes");
  return { ok: true, id: agentId };
}

/** Vincula UMA tool a UM agente (aresta do mapa visual). Idempotente. */
export async function linkAgentTool(agentId: string, toolId: string): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  if (!z.string().uuid().safeParse(agentId).success || !z.string().uuid().safeParse(toolId).success) {
    return { ok: false, error: "IDs inválidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_agent_tools")
    .upsert({ agent_id: agentId, tool_id: toolId }, { onConflict: "agent_id,tool_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: `Falha ao vincular: ${error.message}` };
  await audit({ action: "integrations.agent_tool.link", entityType: "ai_agent_tool", entityId: `${agentId}:${toolId}`, spaceId: null });
  invalidateBaseContext();
  revalidatePath("/admin/integracoes");
  return { ok: true };
}

/** Remove o vínculo tool↔agente (apagar a aresta). */
export async function unlinkAgentTool(agentId: string, toolId: string): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const supabase = await createClient();
  const { error } = await supabase.from("ai_agent_tools").delete().eq("agent_id", agentId).eq("tool_id", toolId);
  if (error) return { ok: false, error: `Falha ao desvincular: ${error.message}` };
  await audit({ action: "integrations.agent_tool.unlink", entityType: "ai_agent_tool", entityId: `${agentId}:${toolId}`, spaceId: null });
  invalidateBaseContext();
  revalidatePath("/admin/integracoes");
  return { ok: true };
}

export async function deleteAgent(id: string): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const supabase = await createClient();
  // Vínculos com tools caem por cascade; agentes-filhos ficam com parent nulo.
  const { error } = await supabase.from("ai_agents").delete().eq("id", id);
  if (error) return { ok: false, error: `Falha ao excluir: ${error.message}` };
  await audit({ action: "integrations.agent.delete", entityType: "ai_agent", entityId: id, spaceId: null });
  invalidateBaseContext();
  revalidatePath("/admin/integracoes");
  return { ok: true };
}
