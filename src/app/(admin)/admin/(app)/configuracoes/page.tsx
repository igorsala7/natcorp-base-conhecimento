import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { env } from "@/lib/env";
import { SpaceSettingsForm } from "./space-settings-form";

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
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-2 text-text-muted">
          Você não tem permissão para configurar espaços.
        </p>
      </div>
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

  const form = (
    <SpaceSettingsForm
      spaces={spaces.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
      current={{
        id: current.id,
        name: current.name,
        slug: current.slug,
        visibility: current.visibility,
        custom_domain: current.custom_domain,
      }}
      hasPassword={temSenha === true}
      siteUrl={env.NEXT_PUBLIC_SITE_URL}
    />
  );

  if (!returnTo) return form;

  return (
    <div className="space-y-4">
      <nav aria-label="Trilha" className="flex flex-wrap items-center justify-between gap-3">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
          <li>
            <Link href="/admin/conteudo" className="hover:text-primary">
              Conteúdo
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href={returnTo} className="hover:text-primary">
              {editorNode?.title ?? "Editor"}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="font-medium text-text" aria-current="page">
            Configurações
          </li>
        </ol>
        <Link
          href={returnTo}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Voltar ao editor
        </Link>
      </nav>
      {form}
    </div>
  );
}
