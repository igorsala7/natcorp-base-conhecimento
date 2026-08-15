import type { Metadata } from "next";
import Link from "next/link";
import { Network } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { pickSpace } from "@/lib/content/current-space";
import { hasAiKey } from "@/lib/ai/config";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { AssistantWorkbench } from "./assistente-workbench";
import { SemPermissao } from "@/components/ui/sem-permissao";

export const metadata: Metadata = { title: "Assistente" };

/**
 * Assistente da documentação: parametrizar a persona (system prompt) E testar no
 * chat, tudo pela documentação selecionada. A persona vive em `spaces.chat_prompt`
 * (a mesma que o Ask-AI do portal e os widgets usam pela cascata).
 */
export default async function AssistentePage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  // Ver a página (e testar) exige content.view; editar a persona exige
  // space.manage — verificado por documentação abaixo.
  if (!(await hasPermission("content.view"))) {
    return (
      <SemPermissao
        titulo="Assistente"
        oQue="configurar o assistente"
        permissao="content.view"
        papel="Leitor"
      />
    );
  }

  const spaces = await listSpaces();
  const { space } = await searchParams;
  const atual = await pickSpace(spaces, space);
  if (!atual) return <div className="p-8 text-text-muted">Nenhuma documentação.</div>;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("spaces")
    .select("chat_prompt")
    .eq("id", atual.id)
    .maybeSingle();

  const [canEdit, aiReady] = await Promise.all([
    hasPermission("space.manage", atual.id),
    hasAiKey(),
  ]);

  // Bases de integração para SIMULAR um usuário no chat de teste. A RLS de
  // `ai_bases` já filtra por `integrations.manage` — quem não tem, recebe [].
  const { data: bases } = await supabase
    .from("ai_bases")
    .select("base_code, name")
    .eq("active", true)
    .order("name");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Assistente</h1>
          <p className="mt-1 text-sm text-text-muted">
            Ajuste a persona do assistente desta documentação e teste no chat ao lado — as
            respostas usam só o conteúdo dela, com citações.
            {!aiReady && " Configure a IA em Sistema para ativar."}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/admin/ontologia?space=${atual.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-primary hover:text-primary"
            title="Termos e sinônimos que deixam o assistente mais preciso"
          >
            <Network className="size-4" /> Ontologia
          </Link>
          <SpaceSwitcher spaces={spaces} currentId={atual.id} canCreate={false} canManage={false} />
        </div>
      </div>

      <div className="mt-6">
        {/* key por documentação: trocar de doc reinicia o rascunho e o chat. */}
        <AssistantWorkbench
          key={atual.id}
          spaceId={atual.id}
          chatPromptSalvo={row?.chat_prompt ?? ""}
          canEdit={canEdit}
          aiReady={aiReady}
          bases={bases ?? []}
        />
      </div>
    </div>
  );
}
