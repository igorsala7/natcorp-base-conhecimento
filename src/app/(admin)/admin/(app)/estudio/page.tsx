import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { pickSpace } from "@/lib/content/current-space";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createStudioSession, listStudioSessions } from "./actions";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Estúdio IA" };

/**
 * Estúdio IA — lista de conversas da documentação. Cada conversa constrói uma
 * proposta (artigo ou árvore) com um "editor sênior" de IA; o resultado nasce
 * rascunho na árvore de conteúdo.
 */
export default async function EstudioPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; parent?: string; nova?: string }>;
}) {
  const spaces = await listSpaces();
  const { space, parent, nova } = await searchParams;
  const atual = await pickSpace(spaces, space);
  if (!atual) return <div className="p-8 text-text-muted">Nenhuma documentação.</div>;

  if (!(await hasPermission("content.create", atual.id))) {
    return (
      <SemPermissao
        titulo="Estúdio IA"
        oQue="criar conteúdo com IA aqui"
        permissao="content.create"
        papel="Editor"
      />
    );
  }

  // Entrada direta da árvore ("Criar com IA"): cria a sessão e já abre.
  if (nova === "1") {
    const r = await createStudioSession(atual.id, parent ?? null);
    if (r.ok) redirect(`/admin/estudio/${r.data}`);
  }

  const sessoes = await listStudioSessions(atual.id);

  return (
    <PageShell
      titulo="Estúdio IA"
      descricao="Converse com um editor de IA: explique o que precisa, anexe material (até código), e construa artigos ou uma estrutura inteira — tudo nasce rascunho."
      largura="page"
      acoes={
        <>
          {/* O SpaceSwitcher da página CONTINUA aqui, apesar de a barra lateral
              agora ter o seu. Ele não é duplicata: é quem GRAVA o cookie, a
              partir do espaço que a página resolveu. Removê-lo deixaria o
              seletor do chrome sem fonte de verdade. */}
          <SpaceSwitcher spaces={spaces} currentId={atual.id} canCreate={false} canManage={false} />
          {/* A ação primária sobe para o cabeçalho: solta abaixo dele, competia
              visualmente com o primeiro item da lista. */}
          <Button asChild>
            <Link href={`/admin/estudio?space=${atual.id}&nova=1`}>
              <MessageSquarePlus /> Nova conversa
            </Link>
          </Button>
        </>
      }
    >

      {sessoes.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={MessageSquarePlus}
          title="Nenhuma conversa ainda"
          description="Comece uma e diga ao editor de IA o que você precisa documentar."
        />
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {sessoes.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/estudio/${s.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.title}</span>
                  <span className="block text-xs text-text-muted">
                    {new Date(s.updated_at).toLocaleString("pt-BR")}
                  </span>
                </span>
                <Badge tone={s.status === "created" ? "primary" : "neutral"}>
                  {s.status === "created" ? "Criada" : "Em conversa"}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
