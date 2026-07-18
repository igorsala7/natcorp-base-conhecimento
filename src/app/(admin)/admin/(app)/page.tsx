import type { Metadata } from "next";
import Link from "next/link";
import { FolderTree, FileText, CheckCircle2, CheckSquare, MessageSquare, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

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

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              href={c.href}
              className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary"
            >
              <Icon className="size-5 text-text-muted" />
              <div className="mt-2 text-3xl font-semibold tabular-nums">{c.value}</div>
              <div className="text-sm text-text-muted">{c.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/revisao"
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary"
        >
          <CheckSquare className="size-5 text-primary" />
          <div className="flex-1">
            <div className="text-sm font-medium">Fila de revisão</div>
            <div className="text-xs text-text-muted">Artigos aguardando aprovação</div>
          </div>
          <span className="rounded-full bg-brand-purple-50 px-2.5 py-1 text-sm font-semibold text-primary dark:bg-brand-purple-950/40">
            {review.count ?? 0}
          </span>
        </Link>
        <Link
          href="/admin/analises"
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary"
        >
          <Search className="size-5 text-brand-pink-700" />
          <div className="flex-1">
            <div className="text-sm font-medium">Buscas sem resultado</div>
            <div className="text-xs text-text-muted">Lacunas na documentação</div>
          </div>
          <span className="rounded-full bg-brand-pink-50 px-2.5 py-1 text-sm font-semibold text-brand-pink-700 dark:bg-brand-pink-950/40">
            {gaps.count ?? 0}
          </span>
        </Link>
      </div>
    </div>
  );
}
