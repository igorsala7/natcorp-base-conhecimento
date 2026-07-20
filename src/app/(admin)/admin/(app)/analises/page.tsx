import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Análises" };

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Surface elevation={1}>
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-1.5 text-[length:var(--text-2xl)] font-semibold leading-none tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </Surface>
  );
}

function topBy<T>(rows: T[], key: (r: T) => string, filter?: (r: T) => boolean, limit = 8) {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (filter && !filter(r)) continue;
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export default async function AnalisesPage() {
  if (!(await hasPermission("content.view"))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Análises</h1>
        <p className="mt-2 text-text-muted">Sem permissão.</p>
      </div>
    );
  }
  const supabase = await createClient();

  const [{ data: searches }, { data: msgs }, { count: convCount }, { data: fb }] = await Promise.all([
    supabase.from("search_logs").select("query, results_count").order("created_at", { ascending: false }).limit(3000),
    supabase.from("messages").select("role, feedback, latency_ms, content").eq("role", "assistant").order("created_at", { ascending: false }).limit(2000),
    supabase.from("conversations").select("id", { count: "exact", head: true }),
    supabase.from("article_feedback").select("node_id, helpful").order("created_at", { ascending: false }).limit(2000),
  ]);

  const searchRows = searches ?? [];
  const totalSearches = searchRows.length;
  const zeroSearches = searchRows.filter((s) => s.results_count === 0);
  const topQueries = topBy(searchRows, (s) => s.query);
  const topGaps = topBy(zeroSearches, (s) => s.query);

  const msgRows = msgs ?? [];
  const answers = msgRows.length;
  const up = msgRows.filter((m) => m.feedback === 1).length;
  const down = msgRows.filter((m) => m.feedback === -1).length;
  const refusals = msgRows.filter((m) => (m.content ?? "").startsWith("Não encontrei")).length;
  const latencies = msgRows.map((m) => m.latency_ms).filter((n): n is number => typeof n === "number");
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  const fbRows = fb ?? [];
  const helpful = fbRows.filter((f) => f.helpful).length;
  const notHelpful = fbRows.filter((f) => !f.helpful).length;
  // Artigos com mais "não ajudou".
  const negByNode = topBy(fbRows, (f) => f.node_id, (f) => !f.helpful, 6);
  const negIds = negByNode.map(([id]) => id);
  const titleById = new Map<string, string>();
  if (negIds.length) {
    const { data: nodes } = await supabase.from("nodes").select("id, title").in("id", negIds);
    for (const n of nodes ?? []) titleById.set(n.id, n.title);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Análises</h1>
        <p className="mt-1 text-sm text-text-muted">
          Onde os usuários buscam, o que não encontram e como o assistente está indo.
        </p>
      </div>

      {/* Busca */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-text-muted">Busca</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Buscas registradas" value={totalSearches} />
          <StatCard label="Sem resultado" value={zeroSearches.length} hint="lacunas na documentação" />
          <StatCard
            label="Taxa sem resultado"
            value={totalSearches ? `${Math.round((zeroSearches.length / totalSearches) * 100)}%` : "—"}
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <RankList title="Buscas mais frequentes" rows={topQueries} empty="Ainda sem buscas." />
          <RankList
            title="Buscas sem resultado (lacunas)"
            rows={topGaps}
            empty="Nenhuma busca sem resultado. 🎉"
            accent
          />
        </div>
      </section>

      {/* Assistente */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-text-muted">Assistente (chat)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Conversas" value={convCount ?? 0} />
          <StatCard label="Respostas" value={answers} />
          <StatCard label="Latência média" value={avgLatency ? `${avgLatency} ms` : "—"} />
          <StatCard
            label="Feedback"
            value={`${up} 👍 / ${down} 👎`}
            hint={`${refusals} sem resposta na base`}
          />
        </div>
      </section>

      {/* Feedback dos artigos */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-text-muted">“Isso foi útil?” nos artigos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Úteis" value={helpful} />
          <StatCard label="Não úteis" value={notHelpful} />
          <StatCard
            label="Aprovação"
            value={helpful + notHelpful ? `${Math.round((helpful / (helpful + notHelpful)) * 100)}%` : "—"}
          />
        </div>
        {negByNode.length > 0 && (
          <div className="mt-3">
            <RankList
              title="Artigos que mais receberam “não ajudou”"
              rows={negByNode.map(([id, n]) => [titleById.get(id) ?? id, n])}
              empty=""
              accent
            />
          </div>
        )}
      </section>
    </div>
  );
}

function RankList({
  title,
  rows,
  empty,
  accent,
}: {
  title: string;
  rows: [string, number][];
  empty: string;
  accent?: boolean;
}) {
  return (
    <Surface elevation={1}>
      <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-text-muted">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map(([q, n]) => (
            <li key={q} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{q}</span>
              <Badge tone={accent ? "accent" : "neutral"} className="tabular-nums">
                {n}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
