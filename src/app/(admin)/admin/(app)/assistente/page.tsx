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
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";

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
    <PageShell
      titulo="Assistente de IA"
      descricao={
        <>
          Ajuste a persona do assistente desta documentação e teste no chat ao lado — as respostas usam só o
          conteúdo dela, com citações.
          {!aiReady && " Configure a IA em Sistema para ativar."}
        </>
      }
      largura="full"
      acoes={
        <>
          {/* A ontologia era alcançável por ESTE link e por mais nenhum lugar em
              todo o admin — uma tela órfã, achável só por quem já soubesse que
              ela existia. Continua aqui até virar aba desta página; enquanto
              isso, o menu e o Cmd+K já a apontam como "Assistente de IA ›
              Ontologia". */}
          <Button asChild variant="secondary">
            <Link href={`/admin/ontologia?space=${atual.id}`}>
              <Network /> Ontologia
            </Link>
          </Button>
          {/* Grava o cookie que o seletor da barra lateral exibe — ver estudio/page.tsx. */}
          <SpaceSwitcher spaces={spaces} currentId={atual.id} canCreate={false} canManage={false} />
        </>
      }
    >

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
    </PageShell>
  );
}
