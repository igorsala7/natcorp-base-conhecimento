import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getPublicSpace, getPortalTree, resolveByPath } from "@/lib/portal/data";

/** OG image dinâmica: /api/og?space=<slug>&path=<a/b/c> */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const spaceSlug = sp.get("space") ?? "";
  const pathStr = sp.get("path") ?? "";

  const space = await getPublicSpace(spaceSlug);
  let title = space?.name ?? "Documentação";
  if (space && pathStr) {
    const tree = await getPortalTree(space.id);
    const node = resolveByPath(tree, pathStr.split("/").filter(Boolean));
    if (node) title = node.title;
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #2C1A63 0%, #511C76 60%, #C95788 100%)",
          padding: 80,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 30, opacity: 0.85 }}>
          {space?.name ?? "Natcorp"}
        </div>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
          {title}
        </div>
        <div style={{ fontSize: 26, opacity: 0.8 }}>Base de Conhecimento</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
