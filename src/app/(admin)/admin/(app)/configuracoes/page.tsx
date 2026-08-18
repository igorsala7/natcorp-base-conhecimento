import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { env } from "@/lib/env";
import { SpaceSettingsForm } from "./space-settings-form";
import { TagsManager } from "./tags-manager";
import { listTags } from "../conteudo/tag-actions";
import { SemPermissao } from "@/components/ui/sem-permissao";

export const metadata: Metadata = { title: "Configurações" };

/**
 * Só aceita caminho interno do admin como retorno — evita open redirect via
 * ?from=https://…
 */
function safeReturnTo(from: string | undefined): string | null {
  if (!from) return null;
  if (!from.startsWith("/admin/") || from.startsWith("//")) return null;
  return from;
}

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; from?: string }>;
}) {
  if (!(await hasPermission("space.manage"))) {
    return (
      <SemPermissao
        titulo="Configurações"
        oQue="alterar as preferências desta documentação"
        permissao="space.manage"
        papel="Admin técnico"
      />
    );
  }
  const spaces = await listSpaces();
  const { space, from } = await searchParams;
  const returnTo = safeReturnTo(from);
  const current = spaces.find((s) => s.id === space) ?? spaces[0];

  if (!current) return <div className="p-8 text-text-muted">Nenhum espaço.</div>;

  const supabase = await createClient();
  // Só "tem senha?", nunca o hash: ele mora em space_secrets, que não tem grant
  // para authenticated justamente para não sair por um select.
  const { data: temSenha } = await supabase.rpc("space_has_password", {
    p_space_id: current.id,
  });

  // Quando veio do editor de um artigo, mostra o título dele na trilha.
  const editorNodeId = returnTo?.match(/^\/admin\/conteudo\/([0-9a-f-]{36})/i)?.[1] ?? null;
  const { data: editorNode } = editorNodeId
    ? await supabase.from("nodes").select("title").eq("id", editorNodeId).maybeSingle()
    : { data: null };

  const tags = await listTags(current.id);

  const form = (
    <>
      <SpaceSettingsForm
        spaces={spaces.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
        current={{
          id: current.id,
          name: current.name,
          slug: current.slug,
          visibility: current.visibility,
          custom_domain: current.custom_domain,
          access_referrers: current.access_referrers,
          access_denied_message: current.access_denied_message,
        }}
        hasPassword={temSenha === true}
        siteUrl={env.NEXT_PUBLIC_SITE_URL}
      />
      <div className="mt-6">
        <TagsManager spaceId={current.id} initial={tags} />
      </div>
    </>
  );

  /**
   * A MOLDURA VEM DO `PageShell`, e a trilha à mão saiu.
   *
   * Esta tela montava a própria: `<h1>` ausente, uma `max-w-2xl` decidida no
   * lugar, e um breadcrumb de três níveis escrito à mão em `<ol>` — o único do
   * admin, porque o produto não tinha nenhum. Agora existe um, na barra
   * superior, alimentado pelo mapa de rotas.
   *
   * O que ELE não sabe é de onde a pessoa veio: chegar aqui pelo editor de um
   * artigo é diferente de chegar pelo cartão da documentação. Esse retorno
   * específico é a única parte que continua sendo do escopo da tela, e vira uma
   * AÇÃO — que é o que ele sempre foi. Trilha é onde você está; botão é para
   * onde você volta.
   */
  return (
    <PageShell
      titulo="Preferências da documentação"
      descricao={<>Endereço público, visibilidade, acesso e etiquetas de <strong className="font-semibold text-text">{current.name}</strong>.</>}
      largura="page"
      acoes={
        returnTo ? (
          <Button asChild variant="secondary">
            <Link href={returnTo}>
              <ArrowLeft /> Voltar para {editorNode?.title ?? "o editor"}
            </Link>
          </Button>
        ) : undefined
      }
    >
      {form}
    </PageShell>
  );
}
