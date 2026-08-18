import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Database } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { pickSpace } from "@/lib/content/current-space";
import { env } from "@/lib/env";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { KbUploadRow } from "./kb-upload-row";
import type { WidgetKeyRow } from "../widget/widget-manager";
import type { ApiKeyRow } from "../widget/api-key-manager";
import { ChatbotTabs } from "./chatbot-tabs";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { PageShell } from "@/components/ui/page-shell";
import { AbasRota } from "@/components/admin/abas-rota";
import { permissoesDo } from "@/lib/auth/permissions";

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
      <SemPermissao
        titulo="Chatbot"
        oQue="configurar o chatbot"
        permissao="widget.manage"
        papel="Admin técnico"
      />
    );
  }

  const spaces = await listSpaces();
  const { space } = await searchParams;
  const atual = await pickSpace(spaces, space);
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
      "id, space_id, name, public_key, allowed_origins, rate_limit, active, config, system_prompt, kind, created_at",
    )
    .order("created_at", { ascending: false });
  const daDocumentacao = (keys ?? []).filter(
    (k) =>
      k.space_id === atual.id || (escopoPorChave.get(k.id) ?? []).includes(atual.id),
  );

  const widgetKeys = daDocumentacao
    .filter((k) => k.kind !== "api")
    .map((k) => ({ ...k, scope_space_ids: escopoPorChave.get(k.id) ?? [k.space_id] })) as WidgetKeyRow[];
  const apiKeys = daDocumentacao
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
    <PageShell
      /* "desta documentação" no título porque existe uma tela quase homônima —
         "Widget e API" — que lista as chaves de TODAS. As duas renderizavam o
         mesmo componente, diferindo por uma prop, e o nome não dizia qual era
         qual: quem caía na errada não tinha como perceber. */
      titulo="Chatbot desta documentação"
      descricao={
        <>
          Chaves do widget, visual e a base de conhecimento que alimenta as respostas — só desta
          documentação. Para ver as de{" "}
          <Link href="/admin/widget" className="font-medium text-primary hover:underline">
            todas as documentações
          </Link>
          , ou gerar um token de rastreio, use a visão global.
        </>
      }
      largura="wide"
      acoes={
        /* Grava o cookie que o seletor da barra lateral exibe — ver estudio/page.tsx. */
        <SpaceSwitcher spaces={spaces} currentId={atual.id} canCreate={false} canManage={false} />
      }
      abas={<AbasRota rota="/admin/assistente" atual="canais" permissoes={await permissoesDo()} spaceId={atual.id} />}
    >

      {/* Base de conhecimento do bot */}
      <Surface elevation={1} padding="md" className="mt-6 flex flex-wrap items-center gap-3">
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
          {/* `Button asChild` e não classes copiadas à mão: as duas cópias que
              moravam aqui divergiram do primitivo em hover e em anel de foco —
              o mesmo mecanismo que já tinha deixado quatro telas com foco morto.
              O rótulo também mudou: "Gerenciar arquivos" era o quarto nome dado
              à mesma coisa. Agora é "Base de conhecimento" em todo lugar. */}
          <Button asChild variant="secondary" size="sm">
            <Link href={`/admin/importar?aba=embeddings&space=${atual.id}`}>
              Base de conhecimento
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link
              href={`/admin/assistente?space=${atual.id}`}
              title="A persona da documentação vale como padrão para chaves sem persona própria"
            >
              <Bot /> Persona
            </Link>
          </Button>
        </div>
      </Surface>

      {/* Widget (embutir) e API (REST), separados por aba */}
      <ChatbotTabs
        widgetKeys={widgetKeys}
        apiKeys={apiKeys}
        spaces={spaces.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
        siteUrl={env.NEXT_PUBLIC_SITE_URL}
        fixedSpaceId={atual.id}
      />
    </PageShell>
  );
}
