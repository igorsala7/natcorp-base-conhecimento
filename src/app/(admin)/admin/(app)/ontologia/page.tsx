import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { pickSpace } from "@/lib/content/current-space";
import { hasAiKey } from "@/lib/ai/config";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { listSpaceNodes } from "../importar/embeddings-actions";
import { listOntology, listSpaceLanguages } from "./actions";
import { OntologyManager } from "./ontology-manager";
import { OntologyLanguages } from "./ontology-languages";

export const metadata: Metadata = { title: "Ontologia" };

/**
 * Ontologia do RAG: termos canônicos + sinônimos que o usuário digita. No chat,
 * a consulta é expandida com os termos casados — o assistente acha o artigo
 * certo mesmo quando o usuário usa outra palavra. A varredura por IA lê os
 * artigos e sugere termos para já deixar cadastrado.
 */
export default async function OntologiaPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  if (!(await hasPermission("content.view"))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Ontologia</h1>
        <p className="mt-2 text-text-muted">Sem permissão.</p>
      </div>
    );
  }

  const spaces = await listSpaces();
  const { space } = await searchParams;
  const atual = await pickSpace(spaces, space);
  if (!atual) return <div className="p-8 text-text-muted">Nenhuma documentação.</div>;

  const [{ terms, jobs }, nodes, canManage, aiReady, langs] = await Promise.all([
    listOntology(atual.id),
    listSpaceNodes(atual.id),
    hasPermission("ai.configure", atual.id),
    hasAiKey("chat"),
    listSpaceLanguages(atual.id),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin/assistente?space=${atual.id}`}
            className="mb-1 inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
          >
            <ArrowLeft className="size-4" /> Assistente
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Ontologia</h1>
          <p className="mt-1 text-sm text-text-muted">
            Termos e sinônimos que deixam o assistente mais preciso: quando o leitor digita uma
            variação, a busca casa com o termo certo.
            {!aiReady && " Configure a IA do Chat em Sistema para a varredura."}
          </p>
        </div>
        <div className="ml-auto">
          <SpaceSwitcher spaces={spaces} currentId={atual.id} canCreate={false} canManage={false} />
        </div>
      </div>

      <div className="mt-6">
        <OntologyManager
          key={atual.id}
          spaceId={atual.id}
          initialTerms={terms}
          initialJobs={jobs}
          nodes={nodes}
          canManage={canManage}
        />
      </div>

      <div className="mt-6">
        <OntologyLanguages key={`lang-${atual.id}`} spaceId={atual.id} initialLangs={langs} canManage={canManage} />
      </div>
    </div>
  );
}
