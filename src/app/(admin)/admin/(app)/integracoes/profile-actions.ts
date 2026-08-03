"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import type { IntegResult } from "./actions";

async function garantirPermissao(): Promise<string | null> {
  try {
    await requirePermission("integrations.manage", null);
    return null;
  } catch {
    return "Sem permissão para gerenciar integrações.";
  }
}

// Tipos de AÇÃO da análise (checkboxes) — compõem a persona quando não há
// "comportamento" livre. Mantido em sincronia com report-profile-core.ts (ACOES_TXT)
// e a lista da UI em profiles-manager.tsx. NÃO exportar: "use server" só exporta funções.
const ACOES_PERFIL = ["sugestoes", "pontos_atencao", "alertas", "estrategias", "diagnostico"] as const;

const profileSchema = z.object({
  id: z.string().uuid().optional(),
  base_code: z.string().trim().min(1, "Informe a base do cliente."),
  titulo: z.string().trim().min(1, "Informe um título.").max(200),
  nome: z.string().trim().max(120).nullish(),
  descricao: z.string().trim().nullish(),
  cargo: z.string().trim().max(200).nullish(),
  comportamento: z.string().trim().nullish(),
  acoes: z.array(z.enum(ACOES_PERFIL)).default([]),
  prompt_refino: z.string().default(""),
  requires_perfil: z.string().trim().nullish(),
  priority: z.number().int().default(0),
  active: z.boolean().default(true),
  modulos: z
    .array(z.object({ modulo: z.string().trim().min(1), submodulo: z.string().trim().nullish() }))
    .default([]),
});

export async function saveProfile(input: unknown): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const p = parsed.data;

  const supabase = await createClient();
  const linha = {
    base_code: p.base_code,
    titulo: p.titulo,
    nome: p.nome?.trim() || null,
    descricao: p.descricao?.trim() || null,
    cargo: p.cargo?.trim() || null,
    comportamento: p.comportamento?.trim() || null,
    acoes: p.acoes,
    prompt_refino: p.prompt_refino ?? "",
    requires_perfil: p.requires_perfil?.trim() || null,
    priority: p.priority,
    active: p.active,
    updated_at: new Date().toISOString(),
  };

  let profileId = p.id;
  if (profileId) {
    const { error } = await supabase.from("ai_agent_profiles").update(linha).eq("id", profileId);
    if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("ai_agent_profiles")
      .insert({ ...linha, created_by: user?.id ?? null })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: `Falha ao criar: ${error?.message}` };
    profileId = data.id;
  }

  // Sincroniza os MÓDULOS vinculados: apaga os atuais e insere a seleção. Dedup por
  // (modulo, submodulo) para não bater no índice único.
  const { error: delErr } = await supabase.from("ai_agent_profile_modules").delete().eq("profile_id", profileId!);
  if (delErr) return { ok: false, error: `Falha ao vincular módulos: ${delErr.message}` };
  const vistos = new Set<string>();
  const linhas = p.modulos
    .map((m) => ({ modulo: m.modulo.trim(), submodulo: m.submodulo?.trim() || null }))
    .filter((m) => {
      const k = m.modulo.toLowerCase() + "||" + (m.submodulo?.toLowerCase() ?? "");
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .map((m) => ({ profile_id: profileId!, modulo: m.modulo, submodulo: m.submodulo }));
  if (linhas.length) {
    const { error: insErr } = await supabase.from("ai_agent_profile_modules").insert(linhas);
    if (insErr) return { ok: false, error: `Falha ao vincular módulos: ${insErr.message}` };
  }

  await audit({
    action: p.id ? "integrations.profile.update" : "integrations.profile.create",
    entityType: "ai_agent_profile",
    entityId: profileId!,
    spaceId: null,
    after: { base: p.base_code, titulo: p.titulo, modulos: linhas.length },
  });
  revalidatePath("/admin/integracoes");
  return { ok: true, id: profileId };
}

export async function deleteProfile(id: string): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const supabase = await createClient();
  // Os módulos vinculados caem por cascade.
  const { error } = await supabase.from("ai_agent_profiles").delete().eq("id", id);
  if (error) return { ok: false, error: `Falha ao excluir: ${error.message}` };
  await audit({ action: "integrations.profile.delete", entityType: "ai_agent_profile", entityId: id, spaceId: null });
  revalidatePath("/admin/integracoes");
  return { ok: true };
}
