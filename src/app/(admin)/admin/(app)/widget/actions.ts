"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, hasPermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { generatePublicKey } from "@/lib/widget/auth";
import type { Json } from "@/lib/database.types";

export type WidgetActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const configSchema = z.object({
  primaryColor: z.string().max(32).optional(),
  title: z.string().max(60).optional(),
  welcome: z.string().max(500).optional(),
  avatarUrl: z
    .string()
    .max(2000)
    .refine(
      // http(s) OU o SVG do ícone escolhido no editor (data URI) — nada de
      // javascript:/blob: num src que o widget injeta no site do cliente.
      (v) => /^https?:\/\//.test(v) || v.startsWith("data:image/svg+xml"),
      "Use uma URL https ou escolha um ícone.",
    )
    .optional()
    .or(z.literal("")),
  /** Chave do catálogo de ícones — só para o editor reabrir mostrando a seleção. */
  avatarIcon: z.string().max(60).optional().or(z.literal("")),
  suggestions: z.array(z.string().max(120)).max(6).optional(),
  position: z.enum(["right", "left"]).optional(),
});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  spaceId: z.string().uuid(),
  name: z.string().min(1).max(80),
  allowedOrigins: z.array(z.string().max(200)).max(20),
  rateLimit: z.number().int().min(1).max(600),
  active: z.boolean(),
  config: configSchema,
  /** Documentações que este chatbot pode consultar (além da dona). */
  scopeSpaceIds: z.array(z.string().uuid()).max(50).default([]),
  /** Persona deste chatbot. Vazio = herda a da documentação dona. */
  systemPrompt: z.string().max(2000).nullable().default(null),
});

/**
 * Regrava o escopo de leitura da chave.
 *
 * Só entram documentações que o usuário PODE VER — senão bastaria conhecer o
 * id de um espaço alheio para ampliar o alcance do chatbot até ele. A RLS da
 * tabela também barra isso; aqui a checagem serve para o erro ser claro em vez
 * de virar uma falha genérica de permissão.
 */
async function gravarEscopo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  widgetKeyId: string,
  ownerSpaceId: string,
  scopeSpaceIds: string[],
): Promise<string | null> {
  const desejados = [...new Set([ownerSpaceId, ...scopeSpaceIds])];
  for (const sid of desejados) {
    if (sid === ownerSpaceId) continue;
    if (!(await hasPermission("content.view", sid))) {
      return "Você não tem acesso a uma das documentações selecionadas.";
    }
  }
  await supabase.from("widget_key_spaces").delete().eq("widget_key_id", widgetKeyId);
  const { error } = await supabase
    .from("widget_key_spaces")
    .insert(desejados.map((space_id) => ({ widget_key_id: widgetKeyId, space_id })));
  return error ? `Falha ao salvar o escopo: ${error.message}` : null;
}

/** Cria ou atualiza uma chave de widget. Exige widget.manage no espaço. */
export async function saveWidgetKey(input: unknown): Promise<WidgetActionResult> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const { id, spaceId, name, allowedOrigins, rateLimit, active, config, scopeSpaceIds, systemPrompt } =
    parsed.data;

  try {
    await requirePermission("widget.manage", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para gerenciar chaves neste espaço." };
  }

  const supabase = await createClient();
  const origins = allowedOrigins.map((o) => o.trim()).filter(Boolean);

  if (id) {
    const { error } = await supabase
      .from("widget_keys")
      .update({
        name,
        allowed_origins: origins,
        rate_limit: rateLimit,
        active,
        config: config as Json,
        system_prompt: systemPrompt?.trim() || null,
      })
      .eq("id", id);
    if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };
    const erroEscopo = await gravarEscopo(supabase, id, spaceId, scopeSpaceIds);
    if (erroEscopo) return { ok: false, error: erroEscopo };
    await audit({ action: "widget.update", entityType: "widget_key", entityId: id, spaceId });
    revalidatePath("/admin/widget");
    return { ok: true, id };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: created, error } = await supabase
    .from("widget_keys")
    .insert({
      space_id: spaceId,
      name,
      public_key: generatePublicKey(),
      allowed_origins: origins,
      rate_limit: rateLimit,
      active,
      config: config as Json,
      system_prompt: systemPrompt?.trim() || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: `Falha ao criar: ${error?.message}` };
  const erroEscopo = await gravarEscopo(supabase, created.id, spaceId, scopeSpaceIds);
  if (erroEscopo) return { ok: false, error: erroEscopo };
  await audit({ action: "widget.create", entityType: "widget_key", entityId: created.id, spaceId });
  revalidatePath("/admin/widget");
  return { ok: true, id: created.id };
}

/** Gera uma nova chave pública (revoga a antiga imediatamente). */
export async function regenerateWidgetKey(id: string): Promise<WidgetActionResult> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("widget_keys")
    .select("space_id")
    .eq("id", id)
    .single();
  if (!row) return { ok: false, error: "Chave não encontrada." };
  try {
    await requirePermission("widget.manage", row.space_id);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const { error } = await supabase
    .from("widget_keys")
    .update({ public_key: generatePublicKey() })
    .eq("id", id);
  if (error) return { ok: false, error: `Falha: ${error.message}` };
  await audit({ action: "widget.regenerate", entityType: "widget_key", entityId: id, spaceId: row.space_id });
  revalidatePath("/admin/widget");
  return { ok: true, id };
}

/** Exclui uma chave de widget. Exige widget.manage. */
export async function deleteWidgetKey(id: string): Promise<WidgetActionResult> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("widget_keys")
    .select("space_id")
    .eq("id", id)
    .single();
  if (!row) return { ok: false, error: "Chave não encontrada." };
  try {
    await requirePermission("widget.manage", row.space_id);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const { error } = await supabase.from("widget_keys").delete().eq("id", id);
  if (error) return { ok: false, error: `Falha: ${error.message}` };
  await audit({ action: "widget.delete", entityType: "widget_key", entityId: id, spaceId: row.space_id });
  revalidatePath("/admin/widget");
  return { ok: true };
}
