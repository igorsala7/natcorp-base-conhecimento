import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  CheckSquare,
  Eye,
  FileText,
  FolderTree,
  MessageSquare,
  PenSquare,
  Search,
  ThumbsUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";

export const metadata: Metadata = { title: "Painel" };

/** Painel do admin (padrão Lumina) — números reais, ranking e pendências. */
export default async function AdminHome() {
  const supabase = await createClient();
  const [spaces, articles, published, review, convs, gaps, viewsRows, fbRows, draftRows] =
    await Promise.all([
      supabase.from("spaces").select("id", { count: "exact", head: true }),
      supabase.from("nodes").select("id", { count: "exact", head: true }).eq("type", "article").is("deleted_at", null),
      supabase.from("nodes").select("id", { count: "exact", head: true }).eq("type", "article").eq("status", "published").is("deleted_at", null),
      supabase.from("nodes").select("id", { count: "exact", head: true }).eq("status", "review").is("deleted_at", null),
      supabase.from("conversations").select("id", { count: "exact", head: true }),
      // Só o portal: busca do admin é o time procurando, não leitor sem resposta.
      supabase.from("search_logs").select("id", { count: "exact", head: true }).eq("results_count", 0).eq("origin", "portal"),
      supabase.from("article_views").select("node_id, views"),
      supabase.from("article_feedback").select("node_id, helpful"),
      supabase
        .from("nodes")
        .select("id, title, updated_at")
        .eq("type", "article")
        .eq("status", "draft")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

  // Ranking "melhor desempenho": views somadas + % útil do feedback.
  const viewsPorNode = new Map<string, number>();
  for (const r of viewsRows.data ?? []) {
    viewsPorNode.set(r.node_id, (viewsPorNode.get(r.node_id) ?? 0) + r.views);
  }
  const fbPorNode = new Map<string, { sim: number; total: number }>();
  for (const r of fbRows.data ?? []) {
    const f = fbPorNode.get(r.node_id) ?? { sim: 0, total: 0 };
    f.total += 1;
    if (r.helpful) f.sim += 1;
    fbPorNode.set(r.node_id, f);
  }
  const topIds = [...viewsPorNode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const { data: topNodes } = topIds.length
    ? await supabase
        .from("nodes")
        .select("id, title, status")
        .in("id", topIds.map(([id]) => id))
    : { data: [] as { id: string; title: string; status: string }[] };
  const top = topIds
    .map(([id, views]) => {
      const node = (topNodes ?? []).find((n) => n.id === id);
      if (!node) return null;
      const fb = fbPorNode.get(id);
      return {
        id,
        title: node.title,
        status: node.status,
        views,
        util: fb && fb.total > 0 ? Math.round((fb.sim / fb.total) * 100) : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const totalFb = (fbRows.data ?? []).length;
  const totalSim = (fbRows.data ?? []).filter((r) => r.helpful).length;
  const satisfacao = totalFb > 0 ? Math.round((totalSim / totalFb) * 100) : null;
  const totalViews = [...viewsPorNode.values()].reduce((a, b) => a + b, 0);

  const cards = [
    {
      label: "Artigos publicados",
      value: String(published.count ?? 0),
      detail: `${(articles.count ?? 0) - (published.count ?? 0)} em rascunho`,
      icon: FileText,
      accent: "from-brand-purple-500 to-brand-purple-800",
      href: "/admin/conteudo",
    },
    {
      label: "Documentações",
      value: String(spaces.count ?? 0),
      detail: "Organizando o conteúdo",
      icon: FolderTree,
      accent: "from-sky-500 to-blue-700",
      href: "/admin/documentacoes",
    },
    {
      label: "Visualizações",
      value: totalViews.toLocaleString("pt-BR"),
      detail: "Somadas em todos os artigos",
      icon: Eye,
      accent: "from-emerald-500 to-teal-700",
      href: "/admin/analises",
    },
    {
      label: "Satisfação",
      value: satisfacao === null ? "—" : `${satisfacao}%`,
      detail: `${totalFb.toLocaleString("pt-BR")} avaliações recebidas`,
      icon: ThumbsUp,
      accent: "from-amber-500 to-orange-600",
      href: "/admin/analises",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
      <p className="mt-1 text-sm text-text-muted">Visão geral da sua base de conhecimento.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              href={c.href}
              style={{ animationDelay: `${i * 60}ms` }}
              className="animate-fade-up group"
            >
              <Surface
                elevation={1}
                padding="none"
                className="relative h-full overflow-hidden rounded-xl p-5 shadow-1 transition-shadow hover:shadow-2"
              >
                <div
                  aria-hidden
                  className={`absolute right-0 top-0 size-20 -translate-y-6 translate-x-6 rounded-full bg-gradient-to-br opacity-10 ${c.accent}`}
                />
                <div
                  className={`mb-3 flex size-9 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-1 ${c.accent}`}
                >
                  <Icon className="size-4" />
                </div>
                <div className="text-2xl font-bold leading-none tracking-tight tabular-nums">
                  {c.value}
                </div>
                <div className="mt-0.5 text-sm font-medium text-text-muted">{c.label}</div>
                <div className="mt-0.5 text-xs text-brand-gray-400">{c.detail}</div>
              </Surface>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Ranking de artigos com barra "% útil" */}
        <Surface elevation={1} padding="none" className="self-start overflow-hidden">
          <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-bold">Artigos com melhor desempenho</h2>
            <Link
              href="/admin/analises"
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
            >
              Ver análises <ArrowUpRight className="size-3.5" />
            </Link>
          </header>
          {top.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-text-muted">
              Sem visualizações registradas ainda — publique e compartilhe conteúdo.
            </p>
          ) : (
            <div>
              {top.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/conteudo/${a.id}`}
                  className="flex items-center gap-4 border-b border-border px-5 py-3.5 transition-colors last:border-b-0 hover:bg-brand-purple-50/40 dark:hover:bg-brand-purple-950/20"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                      <Badge tone={a.status === "published" ? "success" : "warning"}>
                        {a.status === "published" ? "Publicado" : "Rascunho"}
                      </Badge>
                      {a.views.toLocaleString("pt-BR")} visualizações
                    </p>
                  </div>
                  {a.util !== null && (
                    <div className="w-28 shrink-0">
                      <div className="mb-1 flex justify-between text-2xs font-semibold text-text-muted">
                        <span>Útil</span>
                        <span>{a.util}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                          style={{ width: `${a.util}%` }}
                        />
                      </div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Surface>

        <div className="space-y-6">
          {/* Pendências */}
          <Surface elevation={1} padding="lg">
            <h2 className="mb-3 text-sm font-bold">Precisa de atenção</h2>
            <div className="space-y-2">
              <Link
                href="/admin/revisao"
                className="flex items-center gap-3 rounded-md border border-border px-3.5 py-2.5 transition-colors hover:border-brand-purple-300"
              >
                <CheckSquare className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 text-sm font-medium">Fila de revisão</span>
                <span className="text-sm font-semibold tabular-nums">{review.count ?? 0}</span>
              </Link>
              <Link
                href="/admin/analises"
                className="flex items-center gap-3 rounded-md border border-border px-3.5 py-2.5 transition-colors hover:border-brand-purple-300"
              >
                <Search className="size-4 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 text-sm font-medium">Buscas sem resultado</span>
                <span className="text-sm font-semibold tabular-nums">{gaps.count ?? 0}</span>
              </Link>
            </div>
          </Surface>

          {/* Rascunhos pendentes */}
          <Surface elevation={1} padding="lg">
            <h2 className="mb-3 text-sm font-bold">Rascunhos pendentes</h2>
            {(draftRows.data ?? []).length === 0 ? (
              <p className="text-sm text-text-muted">Nenhum rascunho no momento. Tudo publicado!</p>
            ) : (
              <div className="space-y-2">
                {(draftRows.data ?? []).map((d) => (
                  <Link
                    key={d.id}
                    href={`/admin/conteudo/${d.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 transition-colors hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950/25"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{d.title}</span>
                      <span className="block text-2xs text-amber-700 dark:text-amber-400">
                        Editado em {new Date(d.updated_at).toLocaleDateString("pt-BR")}
                      </span>
                    </span>
                    <PenSquare className="size-4 shrink-0 text-amber-600" />
                  </Link>
                ))}
              </div>
            )}
          </Surface>

          {/* Dica */}
          <div className="rounded-lg border border-brand-purple-200 bg-gradient-to-br from-brand-purple-50 to-surface p-5 shadow-1 dark:border-brand-purple-900 dark:from-brand-purple-950/40 dark:to-surface">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-brand-purple-900 dark:text-brand-purple-200">
              <CheckCircle2 className="size-4" /> Dica de conteúdo
            </h2>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-brand-purple-900/90 dark:text-brand-purple-200/90">
              Artigos com <strong>passo a passo</strong> e <strong>checklist</strong> recebem mais
              avaliações positivas. Use os blocos visuais do editor — e o{" "}
              <strong>Melhorar layout</strong> converte texto corrido em blocos ricos com IA.
            </p>
            <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary">
              <MessageSquare className="size-3.5" /> {(convs.count ?? 0).toLocaleString("pt-BR")}{" "}
              conversas com o assistente
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
