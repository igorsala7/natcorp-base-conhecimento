import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, Folder } from "lucide-react";
import {
  getPortalAccess,
  getPortalTree,
  resolveByPath,
  getPublicArticle,
  getPublicSnippets,
  type PortalTreeNode,
} from "@/lib/portal/data";
import { RenderBlocks } from "@/lib/blocks/render";
import { normalizeDoc } from "@/lib/blocks/convert";
import { resolveTheme } from "@/lib/portal/theme";
import { ICONS } from "@/lib/blocks/icons";
import { EmbedFrame } from "@/components/portal/embed-frame";
import { env } from "@/lib/env";

/**
 * Página de INCORPORAÇÃO (iframe). Mesmos dados e acesso do portal, sem a casca:
 *  - nó ARTIGO → só o conteúdo do artigo;
 *  - nó DIRETÓRIO (ou raiz do espaço) → só a LISTA de subpastas e artigos dele,
 *    navegável DENTRO do iframe (cada item aponta para o próprio /embed).
 * Serve só conteúdo público (o mesmo `getPortalAccess` do portal barra o resto).
 */
export async function EmbedView({ spaceSlug, path }: { spaceSlug: string; path: string[] }) {
  const access = await getPortalAccess(spaceSlug);
  if (!access) notFound();

  if (access.locked) {
    // Espaço protegido (senha/origem): não dá para destravar dentro de um iframe
    // de terceiros — manda abrir no portal.
    const portalHref = `${env.NEXT_PUBLIC_SITE_URL}/docs/${spaceSlug}${path.length ? `/${path.join("/")}` : ""}`;
    return (
      <EmbedFrame space={access.space} portalHref={portalHref}>
        <p className="text-sm text-text-muted">
          Este conteúdo é protegido.{" "}
          <a href={portalHref} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
            Abra no portal
          </a>{" "}
          para acessá-lo.
        </p>
      </EmbedFrame>
    );
  }

  const { space, db } = access;
  const tree = await getPortalTree(space.id, db);
  const node = path.length ? resolveByPath(tree, path) : null;
  if (path.length && !node) notFound();

  const portalHref = `${env.NEXT_PUBLIC_SITE_URL}/docs/${space.slug}${path.length ? `/${path.join("/")}` : ""}`;

  // Artigo: só o conteúdo.
  if (node && node.type === "article") {
    const [art, snippets] = await Promise.all([getPublicArticle(node.id, db), getPublicSnippets(space.id, db)]);
    const { blocks } = normalizeDoc(art?.content_json);
    const size = resolveTheme(space.theme).article.fontSize;
    return (
      <EmbedFrame space={space} portalHref={portalHref}>
        <article className="leitura" data-size={size}>
          <h1 className="text-[length:var(--l-page,var(--text-3xl))] font-semibold leading-tight tracking-tight">
            {node.title}
          </h1>
          <div className="prose prose-neutral prose-portal mt-4 max-w-none dark:prose-invert">
            <RenderBlocks blocks={blocks} snippets={snippets} />
          </div>
        </article>
      </EmbedFrame>
    );
  }

  // Diretório (ou raiz): lista de subpastas e artigos deste nível.
  const filhos = (node ? node.children : tree).filter((c) => c.type === "folder" || c.type === "article");
  const titulo = node ? node.title : space.name;
  return (
    <EmbedFrame space={space} portalHref={portalHref}>
      <h1 className="text-[length:var(--l-page,var(--text-3xl))] font-semibold leading-tight tracking-tight">{titulo}</h1>
      {filhos.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">Nada publicado aqui ainda.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {filhos.map((c) => (
            <li key={c.id}>
              <Link
                href={`/embed/${space.slug}/${c.slugPath.join("/")}`}
                className="group flex items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-brand-purple-50/50 dark:hover:bg-brand-purple-950/25"
              >
                <ItemIcon node={c} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-text transition-colors group-hover:text-primary">
                  {c.title}
                </span>
                <ChevronRight className="size-4 shrink-0 text-text-muted transition-colors group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </EmbedFrame>
  );
}

function ItemIcon({ node }: { node: PortalTreeNode }) {
  const Custom = node.icon ? ICONS[node.icon] : null;
  const Icon = Custom ?? (node.type === "folder" ? Folder : FileText);
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40">
      <Icon className="size-4" />
    </span>
  );
}
