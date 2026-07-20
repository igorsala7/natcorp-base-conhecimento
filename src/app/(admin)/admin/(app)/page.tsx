import type { Metadata } from "next";
import Link from "next/link";
import { FolderTree, FileText, CheckCircle2, CheckSquare, MessageSquare, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Surface } from "@/components/ui/surface";

export const metadata: Metadata = { title: "Painel" };

/** Painel do admin — números reais + atalhos e pendências. */
export default async function AdminHome() {
  const supabase = await createClient();
  const [spaces, articles, published, review, convs, gaps] = await Promise.all([
    supabase.from("spaces").select("id", { count: "exact", head: true }),
    supabase.from("nodes").select("id", { count: "exact", head: true }).eq("type", "article").is("deleted_at", null),
    supabase.from("nodes").select("id", { count: "exact", head: true }).eq("type", "article").eq("status", "published").is("deleted_at", null),
    supabase.from("nodes").select("id", { count: "exact", head: true }).eq("status", "review").is("deleted_at", null),
    supabase.from("conversations").select("id", { count: "exact", head: true }),
    supabase.from("search_logs").select("id", { count: "exact", head: true }).eq("results_count", 0),
  ]);

  const cards = [
    { label: "Espaços", value: spaces.count ?? 0, icon: FolderTree, href: "/admin/conteudo" },
    { label: "Artigos", value: articles.count ?? 0, icon: FileText, href: "/admin/conteudo" },
    { label: "Publicados", value: published.count ?? 0, icon: CheckCircle2, href: "/admin/conteudo" },
    { label: "Conversas", value: convs.count ?? 0, icon: MessageSquare, href: "/admin/analises" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
      <p className="mt-1 text-sm text-text-muted">Visão geral da sua base de conhecimento.</p>

      {/* KPIs: o número é o protagonista — rótulo discreto acima, valor grande
          e tabular abaixo (padrão de painel enterprise). */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} href={c.href} className="group">
              <Surface elevation={1} padding="lg" className="h-full transition-shadow hover:shadow-2">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-muted">
                  <Icon className="size-3.5" />
                  {c.label}
                </div>
                <div className="mt-2 text-[length:var(--text-3xl)] font-semibold leading-none tabular-nums">
                  {c.value}
                </div>
              </Surface>
            </Link>
          );
        })}
      </div>

      <h2 className="mt-10 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Precisa de atenção
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/revisao">
          <Surface
            elevation={1}
            className="flex h-full items-center gap-3 transition-shadow hover:shadow-2"
          >
            <CheckSquare className="size-5 shrink-0 text-primary" />
            <div className="flex-1">
              <div className="text-sm font-medium">Fila de revisão</div>
              <div className="text-xs text-text-muted">Artigos aguardando aprovação</div>
            </div>
            <span className="text-xl font-semibold tabular-nums">{review.count ?? 0}</span>
          </Surface>
        </Link>
        <Link href="/admin/analises">
          <Surface
            elevation={1}
            className="flex h-full items-center gap-3 transition-shadow hover:shadow-2"
          >
            <Search className="size-5 shrink-0 text-accent" />
            <div className="flex-1">
              <div className="text-sm font-medium">Buscas sem resultado</div>
              <div className="text-xs text-text-muted">Lacunas na documentação</div>
            </div>
            <span className="text-xl font-semibold tabular-nums">{gaps.count ?? 0}</span>
          </Surface>
        </Link>
      </div>
    </div>
  );
}
