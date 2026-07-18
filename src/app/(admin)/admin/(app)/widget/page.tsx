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
    .select("id, space_id, name, public_key, allowed_origins, rate_limit, active, config, created_at")
    .order("created_at", { ascending: false });

  return (
    <WidgetManager
      spaces={spaces.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
      initialKeys={(keys ?? []) as WidgetKeyRow[]}
      siteUrl={env.NEXT_PUBLIC_SITE_URL}
    />
  );
}
