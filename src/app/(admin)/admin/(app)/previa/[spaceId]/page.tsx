import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getPreviewTree,
  getPreviewArticles,
  getPreviewSnippets,
  flattenPreview,
} from "@/lib/content/preview";
import { PreviewDoc } from "@/components/content/preview-doc";

export const metadata: Metadata = { title: "Prévia da documentação" };

/**
 * Prévia da documentação INTEIRA, incluindo o que ainda não foi publicado.
 *
 * Mora sob `(app)`, o layout que já barra requisição sem sessão, e ainda checa
 * `content.view`. É por isso que ela não é um `?preview=1` na rota pública: o
 * portal não pode ter caminho de código que alcance conteúdo não publicado.
 */
export default async function PreviaPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { spaceId } = await params;
  const { edit } = await searchParams;
  if (!(await hasPermission("content.view"))) notFound();
  // Quem só lê continua vendo a prévia; o modo edição depende de content.edit.
  const editavel = await hasPermission("content.edit", spaceId);

  const supabase = await createClient();
  const { data: space } = await supabase
    .from("spaces")
    .select("id, name, slug")
    .eq("id", spaceId)
    .maybeSingle();
  if (!space) notFound();

  const tree = await getPreviewTree(spaceId);
  const artigos = flattenPreview(tree).filter((n) => n.type === "article");
  const [conteudos, snippets] = await Promise.all([
    getPreviewArticles(artigos.map((a) => a.id)),
    getPreviewSnippets(spaceId),
  ]);

  return (
    <PreviewDoc
      spaceId={spaceId}
      spaceName={space.name}
      spaceSlug={space.slug}
      tree={tree}
      conteudos={[...conteudos]}
      snippets={[...snippets]}
      editavel={editavel}
      edicaoInicial={edit === "1"}
    />
  );
}
