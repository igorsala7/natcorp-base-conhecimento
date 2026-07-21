import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import {
  getPortalTree,
  flattenPortalTree,
  getArticleExcerpts,
  getTopHelpful,
  type PortalTreeNode,
} from "@/lib/portal/data";
import { resolveTheme } from "@/lib/portal/theme";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import type { DadosHome } from "@/components/portal/space-home";
import { AppearanceEditor, type ArtigoDisponivel } from "./appearance-editor";

export const metadata: Metadata = { title: "Aparência" };

/** Conta artigos publicados em toda a subárvore (mesma regra da home). */
function contarArtigos(node: PortalTreeNode): number {
  return node.children.reduce((n, c) => n + (c.type === "article" ? 1 : 0) + contarArtigos(c), 0);
}

export default async function AparenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  if (!(await hasPermission("space.manage"))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Aparência</h1>
        <p className="mt-2 text-text-muted">
          Você não tem permissão para configurar a aparência das documentações.
        </p>
      </div>
    );
  }

  const spaces = await listSpaces();
  const { space } = await searchParams;
  const atual = spaces.find((s) => s.id === space) ?? spaces[0];
  if (!atual) return <div className="p-8 text-text-muted">Nenhuma documentação.</div>;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("spaces")
    .select("theme, chat_prompt")
    .eq("id", atual.id)
    .maybeSingle();
  const tema = resolveTheme(row?.theme);

  // A prévia usa CONTEÚDO REAL (só o publicado, como a home pública faz), para
  // não avaliar o layout com dados de mentira.
  const tree = await getPortalTree(atual.id, supabase);
  const categorias = tree.filter((n) => n.type === "folder");
  const soltos = tree.filter((n) => n.type === "article");
  const artigos = flattenPortalTree(tree).filter((n) => n.type === "article");
  const recentes = [...artigos]
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 6);

  const href = (n: PortalTreeNode) => `/docs/${atual.slug}/${n.slugPath.join("/")}`;

  // Catálogo para o seletor de destaques + excerpts dos já escolhidos.
  const excerpts = await getArticleExcerpts(
    tema.home.featured.filter((id) => artigos.some((a) => a.id === id)),
    supabase,
  );
  const disponiveis: ArtigoDisponivel[] = artigos.map((a) => ({
    id: a.id,
    title: a.title,
    href: href(a),
  }));

  const maisUteis = (await getTopHelpful(atual.id, supabase))
    .map((r) => artigos.find((a) => a.id === r.node_id))
    .filter((n): n is PortalTreeNode => !!n)
    .map((n) => ({ id: n.id, title: n.title, href: href(n) }));

  const dados: DadosHome = {
    spaceName: atual.name,
    categorias: categorias.map((f) => ({
      id: f.id,
      title: f.title,
      href: href(f),
      artigos: contarArtigos(f),
      icon: f.icon,
      descricao: f.description,
    })),
    artigosSoltos: soltos.map((a) => ({ id: a.id, title: a.title, href: href(a), icon: a.icon })),
    recentes: recentes.map((a) => ({
      id: a.id,
      title: a.title,
      href: href(a),
      updatedAt: a.updated_at,
    })),
    destaques: tema.home.featured
      .map((id) => disponiveis.find((d) => d.id === id))
      .filter((d): d is ArtigoDisponivel => !!d)
      .map((d) => ({ ...d, excerpt: excerpts.get(d.id) ?? null })),
    maisUteis,
    supportUrl: tema.supportUrl ?? undefined,
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Aparência</h1>
          <p className="mt-1 text-sm text-text-muted">
            Marca e layout do portal público desta documentação.
          </p>
        </div>
        <div className="ml-auto">
          <SpaceSwitcher spaces={spaces} currentId={atual.id} canCreate={false} canManage={false} />
        </div>
      </div>

      <div className="mt-6">
        <AppearanceEditor
          spaceId={atual.id}
          spaceSlug={atual.slug}
          temaSalvo={tema}
          promptSalvo={row?.chat_prompt ?? ""}
          dados={dados}
          artigosDisponiveis={disponiveis}
        />
      </div>
    </div>
  );
}
