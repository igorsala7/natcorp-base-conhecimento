import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { env } from "@/lib/env";
import { WidgetManager, type WidgetKeyRow } from "./widget-manager";

export const metadata: Metadata = { title: "Widget e API" };

/**
 * Fase 7 — Widget e API. Gestão de chaves públicas por espaço, allowlist de
 * origem, config visual, snippet de embed e documentação da API REST.
 */
export default async function WidgetPage() {
  const canView = await hasPermission("widget.manage");
  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Widget e API</h1>
        <p className="mt-2 text-text-muted">
          Você não tem permissão para gerenciar chaves de widget.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const spaces = await listSpaces();
  const { data: keys } = await supabase
    .from("widget_keys")
    .select(
      "id, space_id, name, public_key, allowed_origins, rate_limit, active, config, system_prompt, created_at",
    )
    .order("created_at", { ascending: false });

  // Escopo de leitura de cada chave, em uma consulta só.
  const { data: escopos } = await supabase
    .from("widget_key_spaces")
    .select("widget_key_id, space_id");
  const escopoPorChave = new Map<string, string[]>();
  for (const e of escopos ?? []) {
    escopoPorChave.set(e.widget_key_id, [
      ...(escopoPorChave.get(e.widget_key_id) ?? []),
      e.space_id,
    ]);
  }

  return (
    <WidgetManager
      spaces={spaces.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
      initialKeys={(keys ?? []).map((k) => ({
        ...k,
        scope_space_ids: escopoPorChave.get(k.id) ?? [k.space_id],
      })) as WidgetKeyRow[]}
      siteUrl={env.NEXT_PUBLIC_SITE_URL}
    />
  );
}
