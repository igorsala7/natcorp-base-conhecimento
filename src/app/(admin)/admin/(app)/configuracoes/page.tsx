import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { env } from "@/lib/env";
import { SpaceSettingsForm } from "./space-settings-form";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
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
  const { space } = await searchParams;
  const current = spaces.find((s) => s.id === space) ?? spaces[0];

  if (!current) return <div className="p-8 text-text-muted">Nenhum espaço.</div>;

  const supabase = await createClient();
  const { data: pw } = await supabase
    .from("spaces")
    .select("password_hash")
    .eq("id", current.id)
    .single();

  return (
    <SpaceSettingsForm
      spaces={spaces.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
      current={{
        id: current.id,
        name: current.name,
        slug: current.slug,
        visibility: current.visibility,
        custom_domain: current.custom_domain,
      }}
      hasPassword={!!pw?.password_hash}
      siteUrl={env.NEXT_PUBLIC_SITE_URL}
    />
  );
}
