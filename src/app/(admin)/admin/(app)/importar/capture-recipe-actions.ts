"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/permissions";

export type CaptureRecipe = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  instrucao: string;
};

/** Instruções de navegação salvas de uma documentação (RLS controla o acesso). */
export async function listCaptureRecipes(spaceId: string): Promise<CaptureRecipe[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("capture_recipes")
    .select("id, name, description, url, instrucao")
    .eq("space_id", spaceId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as CaptureRecipe[];
}

const saveSchema = z.object({
  spaceId: z.string().uuid(),
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(600).nullable().optional(),
  url: z.string().max(600).nullable().optional(),
  instrucao: z.string().trim().min(1).max(8000),
});

export type SaveRecipeResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveCaptureRecipe(input: z.infer<typeof saveSchema>): Promise<SaveRecipeResult> {
  if (!(await getSessionUser())) return { ok: false, error: "Sua sessão expirou. Recarregue a página." };
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const { spaceId, id, name, description, url, instrucao } = parsed.data;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // RLS (content.import OU content.create) recusa quem não pode; o update por id
  // também é filtrado pelo space_id para não editar recipe de outra documentação.
  if (id) {
    const { data, error } = await supabase
      .from("capture_recipes")
      .update({ name, description: description ?? null, url: url ?? null, instrucao })
      .eq("id", id)
      .eq("space_id", spaceId)
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, error: error?.message ?? "Sem permissão." };
    return { ok: true, id: data.id };
  }
  const { data, error } = await supabase
    .from("capture_recipes")
    .insert({ space_id: spaceId, name, description: description ?? null, url: url ?? null, instrucao, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao salvar." };
  return { ok: true, id: data.id };
}

export async function deleteCaptureRecipe(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await getSessionUser())) return { ok: false, error: "Sua sessão expirou." };
  const supabase = await createClient();
  const { error } = await supabase.from("capture_recipes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
