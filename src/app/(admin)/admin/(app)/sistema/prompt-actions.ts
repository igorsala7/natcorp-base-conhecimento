"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { getCategory } from "@/lib/ai/prompt-registry";
import { invalidatePromptCache } from "@/lib/ai/prompts";

export type PromptResult = { ok: true; msg?: string } | { ok: false; error: string };

/** Salva os campos SOBRESCRITOS de uma categoria (só o que difere do código). */
export async function salvarPrompts(catKey: string, fields: Record<string, string>): Promise<PromptResult> {
  try {
    await requirePermission("ai.configure", null);
    const cat = getCategory(catKey);
    if (!cat) return { ok: false, error: "Categoria desconhecida." };

    // Guarda apenas o que difere do default do código (mantém a linha enxuta e
    // faz o "restaurar por campo" acontecer sozinho ao igualar o default).
    const overrides: Record<string, string> = {};
    for (const f of cat.fields) {
      const v = (fields[f.key] ?? "").toString();
      if (v.trim() !== "" && v !== String(f.default)) overrides[f.key] = v;
    }

    const supabase = await createClient();
    if (Object.keys(overrides).length === 0) {
      await supabase.from("prompt_overrides").delete().eq("key", catKey);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("prompt_overrides").upsert({
        key: catKey, fields: overrides, updated_at: new Date().toISOString(), updated_by: user?.id ?? null,
      });
    }
    invalidatePromptCache();
    await audit({ action: "space.update", entityType: "prompt", entityId: catKey, spaceId: null });
    revalidatePath("/admin/sistema");
    return { ok: true, msg: "Prompts salvos." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }
}

/** Restaura uma categoria para o padrão do código-fonte (apaga os overrides). */
export async function restaurarPrompts(catKey: string): Promise<PromptResult> {
  try {
    await requirePermission("ai.configure", null);
    if (!getCategory(catKey)) return { ok: false, error: "Categoria desconhecida." };
    const supabase = await createClient();
    await supabase.from("prompt_overrides").delete().eq("key", catKey);
    invalidatePromptCache();
    await audit({ action: "space.update", entityType: "prompt_restore", entityId: catKey, spaceId: null });
    revalidatePath("/admin/sistema");
    return { ok: true, msg: "Restaurado para o padrão do código." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }
}
