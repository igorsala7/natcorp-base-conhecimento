import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquarePlus, Wand2 } from "lucide-react";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { Badge } from "@/components/ui/badge";
import { createStudioSession, listStudioSessions } from "./actions";

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
  const atual = spaces.find((s) => s.id === space) ?? spaces[0];
  if (!atual) return <div className="p-8 text-text-muted">Nenhuma documentação.</div>;

  if (!(await hasPermission("content.create", atual.id))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Estúdio IA</h1>
        <p className="mt-2 text-text-muted">Você não tem permissão para criar conteúdo aqui.</p>
      </div>
    );
  }

  // Entrada direta da árvore ("Criar com IA"): cria a sessão e já abre.
  if (nova === "1") {
    const r = await createStudioSession(atual.id, parent ?? null);
    if (r.ok) redirect(`/admin/estudio/${r.data}`);
  }

  const sessoes = await listStudioSessions(atual.id);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Wand2 className="size-6 text-primary" /> Estúdio IA
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Converse com um editor de IA: explique o que precisa, anexe material (até código), e
            construa artigos ou uma estrutura inteira — tudo nasce rascunho.
          </p>
        </div>
        <SpaceSwitcher spaces={spaces} currentId={atual.id} canCreate={false} canManage={false} />
      </div>

      <div className="mt-6">
        <Link
          href={`/admin/estudio?space=${atual.id}&nova=1`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg shadow-1 transition-colors hover:bg-primary-hover"
        >
          <MessageSquarePlus className="size-4" /> Nova conversa
        </Link>
      </div>

      {sessoes.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-sm text-text-muted">
          Nenhuma conversa ainda. Comece uma e diga ao editor de IA o que você precisa documentar.
        </p>
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
    </div>
  );
}
