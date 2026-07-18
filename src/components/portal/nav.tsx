import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PortalTreeNode } from "@/lib/portal/data";

/** Navegação lateral do portal: árvore de seções e artigos publicados. */
export function PortalNav({
  spaceSlug,
  tree,
  activePath,
}: {
  spaceSlug: string;
  tree: PortalTreeNode[];
  activePath: string;
}) {
  return (
    <nav aria-label="Navegação da documentação" className="text-sm">
      <NavList spaceSlug={spaceSlug} nodes={tree} activePath={activePath} depth={0} />
    </nav>
  );
}

function NavList({
  spaceSlug,
  nodes,
  activePath,
  depth,
}: {
  spaceSlug: string;
  nodes: PortalTreeNode[];
  activePath: string;
  depth: number;
}) {
  return (
    <ul className={cn(depth > 0 && "ml-3 border-l border-border pl-2")}>
      {nodes
        .filter((n) => n.type !== "divider")
        .map((node) => {
          const href =
            node.type === "link" && node.link_url
              ? node.link_url
              : `/docs/${spaceSlug}/${node.slugPath.join("/")}`;
          const isActive = activePath === node.slugPath.join("/");
          return (
            <li key={node.id} className="py-0.5">
              <Link
                href={href}
                className={cn(
                  "block rounded px-2 py-1 transition",
                  isActive
                    ? "bg-brand-purple-50 font-medium text-primary dark:bg-brand-purple-950/40"
                    : "text-text-muted hover:text-text",
                  node.type === "folder" && "font-medium text-text",
                )}
              >
                {node.title}
              </Link>
              {node.children.length > 0 && (
                <NavList
                  spaceSlug={spaceSlug}
                  nodes={node.children}
                  activePath={activePath}
                  depth={depth + 1}
                />
              )}
            </li>
          );
        })}
    </ul>
  );
}
