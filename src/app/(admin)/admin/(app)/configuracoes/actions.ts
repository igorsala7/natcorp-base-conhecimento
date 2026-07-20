"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { ThemeSchema } from "@/lib/portal/theme";
import { validarSlugEspaco } from "@/lib/content/slug";
import type { Json } from "@/lib/database.types";

export type SettingsResult = { ok: true } | { ok: false; error: string };
export type ClearEmbeddingsResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/**
 * Limpa os embeddings (vetores) de TODO o conteúdo do espaço.
 *
 * Zera apenas a coluna `embedding` dos chunks — os chunks em si continuam,
 * então a busca por texto (full-text/trigram) segue funcionando; só a busca
 * semântica e o assistente deixam de usar vetores até regerar. Use quando
 * trocar de modelo/provedor de embedding ou para forçar uma regeração limpa.
 * Regerar: botão "Gerar embeddings" na pasta (árvore) ou no artigo.
 */
export async function clearSpaceEmbeddings(spaceId: string): Promise<ClearEmbeddingsResult> {
  try {
    await requirePermission("space.manage", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para gerenciar este espaço." };
  }

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("chunks")
    .update({ embedding: null }, { count: "exact" })
    .eq("space_id", spaceId)
    .not("embedding", "is", null);
  if (error) return { ok: false, error: `Falha ao limpar: ${error.message}` };

  await audit({
    action: "space.clear_embeddings",
    entityType: "space",
    entityId: spaceId,
    spaceId,
    after: { cleared: count ?? 0 },
  });
  revalidatePath("/admin/configuracoes");
  return { ok: true, count: count ?? 0 };
}

const schema = z.object({
  spaceId: z.string().uuid(),
  name: z.string().min(1).max(120),
  /** Endereço público (`/docs/<slug>`). Opcional: ausente = não mexe. */
  slug: z.string().max(120).optional(),
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
  const { spaceId, name, slug, visibility, customDomain, password } = parsed.data;

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
    .select("name, visibility, custom_domain, slug")
    .eq("id", spaceId)
    .single();

  // Slug: valida contra as EM USO e as APOSENTADAS. Reaproveitar uma slug
  // antiga mandaria links compartilhados de uma documentação para outra.
  let novaSlug: string | null = null;
  if (slug !== undefined) {
    const { data: tomadas } = await supabase.from("space_slugs").select("slug, space_id");
    const emUso = (tomadas ?? []).filter((t) => t.space_id !== spaceId).map((t) => t.slug);
    const check = validarSlugEspaco(slug, emUso, before?.slug ?? undefined);
    if (!check.ok) return { ok: false, error: check.error };
    if (check.slug !== before?.slug) novaSlug = check.slug;
  }

  const domain = (customDomain ?? "").trim() || null;
  const { error } = await supabase
    .from("spaces")
    .update({
      name: name.trim(),
      visibility,
      custom_domain: domain,
      ...(novaSlug ? { slug: novaSlug } : {}),
    })
    .eq("id", spaceId);
  if (error) {
    return {
      ok: false,
      error: error.message.includes("duplicate")
        ? "Este domínio já está em uso por outro espaço."
        : `Falha ao salvar: ${error.message}`,
    };
  }

  if (novaSlug) {
    // A slug NOVA e a ANTIGA ficam ambas no histórico: a nova para bloquear
    // que outro espaço a tome, a antiga para responder 301 aos links já
    // compartilhados. Nenhuma sai da tabela.
    await supabase
      .from("space_slugs")
      .upsert([{ slug: novaSlug, space_id: spaceId }], { onConflict: "slug" });
  }

  await audit({
    action: "space.settings",
    entityType: "space",
    entityId: spaceId,
    spaceId,
    before,
    after: { name, visibility, custom_domain: domain, ...(novaSlug ? { slug: novaSlug } : {}) },
  });
  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin/conteudo");
  if (before?.slug) revalidatePath(`/docs/${before.slug}`);
  if (novaSlug) revalidatePath(`/docs/${novaSlug}`);
  return { ok: true };
}

/**
 * Salva a aparência da home pública (coluna `spaces.theme`).
 *
 * Valida com o MESMO schema que a leitura usa (`ThemeSchema`), então o que
 * entra aqui é o que `resolveTheme` sabe ler — inclusive a restrição de que
 * imagens só podem vir do bucket `assets` deste projeto.
 */
export async function updateSpaceTheme(
  spaceId: string,
  theme: unknown,
): Promise<SettingsResult> {
  try {
    await requirePermission("space.manage", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para configurar este espaço." };
  }

  const parsed = ThemeSchema.safeParse(theme);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Tema inválido." };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("spaces")
    .select("theme, slug")
    .eq("id", spaceId)
    .single();

  const { error } = await supabase
    .from("spaces")
    .update({ theme: parsed.data as Json })
    .eq("id", spaceId);
  if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };

  await audit({
    action: "space.update",
    entityType: "space",
    entityId: spaceId,
    spaceId,
    before: { theme: before?.theme ?? null },
    after: { theme: parsed.data },
  });

  revalidatePath("/admin/aparencia");
  // A home pública precisa refletir a mudança na próxima visita.
  if (before?.slug) revalidatePath(`/docs/${before.slug}`);
  return { ok: true };
}

/** Persona padrão do chatbot desta documentação (`spaces.chat_prompt`). */
export async function updateSpaceChatPrompt(
  spaceId: string,
  prompt: string | null,
): Promise<SettingsResult> {
  try {
    await requirePermission("space.manage", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para configurar este espaço." };
  }
  const texto = (prompt ?? "").trim().slice(0, 2000) || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("spaces")
    .update({ chat_prompt: texto })
    .eq("id", spaceId);
  if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };

  await audit({
    action: "space.update",
    entityType: "space",
    entityId: spaceId,
    spaceId,
    after: { chat_prompt: texto },
  });
  revalidatePath("/admin/aparencia");
  return { ok: true };
}
