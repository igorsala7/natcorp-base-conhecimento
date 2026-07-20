import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { KbManager, type KbRow } from "./kb-manager";

export const metadata: Metadata = { title: "Base de conhecimento" };

/**
 * Arquivos que o chatbot consulta sem virarem artigos publicados.
 *
 * Nada daqui aparece no portal: os chunks destes documentos não têm `node_id`,
 * e a policy de leitura do `anon` em `chunks` exige um nó publicado. Quem os
 * enxerga é o caminho do chatbot, que roda com service-role.
 */
export default async function BaseConhecimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  if (!(await hasPermission("content.view"))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Base de conhecimento</h1>
        <p className="mt-2 text-text-muted">Você não tem permissão para ver esta área.</p>
      </div>
    );
  }

  const spaces = await listSpaces();
  const { space } = await searchParams;
  const atual = spaces.find((s) => s.id === space) ?? spaces[0];
  if (!atual) return <div className="p-8 text-text-muted">Nenhuma documentação.</div>;

  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("knowledge_documents")
    .select("id, original_name, mime, size_bytes, status, error, chunk_count, created_at")
    .eq("space_id", atual.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Base de conhecimento</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
            Arquivos que o chatbot desta documentação pode consultar. Eles não viram artigos e{" "}
            <strong className="font-medium">não aparecem no portal público</strong> — nem na busca.
          </p>
        </div>
        <div className="ml-auto">
          <SpaceSwitcher
            spaces={spaces}
            currentId={atual.id}
            canCreate={false}
            canManage={false}
          />
        </div>
      </div>

      <KbManager spaceId={atual.id} initial={(docs ?? []) as KbRow[]} />
    </div>
  );
}
