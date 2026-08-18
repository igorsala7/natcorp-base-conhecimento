import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { fetchAllPaged } from "@/lib/supabase/paginate";

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
  /**
   * PAGINADO — um CSV truncado é pior que uma tela truncada.
   *
   * A consulta era `.select().gte().order()` sem limite: no teto padrão de
   * 1.000 linhas do PostgREST, o arquivo sairia cortado sem nenhum sinal. E a
   * tela pelo menos fica na tela, onde alguém pode estranhar; o CSV é baixado,
   * aberto no Excel, somado e levado a uma reunião. O dado errado ganha vida
   * própria no instante em que vira arquivo.
   *
   * A tela agrega no banco (`analises_serie`), mas aqui não dá: o export é
   * DETALHADO por artigo e por dia — é justamente o detalhe que a pessoa veio
   * buscar. Então a saída é paginar, com ordenação total e estável (`day` +
   * `node_id`) para as fatias não pularem nem repetirem na fronteira.
   */
  const views = await fetchAllPaged<{ node_id: string; day: string; views: number }>((from, to) =>
    supabase
      .from("article_views")
      .select("node_id, day, views")
      .gte("day", corte)
      .order("day")
      .order("node_id")
      .range(from, to),
  );

  const ids = [...new Set(views.map((v) => v.node_id))];
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
    ...views.map((v) => {
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
