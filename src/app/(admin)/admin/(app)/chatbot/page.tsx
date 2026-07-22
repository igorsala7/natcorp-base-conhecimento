import type { Metadata } from "next";
import Link from "next/link";
import { Database, Palette } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { env } from "@/lib/env";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { KbUploadRow } from "./kb-upload-row";
import { WidgetManager, type WidgetKeyRow } from "../widget/widget-manager";

export const metadata: Metadata = { title: "Chatbot" };

/**
 * Parametrização do CHATBOT de uma documentação: as chaves de widget que a
 * atendem (persona, visual, origens, escopo, snippet — via WidgetManager em
 * modo espaço-fixo) + a base de arquivos que alimenta as respostas.
 */
export default async function ChatbotPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  if (!(await hasPermission("widget.manage"))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Chatbot</h1>
        <p className="mt-2 text-text-muted">
          Você não tem permissão para configurar chatbots.
        </p>
      </div>
    );
  }

  const spaces = await listSpaces();
  const { space } = await searchParams;
  const atual = spaces.find((s) => s.id === space) ?? spaces[0];
  if (!atual) return <div className="p-8 text-text-muted">Nenhuma documentação.</div>;

  const supabase = await createClient();

  // Chaves DESTA documentação: donas dela OU com ela no escopo de leitura.
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
  const { data: keys } = await supabase
    .from("widget_keys")
    .select(
      "id, space_id, name, public_key, allowed_origins, rate_limit, active, config, system_prompt, created_at",
    )
    .order("created_at", { ascending: false });
  const daDocumentacao = (keys ?? []).filter(
    (k) =>
      k.space_id === atual.id || (escopoPorChave.get(k.id) ?? []).includes(atual.id),
  );

  const [{ count: arquivos }, { count: prontos }] = await Promise.all([
    supabase
      .from("knowledge_documents")
      .select("id", { count: "exact", head: true })
      .eq("space_id", atual.id),
    supabase
      .from("knowledge_documents")
      .select("id", { count: "exact", head: true })
      .eq("space_id", atual.id)
      .eq("status", "ready"),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Chatbot</h1>
          <p className="mt-1 text-sm text-text-muted">
            O assistente desta documentação: chaves do widget, persona, visual e a base de
            conhecimento que alimenta as respostas.
          </p>
        </div>
        <SpaceSwitcher spaces={spaces} currentId={atual.id} canCreate={false} canManage={false} />
      </div>

      {/* Base de conhecimento do bot */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4">
        <Database className="size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">
            {arquivos ?? 0} documento(s) na base do chatbot
            {(arquivos ?? 0) !== (prontos ?? 0) && (
              <span className="font-normal text-text-muted"> · {prontos ?? 0} pronto(s)</span>
            )}
          </p>
          <p className="text-text-muted">
            Além dos artigos publicados, o bot consulta estes arquivos — eles não aparecem no
            portal.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <KbUploadRow spaceId={atual.id} />
          <Link
            href={`/admin/base-conhecimento?space=${atual.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary"
          >
            Gerenciar arquivos
          </Link>
          <Link
            href={`/admin/aparencia?space=${atual.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-text-muted transition-colors hover:border-primary hover:text-primary"
            title="A persona da documentação vale como padrão para chaves sem persona própria"
          >
            <Palette className="size-4" /> Persona
          </Link>
        </div>
      </div>

      {/* Chaves do widget desta documentação */}
      <div className="mt-6">
        <WidgetManager
          spaces={spaces.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
          initialKeys={
            daDocumentacao.map((k) => ({
              ...k,
              scope_space_ids: escopoPorChave.get(k.id) ?? [k.space_id],
            })) as WidgetKeyRow[]
          }
          siteUrl={env.NEXT_PUBLIC_SITE_URL}
          fixedSpaceId={atual.id}
        />
      </div>
    </div>
  );
}
