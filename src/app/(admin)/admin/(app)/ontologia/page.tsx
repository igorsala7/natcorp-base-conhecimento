import type { Metadata } from "next";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { pickSpace } from "@/lib/content/current-space";
import { hasAiKey } from "@/lib/ai/config";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { listSpaceNodes } from "../importar/embeddings-actions";
import { listOntology, listSpaceLanguages } from "./actions";
import { OntologyManager } from "./ontology-manager";
import { OntologyLanguages } from "./ontology-languages";
import { ApexXliffTranslator } from "./apex-xliff-translator";
import { DicionarioSecao } from "./dicionario-secao";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { PageShell } from "@/components/ui/page-shell";
import { AbasRota } from "@/components/admin/abas-rota";
import { permissoesDo } from "@/lib/auth/permissions";

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
      <SemPermissao
        titulo="Ontologia"
        oQue="gerenciar a ontologia"
        permissao="content.view"
        papel="Leitor"
      />
    );
  }

  const spaces = await listSpaces();
  const { space } = await searchParams;
  // Memoizado por request — o layout já consultou, então não custa ida ao banco.
  const permissoes = await permissoesDo();
  const atual = await pickSpace(spaces, space);
  if (!atual) return <div className="p-8 text-text-muted">Nenhuma documentação.</div>;

  const [{ terms, jobs }, nodes, canManage, aiReady, langs] = await Promise.all([
    listOntology(atual.id),
    listSpaceNodes(atual.id),
    hasPermission("ai.configure", atual.id),
    hasAiKey("chat"),
    listSpaceLanguages(atual.id),
  ]);
  // O dicionário NÃO é carregado aqui: ele chega por `listDicPagina`, cem por
  // vez. Embutir as 78 mil colunas no HTML era o que impedia a página de abrir.

  return (
    <PageShell
      titulo="Ontologia"
      descricao={
        <>
          Termos e sinônimos que deixam o assistente mais preciso: quando o leitor digita uma variação, a busca
          casa com o termo certo.
          {!aiReady && " Configure a IA do Chat em Sistema para a varredura."}
        </>
      }
      largura="wide"
      /* O botão "← Assistente" saiu: a barra de abas agora mostra onde esta
         tela mora E o caminho de volta, sem gastar uma ação do cabeçalho. */
      acoes={<SpaceSwitcher spaces={spaces} currentId={atual.id} canCreate={false} canManage={false} />}
      abas={<AbasRota rota="/admin/assistente" atual="ontologia" permissoes={permissoes} spaceId={atual.id} />}
    >

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

      {canManage && (
        <div className="mt-6">
          <DicionarioSecao key={`dic-${atual.id}`} spaceId={atual.id} />
        </div>
      )}

      {canManage && (
        <div className="mt-6">
          <ApexXliffTranslator key={`xliff-${atual.id}`} spaceId={atual.id} activeLangs={langs} />
        </div>
      )}
    </PageShell>
  );
}
