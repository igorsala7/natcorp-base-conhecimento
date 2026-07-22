import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";

/**
 * Export CSV das visualizações diárias (90 dias) com título e documentação —
 * a "visão de tabela" do gráfico de Análises. Mesma permissão da página.
 */
export async function GET(): Promise<Response> {
  if (!(await hasPermission("content.view"))) {
    return new Response("Sem permissão.", { status: 403 });
  }
  const supabase = await createClient();
  const corte = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const { data: views } = await supabase
    .from("article_views")
    .select("node_id, day, views")
    .gte("day", corte)
    .order("day");

  const ids = [...new Set((views ?? []).map((v) => v.node_id))];
  const meta = new Map<string, { title: string; space: string }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: nodes } = await supabase
      .from("nodes")
      .select("id, title, spaces(name)")
      .in("id", ids.slice(i, i + 200));
    for (const n of nodes ?? []) {
      meta.set(n.id, {
        title: n.title,
        space: (n.spaces as unknown as { name: string } | null)?.name ?? "",
      });
    }
  }

  const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const linhas = [
    "dia;documentacao;artigo;visualizacoes",
    ...(views ?? []).map((v) => {
      const m = meta.get(v.node_id);
      return [v.day, esc(m?.space ?? ""), esc(m?.title ?? v.node_id), String(v.views)].join(";");
    }),
  ];
  // BOM para o Excel abrir com acentuação correta.
  const csv = "﻿" + linhas.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="visualizacoes-90d.csv"`,
    },
  });
}
