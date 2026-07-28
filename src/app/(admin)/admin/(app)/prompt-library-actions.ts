"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/permissions";

export type SavedPrompt = { id: string; label: string | null; texto: string };
export type SavePromptResult = { ok: true; id: string } | { ok: false; error: string };

/** Prompts salvos do usuário LOGADO (RLS restringe a user_id = auth.uid). */
export async function listMyPrompts(): Promise<SavedPrompt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("prompts_usuario_sistema")
    .select("id, label, texto")
    .order("updated_at", { ascending: false })
    .limit(100);
  return (data ?? []) as SavedPrompt[];
}

const saveSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  label: z.string().max(80).nullable().optional(),
  texto: z.string().trim().min(1).max(8000),
});

export async function saveMyPrompt(input: z.infer<typeof saveSchema>): Promise<SavePromptResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sua sessão expirou. Recarregue a página." };
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const { id, label, texto } = parsed.data;
  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase
      .from("prompts_usuario_sistema")
      .update({ label: label ?? null, texto })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, error: error?.message ?? "Prompt não encontrado." };
    return { ok: true, id: data.id };
  }
  const { data, error } = await supabase
    .from("prompts_usuario_sistema")
    .insert({ user_id: user.id, label: label ?? null, texto })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao salvar." };
  return { ok: true, id: data.id };
}

export async function deleteMyPrompt(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await getSessionUser())) return { ok: false, error: "Sua sessão expirou." };
  const supabase = await createClient();
  const { error } = await supabase.from("prompts_usuario_sistema").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
