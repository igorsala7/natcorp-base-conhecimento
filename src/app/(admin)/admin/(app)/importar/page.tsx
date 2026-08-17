import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { pickSpace } from "@/lib/content/current-space";
import { ImportarAbas, ImportarPaineis } from "./importar-tabs";
import type { ImportJobRow } from "./import-manager";
import { listEmbeddingsReport } from "./embeddings-actions";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { PageShell } from "@/components/ui/page-shell";
import { SpaceSwitcher } from "@/components/content/space-switcher";

export const metadata: Metadata = { title: "Importar" };

/**
 * A TELA QUE GRAVAVA NA DOCUMENTAÇÃO ERRADA.
 *
 * O `mapa-rotas` declara esta rota com `escopo: "espaco"`, o que é uma promessa
 * ao usuário: ela obedece ao seletor da barra lateral. Ela não obedecia. Resolvia
 * o destino com `getDefaultSpace()` — a documentação MAIS ANTIGA do banco — e não
 * exibia seletor nenhum, então nada na tela revelava o engano.
 *
 * O estrago não parava no arquivo fora do lugar. Publicar enfileira embeddings;
 * um manual do Cliente A indexado dentro do espaço do Cliente B faz o chat do B
 * responder com conteúdo do A. É exatamente o isolamento que a Parte 5.5 do
 * PROMPT-MESTRE chama de inegociável, quebrado por um helper errado.
 *
 * Agora usa o mesmo `pickSpace` (URL → cookie → primeira) que Assistente,
 * Chatbot, Conversas e Estúdio já usavam, e o `<SpaceSwitcher>` fica nas ações
 * da página: destino de gravação precisa estar visível NO MOMENTO da gravação,
 * não deduzido de uma tela anterior.
 */
export default async function ImportarPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; node?: string }>;
}) {
  const [canImport, canEmbed] = await Promise.all([
    hasPermission("content.import"),
    hasPermission("embeddings.reindex"),
  ]);
  if (!canImport && !canEmbed) {
    return (
      <SemPermissao
        titulo="Importar"
        oQue="importar documentos"
        permissao="content.import"
        papel="Gestor de conteúdo"
      />
    );
  }

  const spaces = await listSpaces();
  const { space: spaceParam, node: nodeSel } = await searchParams;
  const atual = await pickSpace(spaces, spaceParam);
  if (!atual) return <div className="p-8 text-text-muted">Nenhuma documentação.</div>;

  const supabase = await createClient();
  const jobs = canImport
    ? (
        await supabase
          .from("import_jobs")
          .select("id, original_name, status, progress, error, created_at")
          .eq("space_id", atual.id)
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? []
    : [];
  const report = canEmbed ? await listEmbeddingsReport() : [];
  const embJobs = canEmbed
    ? (
        await supabase
          .from("embedding_jobs")
          .select("id, space_id, scope, status, total, done, progress, error, created_at")
          .in("status", ["queued", "running"])
          .order("created_at", { ascending: false })
      ).data ?? []
    : [];

  return (
    <PageShell
      titulo="Importar"
      descricao={
        <>
          PDF, Word, planilha, página da web ou Markdown viram uma árvore de artigos após a sua
          revisão — em <strong className="font-semibold text-text">{atual.name}</strong>.
        </>
      }
      largura="wide"
      acoes={<SpaceSwitcher spaces={spaces} currentId={atual.id} canCreate={false} canManage={false} />}
      abas={<ImportarAbas canImport={canImport} canEmbed={canEmbed} />}
    >
      {/* key por documentação: trocar de doc reinicia a fila e os filtros. */}
      <ImportarPaineis
        key={atual.id}
        canImport={canImport}
        canEmbed={canEmbed}
        spaceId={atual.id}
        spaceName={atual.name}
        spaces={spaces.map((s) => ({ id: s.id, name: s.name }))}
        initialJobs={jobs as ImportJobRow[]}
        report={report}
        embJobs={embJobs}
        initialNodeId={nodeSel}
      />
    </PageShell>
  );
}
