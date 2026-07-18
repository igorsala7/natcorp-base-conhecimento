import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listTree, slugPathsOf, type TreeNode } from "@/lib/content/tree";
import { docToMarkdown } from "@/lib/content/export-markdown";
import { makeZip, type ZipEntry } from "@/lib/content/zip";

export const runtime = "nodejs";

/**
 * GET /api/admin/export?space=<id> — backup do espaço em Markdown + manifest.json,
 * empacotado em .zip. Formato aberto e reimportável. Exige content.restore.
 */
export async function GET(req: NextRequest) {
  const spaceId = req.nextUrl.searchParams.get("space");
  if (!spaceId) return Response.json({ error: "space obrigatório." }, { status: 400 });
  if (!(await hasPermission("content.restore", spaceId))) {
    return Response.json({ error: "Sem permissão para exportar." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: space } = await supabase
    .from("spaces")
    .select("slug, name, type")
    .eq("id", spaceId)
    .single();
  if (!space) return Response.json({ error: "Espaço não encontrado." }, { status: 404 });

  const [tree, slugPaths] = await Promise.all([listTree(spaceId), slugPathsOf(spaceId)]);

  // Achata a árvore, preservando ordem e coletando os artigos.
  type Flat = { id: string; type: string; title: string; slug: string; status: string; path: string[] };
  const flat: Flat[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      flat.push({
        id: n.id,
        type: n.type,
        title: n.title,
        slug: n.slug,
        status: n.status,
        path: slugPaths.get(n.id) ?? [n.slug],
      });
      walk(n.children);
    }
  };
  walk(tree);

  const articleIds = flat.filter((f) => f.type === "article").map((f) => f.id);
  const contentByNode = new Map<string, unknown>();
  if (articleIds.length) {
    const { data: arts } = await supabase
      .from("articles")
      .select("node_id, content_json")
      .in("node_id", articleIds);
    for (const a of arts ?? []) contentByNode.set(a.node_id, a.content_json);
  }

  const entries: ZipEntry[] = [];
  for (const f of flat) {
    if (f.type !== "article") continue;
    const md = docToMarkdown(contentByNode.get(f.id));
    const front =
      `---\n` +
      `title: ${JSON.stringify(f.title)}\n` +
      `slug: ${f.slug}\n` +
      `status: ${f.status}\n` +
      `path: ${f.path.join("/")}\n` +
      `---\n\n`;
    entries.push({ name: `content/${f.path.join("/")}.md`, data: front + md });
  }

  const manifest = {
    space: { slug: space.slug, name: space.name, type: space.type },
    exportedAt: new Date().toISOString(),
    count: flat.length,
    nodes: flat.map((f) => ({
      id: f.id,
      type: f.type,
      title: f.title,
      slug: f.slug,
      status: f.status,
      path: f.path.join("/"),
    })),
  };
  entries.unshift({ name: "manifest.json", data: JSON.stringify(manifest, null, 2) });

  const zip = makeZip(entries);
  const filename = `${space.slug}-export.zip`;
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
