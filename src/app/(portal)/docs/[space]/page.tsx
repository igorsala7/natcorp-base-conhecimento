import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import {
  getPublicSpace,
  getPortalTree,
  getPortalAccess,
  flattenPortalTree,
  getArticleExcerpts,
  getTopHelpful,
  getFilterArticleIds,
  type PortalTreeNode,
} from "@/lib/portal/data";
import { PortalShell, spaceChrome } from "@/components/portal/shell";
import { SpaceHomeView, type DadosHome } from "@/components/portal/space-home";
import { PasswordGate } from "@/components/portal/password-gate";
import { OriginGate } from "@/components/portal/origin-gate";
import { OriginCookieSetter } from "@/components/portal/origin-cookie-setter";
import { makeSpaceToken } from "@/lib/portal/space-auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ space: string }>;
}): Promise<Metadata> {
  const { space: spaceSlug } = await params;
  const space = await getPublicSpace(spaceSlug);
  if (!space) return { title: "Não encontrado" };
  return {
    title: space.name,
    openGraph: {
      title: space.name,
      images: [
        { url: `/api/og?space=${encodeURIComponent(spaceSlug)}`, width: 1200, height: 630 },
      ],
    },
  };
}

/** Conta artigos publicados em toda a subárvore de uma pasta. */
function countArticles(node: PortalTreeNode): number {
  return node.children.reduce(
    (n, c) => n + (c.type === "article" ? 1 : 0) + countArticles(c),
    0,
  );
}

export default async function SpaceHome({
  params,
  searchParams,
}: {
  params: Promise<{ space: string }>;
  searchParams: Promise<{ tag?: string; autor?: string }>;
}) {
  const { space: spaceSlug } = await params;
  const access = await getPortalAccess(spaceSlug);
  if (!access) notFound();
  if (access.locked) {
    // Dois motivos de bloqueio: senha (formulário) e origem (página com o
    // tema e a mensagem parametrizada — não há o que digitar).
    if (access.reason === "origin") return <OriginGate space={access.space} />;
    return <PasswordGate spaceSlug={spaceSlug} spaceName={access.space.name} />;
  }
  const { space, db } = access;
  // Liberado pelo Referer mas ainda sem cookie: o setter invisível persiste a
  // liberação (7 dias) — recarregar e abrir em nova aba continuam funcionando.
  const originSetter = access.grantOriginCookie ? (
    <OriginCookieSetter spaceSlug={space.slug} token={makeSpaceToken(space.id)} />
  ) : null;

  // Slug aposentada → 301 para a atual (ver `resolvePortalSpace`).
  if (space.slug !== spaceSlug) permanentRedirect(`/docs/${space.slug}`);
  const tree = await getPortalTree(space.id, db);

  // Filtro por tag/autor (`?tag=` / `?autor=`): troca a home pela listagem de
  // artigos correspondentes — sem rota nova, sem conflitar com [...path].
  const { tag, autor } = await searchParams;
  if (tag || autor) {
    const filtro = await getFilterArticleIds(space.id, { tag, autor }, db);
    const artigosFiltrados = filtro
      ? flattenPortalTree(tree).filter((n) => n.type === "article" && filtro.nodeIds.has(n.id))
      : [];
    const { tema } = spaceChrome(space);
    return (
      <PortalShell space={space} tree={tree} activePath="" nav={false} width="wide">
      {originSetter}
        <div className="leitura mx-auto max-w-prose" data-size={tema.article.fontSize}>
          <Link
            href={`/docs/${spaceSlug}`}
            className="inline-flex items-center gap-1.5 text-sm text-text-muted no-underline hover:text-primary"
          >
            <ArrowLeft className="size-4" /> {space.name}
          </Link>
          <p className="mt-5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-primary">
            {tag ? "Tag" : "Autor"}
          </p>
          <h1 className="mt-1 text-[length:var(--l-page,var(--text-3xl))] font-semibold leading-tight">
            {filtro?.label ?? (tag ?? autor)}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {artigosFiltrados.length}{" "}
            {artigosFiltrados.length === 1 ? "artigo publicado" : "artigos publicados"}
          </p>
          {artigosFiltrados.length === 0 ? (
            <p className="mt-8 rounded-lg border border-dashed border-border p-6 text-sm text-text-muted">
              Nada por aqui — o conteúdo pode ter sido movido ou despublicado.
            </p>
          ) : (
            <ul className="mt-6 space-y-2">
              {artigosFiltrados.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/docs/${spaceSlug}/${a.slugPath.join("/")}`}
                    className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 no-underline transition-shadow hover:shadow-2"
                  >
                    <FileText className="size-4 shrink-0 text-text-muted group-hover:text-primary" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium group-hover:text-primary">
                        {a.title}
                      </span>
                      {a.slugPath.length > 1 && (
                        <span className="block truncate text-xs text-text-muted">
                          {a.slugPath.slice(0, -1).join(" › ")}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PortalShell>
    );
  }

  const categories = tree.filter((n) => n.type === "folder");
  const looseArticles = tree.filter((n) => n.type === "article");
  const flat = flattenPortalTree(tree);
  const artigos = flat.filter((n) => n.type === "article");
  const recent = [...artigos]
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 6);

  const { supportUrl, tema } = spaceChrome(space);
  const href = (n: PortalTreeNode) => `/docs/${spaceSlug}/${n.slugPath.join("/")}`;

  // Destaques: ids curados no tema → só os que ainda existem E estão
  // publicados nesta árvore, na ordem escolhida no admin.
  const porId = new Map(artigos.map((n) => [n.id, n]));
  const idsDestaque = tema.home.featured.filter((id) => porId.has(id));
  const excerpts = await getArticleExcerpts(idsDestaque, db);
  const destaques = idsDestaque.map((id) => {
    const n = porId.get(id)!;
    return { id, title: n.title, href: href(n), excerpt: excerpts.get(id) ?? null };
  });

  // "Mais úteis": agregado de feedback via RPC (anon não lê a tabela crua).
  const maisUteis = (await getTopHelpful(space.id, db))
    .map((r) => porId.get(r.node_id))
    .filter((n): n is PortalTreeNode => !!n)
    .map((n) => ({ id: n.id, title: n.title, href: href(n) }));

  const dados: DadosHome = {
    spaceName: space.name,
    spaceSlug: space.slug,
    categorias: categories.map((f) => ({
      id: f.id,
      title: f.title,
      href: href(f),
      artigos: countArticles(f),
      icon: f.icon,
      descricao: f.description,
    })),
    artigosSoltos: looseArticles.map((a) => ({
      id: a.id,
      title: a.title,
      href: href(a),
      icon: a.icon,
    })),
    recentes: recent.map((a) => ({
      id: a.id,
      title: a.title,
      href: href(a),
      updatedAt: a.updated_at,
    })),
    destaques,
    maisUteis,
    supportUrl,
  };

  return (
    <PortalShell space={space} tree={tree} activePath="" nav={false} width="wide">
      {originSetter}
      <SpaceHomeView tema={tema} dados={dados} />
    </PortalShell>
  );
}
