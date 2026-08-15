import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { eyebrowLabel } from "@/components/ui/field";
import { QualityScanButton } from "./quality-scan-button";
import { ViewsChart } from "./views-chart";
import type { QualityIssue } from "@/lib/quality/audit-article";
import { SemPermissao } from "@/components/ui/sem-permissao";

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
      <SemPermissao
        titulo="Análises"
        oQue="ver as análises"
        permissao="content.view"
        papel="Leitor"
      />
    );
  }
  const supabase = await createClient();

  // Página dinâmica de admin: "hoje" é avaliado por requisição, de propósito —
  // não há re-render de cliente para o valor divergir.
  // eslint-disable-next-line react-hooks/purity
  const corte90d = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: searches }, { data: msgs }, { count: convCount }, { data: fb }, { data: views }, { data: quality }, { data: spacesList }] =
    await Promise.all([
      // Idem: lacuna de documentação é o que o LEITOR não achou.
      supabase.from("search_logs").select("query, results_count").eq("origin", "portal").order("created_at", { ascending: false }).limit(3000),
      supabase.from("messages").select("role, feedback, latency_ms, content").eq("role", "assistant").order("created_at", { ascending: false }).limit(2000),
      supabase.from("conversations").select("id", { count: "exact", head: true }),
      supabase.from("article_feedback").select("node_id, helpful").order("created_at", { ascending: false }).limit(2000),
      // Últimos 90 dias de contadores diários (node_id, day, views).
      supabase.from("article_views").select("node_id, day, views").gte("day", corte90d),
      supabase.from("quality_reports").select("node_id, space_id, issues, score, run_at").order("score", { ascending: false }),
      supabase.from("spaces").select("id, name").order("name"),
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

  // Leitura (últimos 90 dias): total, mais vistos, e publicados sem visita.
  const viewRows = views ?? [];
  const totalViews = viewRows.reduce((n, v) => n + v.views, 0);
  const viewsByNode = new Map<string, number>();
  for (const v of viewRows) viewsByNode.set(v.node_id, (viewsByNode.get(v.node_id) ?? 0) + v.views);
  const topViewed = [...viewsByNode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Mais bem avaliados: % de "útil" com um mínimo de votos — o critério da
  // região "Mais úteis" da home (a HubSpot chama de highest-rated).
  const fbByNode = new Map<string, { up: number; total: number }>();
  for (const f of fbRows) {
    const cur = fbByNode.get(f.node_id) ?? { up: 0, total: 0 };
    cur.total += 1;
    if (f.helpful) cur.up += 1;
    fbByNode.set(f.node_id, cur);
  }
  const bestRated = [...fbByNode.entries()]
    .filter(([, s]) => s.total >= 3 && s.up / s.total >= 0.6)
    .sort((a, b) => b[1].up / b[1].total - a[1].up / a[1].total || b[1].total - a[1].total)
    .slice(0, 8);

  const { data: publicados } = await supabase
    .from("nodes")
    .select("id, title, space_id")
    .eq("type", "article")
    .eq("status", "published")
    .is("deleted_at", null)
    .limit(2000);
  const semVisita = (publicados ?? []).filter((n) => !viewsByNode.has(n.id)).slice(0, 8);

  const idsComTitulo = [
    ...new Set([...negByNode.map(([id]) => id), ...topViewed.map(([id]) => id), ...bestRated.map(([id]) => id)]),
  ];
  const titleById = new Map<string, string>((publicados ?? []).map((n) => [n.id, n.title]));
  const faltando = idsComTitulo.filter((id) => !titleById.has(id));
  if (faltando.length) {
    const { data: nodes } = await supabase.from("nodes").select("id, title").in("id", faltando);
    for (const n of nodes ?? []) titleById.set(n.id, n.title);
  }

  // Série do gráfico: (dia, documentação, views). Nó que saiu do ar entre a
  // visita e agora fica de fora — o gráfico é sobre o portal como ele está.
  const spaceByNode = new Map((publicados ?? []).map((n) => [n.id, n.space_id]));
  const pontosGrafico = viewRows.flatMap((v) => {
    const spaceId = spaceByNode.get(v.node_id);
    return spaceId ? [{ day: v.day, spaceId, views: v.views }] : [];
  });

  // Qualidade: agregados da última varredura (issues por impacto).
  const qualityRows = quality ?? [];
  const porImpacto = { alto: 0, medio: 0, baixo: 0 };
  for (const q of qualityRows) {
    for (const issue of (q.issues as unknown as QualityIssue[]) ?? []) {
      porImpacto[issue.impacto] += 1;
    }
  }
  const ultimaVarredura = qualityRows.reduce<string | null>(
    (max, q) => (max && max > q.run_at ? max : q.run_at),
    null,
  );

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
        <h2 className={`mb-3 ${eyebrowLabel}`}>Busca</h2>
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
        <h2 className={`mb-3 ${eyebrowLabel}`}>Assistente (chat)</h2>
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

      {/* Leitura */}
      <section>
        <h2 className={`mb-3 ${eyebrowLabel}`}>Leitura (90 dias)</h2>
        <div className="mb-3">
          <ViewsChart pontos={pontosGrafico} spaces={spacesList ?? []} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Visualizações" value={totalViews} hint="1× por artigo por sessão" />
          <StatCard label="Artigos vistos" value={viewsByNode.size} />
          <StatCard
            label="Publicados sem visita"
            value={(publicados ?? []).length ? (publicados ?? []).length - viewsByNode.size : "—"}
            hint="lacunas de descoberta"
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <RankList
            title="Mais vistos"
            rows={topViewed.map(([id, n]) => [titleById.get(id) ?? id, n])}
            empty="Ainda sem visualizações registradas."
          />
          <RankList
            title="Mais bem avaliados (mín. 3 votos)"
            rows={bestRated.map(([id, s]) => [
              titleById.get(id) ?? id,
              Math.round((s.up / s.total) * 100),
            ])}
            empty="Ainda sem artigos com votos suficientes."
          />
        </div>
        {semVisita.length > 0 && viewsByNode.size > 0 && (
          <div className="mt-3">
            <RankList
              title="Publicados que ninguém abriu nos últimos 90 dias"
              rows={semVisita.map((n) => [n.title, 0])}
              empty=""
              accent
            />
          </div>
        )}
      </section>

      {/* Feedback dos artigos */}
      <section>
        <h2 className={`mb-3 ${eyebrowLabel}`}>“Isso foi útil?” nos artigos</h2>
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

      {/* Qualidade/SEO (varredura do worker: painel Otimizar em massa) */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className={eyebrowLabel}>Qualidade da documentação</h2>
          <QualityScanButton spaces={spacesList ?? []} />
        </div>
        {qualityRows.length === 0 ? (
          <Surface elevation={1}>
            <p className="text-sm text-text-muted">
              Nenhuma varredura ainda. Escolha a documentação e clique em “Analisar qualidade” —
              o worker audita descrição, alt de imagens, títulos e links (internos e externos).
            </p>
          </Surface>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Artigos analisados" value={qualityRows.length} hint={ultimaVarredura ? `Última varredura: ${new Date(ultimaVarredura).toLocaleString("pt-BR")}` : undefined} />
              <StatCard label="Impacto alto" value={porImpacto.alto} />
              <StatCard label="Impacto médio" value={porImpacto.medio} />
              <StatCard label="Impacto baixo" value={porImpacto.baixo} />
            </div>
            <div className="mt-3">
              <RankList
                title="Artigos com mais pontos de atenção"
                rows={qualityRows
                  .filter((q) => q.score > 0)
                  .slice(0, 8)
                  .map((q) => [titleById.get(q.node_id) ?? q.node_id, q.score])}
                empty="Nenhum problema encontrado — documentação em ordem."
                accent
              />
            </div>
          </>
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
    <Surface elevation={1} padding="none" className="overflow-hidden">
      <p className="border-b border-border px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-text-muted">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-text-muted">{empty}</p>
      ) : (
        <ul>
          {rows.map(([q, n]) => (
            <li
              key={q}
              className="flex items-center gap-4 border-b border-border px-5 py-3.5 text-sm transition-colors last:border-b-0 hover:bg-brand-purple-50/40 dark:hover:bg-brand-purple-950/20"
            >
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
