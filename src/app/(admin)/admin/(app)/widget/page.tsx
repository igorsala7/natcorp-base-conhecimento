import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { env } from "@/lib/env";
import type { WidgetKeyRow } from "./widget-manager";
import type { ApiKeyRow } from "./api-key-manager";
import { ChatbotTabs } from "../chatbot/chatbot-tabs";
import { TrackingKeyPanel } from "./tracking-key-panel";
import { SemPermissao } from "@/components/ui/sem-permissao";

export const metadata: Metadata = { title: "Widget e API" };

/**
 * Fase 7 — Widget e API. Gestão de chaves públicas por espaço, allowlist de
 * origem, config visual, snippet de embed e documentação da API REST.
 */
export default async function WidgetPage() {
  const canView = await hasPermission("widget.manage");
  if (!canView) {
    return (
      <SemPermissao
        titulo="Widget e API"
        oQue="gerenciar chaves de widget e de API"
        permissao="widget.manage"
        papel="Admin técnico"
      />
    );
  }

  const supabase = await createClient();
  const spaces = await listSpaces();
  const { data: keys } = await supabase
    .from("widget_keys")
    .select(
      "id, space_id, name, public_key, allowed_origins, rate_limit, active, config, system_prompt, kind, created_at",
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

  const widgetKeys = (keys ?? [])
    .filter((k) => k.kind !== "api")
    .map((k) => ({ ...k, scope_space_ids: escopoPorChave.get(k.id) ?? [k.space_id] })) as WidgetKeyRow[];
  const apiKeys = (keys ?? [])
    .filter((k) => k.kind === "api")
    .map((k) => ({
      id: k.id,
      space_id: k.space_id,
      name: k.name,
      public_key: k.public_key,
      allowed_origins: k.allowed_origins,
      rate_limit: k.rate_limit,
      active: k.active,
      created_at: k.created_at,
    })) as ApiKeyRow[];

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Widget e API</h1>
        <p className="mt-1 text-sm text-text-muted">
          Chaves para <strong className="font-medium">embutir o chat</strong> num site (Widget) e para{" "}
          <strong className="font-medium">acesso programático</strong> aos endpoints REST (API) — de todas as
          documentações.
        </p>
      </div>
      <ChatbotTabs
        widgetKeys={widgetKeys}
        apiKeys={apiKeys}
        spaces={spaces.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
        siteUrl={env.NEXT_PUBLIC_SITE_URL}
      />
      {spaces.length > 0 && (
        <TrackingKeyPanel
          spaces={spaces.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
          siteUrl={env.NEXT_PUBLIC_SITE_URL}
        />
      )}
    </div>
  );
}
