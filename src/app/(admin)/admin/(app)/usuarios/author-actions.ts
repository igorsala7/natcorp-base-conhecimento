"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { slugify } from "@/lib/content/slug";

export type AuthorRow = {
  id: string;
  public_name: string;
  slug: string;
  avatar_url: string | null;
  bio: string | null;
  active: boolean;
  artigos: number;
};

export type AuthorActionResult = { ok: true } | { ok: false; error: string };

function err(error: string): AuthorActionResult {
  return { ok: false, error };
}

/** Autores com contagem de artigos atribuídos (para gestão e reatribuição). */
export async function listAuthors(): Promise<AuthorRow[]> {
  const supabase = await createClient();
  const { data: authors } = await supabase
    .from("author_profiles")
    .select("id, public_name, slug, avatar_url, bio, active")
    .order("public_name");
  if (!authors?.length) return [];
  const { data: nodes } = await supabase
    .from("nodes")
    .select("author_id")
    .in("author_id", authors.map((a) => a.id))
    .is("deleted_at", null);
  const contagem = new Map<string, number>();
  for (const n of nodes ?? []) {
    if (n.author_id) contagem.set(n.author_id, (contagem.get(n.author_id) ?? 0) + 1);
  }
  return authors.map((a) => ({ ...a, artigos: contagem.get(a.id) ?? 0 }));
}

const saveSchema = z.object({
  userId: z.string().uuid(),
  publicName: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(80).nullable(),
  avatarUrl: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .refine((v) => !v || v.startsWith("https://") || v.startsWith("/"), {
      message: "Avatar precisa ser https:// ou caminho local.",
    }),
  bio: z.string().trim().max(400).nullable(),
  active: z.boolean(),
});

/** Cria/atualiza o perfil PÚBLICO de autor de um usuário (id = user id). */
export async function saveAuthor(input: z.infer<typeof saveSchema>): Promise<AuthorActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  try {
    await requirePermission("user.manage");
  } catch {
    return err("Sem permissão para gerenciar autores.");
  }
  const supabase = await createClient();
  const d = parsed.data;
  const slug = slugify(d.slug || d.publicName);
  if (!slug) return err("Slug inválido.");
  // Slug é único global: não pode pertencer a OUTRO autor.
  const { data: dono } = await supabase
    .from("author_profiles")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (dono && dono.id !== d.userId) return err(`O slug "${slug}" já é de outro autor.`);
  const { error } = await supabase.from("author_profiles").upsert({
    id: d.userId,
    public_name: d.publicName,
    slug,
    avatar_url: d.avatarUrl || null,
    bio: d.bio || null,
    active: d.active,
  });
  if (error) return err(`Falha: ${error.message}`);
  await audit({
    action: "user.author_save",
    entityType: "author_profile",
    entityId: d.userId,
    after: { public_name: d.publicName, slug, active: d.active },
  });
  revalidatePath("/admin/usuarios");
  revalidatePath("/docs", "layout");
  return { ok: true };
}

/**
 * Exclui o perfil de autor. Se houver artigos atribuídos, exige destino de
 * reatribuição (padrão HubSpot) — artigo publicado não fica com autor fantasma.
 */
export async function deleteAuthor(
  authorId: string,
  reassignToId: string | null,
): Promise<AuthorActionResult> {
  try {
    await requirePermission("user.manage");
  } catch {
    return err("Sem permissão para gerenciar autores.");
  }
  if (reassignToId === authorId) return err("Reatribua para um autor diferente.");
  const supabase = await createClient();
  const { count } = await supabase
    .from("nodes")
    .select("id", { count: "exact", head: true })
    .eq("author_id", authorId)
    .is("deleted_at", null);
  if ((count ?? 0) > 0 && !reassignToId) {
    return err(`Este autor tem ${count} artigo(s). Escolha para quem reatribuir.`);
  }
  if (reassignToId) {
    const { error } = await supabase
      .from("nodes")
      .update({ author_id: reassignToId })
      .eq("author_id", authorId);
    if (error) return err(`Falha ao reatribuir: ${error.message}`);
  }
  const { error } = await supabase.from("author_profiles").delete().eq("id", authorId);
  if (error) return err(`Falha: ${error.message}`);
  await audit({
    action: "user.author_delete",
    entityType: "author_profile",
    entityId: authorId,
    after: { reassigned_to: reassignToId },
  });
  revalidatePath("/admin/usuarios");
  revalidatePath("/docs", "layout");
  return { ok: true };
}
