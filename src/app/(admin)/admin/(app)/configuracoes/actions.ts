"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";

export type SettingsResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  spaceId: z.string().uuid(),
  name: z.string().min(1).max(120),
  visibility: z.enum(["public", "private", "password"]),
  customDomain: z
    .string()
    .max(200)
    .regex(/^[a-z0-9.-]*$/i, "Domínio inválido.")
    .optional()
    .or(z.literal("")),
  // Opcional: define/atualiza a senha (só quando visibility='password').
  password: z.string().min(4).max(200).optional().or(z.literal("")),
});

/** Atualiza nome, visibilidade e domínio do espaço. Exige space.manage. */
export async function updateSpaceSettings(input: unknown): Promise<SettingsResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { spaceId, name, visibility, customDomain, password } = parsed.data;

  try {
    await requirePermission("space.manage", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para configurar este espaço." };
  }

  const supabase = await createClient();

  // Define a senha quando o espaço é protegido e uma nova senha foi informada.
  if (visibility === "password" && password) {
    const { error: pwErr } = await supabase.rpc("set_space_password", {
      p_space_id: spaceId,
      p_plain: password,
    });
    if (pwErr) return { ok: false, error: `Falha ao definir a senha: ${pwErr.message}` };
  }
  const { data: before } = await supabase
    .from("spaces")
    .select("name, visibility, custom_domain")
    .eq("id", spaceId)
    .single();

  const domain = (customDomain ?? "").trim() || null;
  const { error } = await supabase
    .from("spaces")
    .update({ name: name.trim(), visibility, custom_domain: domain })
    .eq("id", spaceId);
  if (error) {
    return {
      ok: false,
      error: error.message.includes("duplicate")
        ? "Este domínio já está em uso por outro espaço."
        : `Falha ao salvar: ${error.message}`,
    };
  }

  await audit({
    action: "space.settings",
    entityType: "space",
    entityId: spaceId,
    spaceId,
    before,
    after: { name, visibility, custom_domain: domain },
  });
  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin/conteudo");
  return { ok: true };
}
