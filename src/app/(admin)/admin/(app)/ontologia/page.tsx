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
import { ApexXliffTranslator } from "./apex-xliff-translator";
import { ApexIngest } from "./apex-ingest";
import { DbIngest } from "./db-ingest";
import { CsvIngest } from "./csv-ingest";
import { listDataDictionaryColumns } from "./apex-actions";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { AssistenteTabs } from "@/components/admin/assistente-tabs";
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
  const podeWidget = (await permissoesDo()).has("widget.manage");
  const atual = await pickSpace(spaces, space);
  if (!atual) return <div className="p-8 text-text-muted">Nenhuma documentação.</div>;

  const [{ terms, jobs }, nodes, canManage, aiReady, langs, dicCols] = await Promise.all([
    listOntology(atual.id),
    listSpaceNodes(atual.id),
    hasPermission("ai.configure", atual.id),
    hasAiKey("chat"),
    listSpaceLanguages(atual.id),
    listDataDictionaryColumns(atual.id),
  ]);

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
      acoes={
        <>
          {/* O caminho de volta explícito: esta tela é filha do Assistente na
              nova arquitetura e ainda não virou aba dele. Enquanto não virar, o
              link evita que ela pareça um destino solto. */}
          <Button asChild variant="ghost">
            <Link href={`/admin/assistente?space=${atual.id}`}>
              <ArrowLeft /> Assistente
            </Link>
          </Button>
          {/* Grava o cookie que o seletor da barra lateral exibe — ver estudio/page.tsx. */}
          <SpaceSwitcher spaces={spaces} currentId={atual.id} canCreate={false} canManage={false} />
        </>
      }
      abas={<AssistenteTabs atual="ontologia" spaceId={atual.id} podeGerenciarWidget={podeWidget} />}
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
          <ApexIngest key={`ingest-${atual.id}`} spaceId={atual.id} initialCols={dicCols} />
        </div>
      )}

      {canManage && (
        <div className="mt-6">
          <CsvIngest key={`csv-${atual.id}`} spaceId={atual.id} />
          <DbIngest key={`db-${atual.id}`} spaceId={atual.id} />
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
