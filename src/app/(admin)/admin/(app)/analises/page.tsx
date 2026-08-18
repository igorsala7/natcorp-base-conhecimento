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
import { PageShell } from "@/components/ui/page-shell";
import { permissoesDo } from "@/lib/auth/permissions";
import { resolvedSpaceId } from "@/lib/content/current-space";
import { AbasRota } from "@/components/admin/abas-rota";

export const metadata: Metadata = { title: "Desempenho" };

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

/** As abas declaradas no `mapa-rotas` para esta rota. Fallback: a primeira. */
const ABAS = ["busca", "leitura", "chat", "qualidade"] as const;
type AbaDesempenho = (typeof ABAS)[number];

export default async function AnalisesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  if (!(await hasPermission("content.view"))) {
    return (
      <SemPermissao
        titulo="Desempenho"
        oQue="ver as análises"
        permissao="content.view"
        papel="Leitor"
      />
    );
  }

  /**
   * A tela era UMA ROLAGEM com cinco blocos, enquanto o `mapa-rotas` declarava
   * quatro abas para ela. O Cmd+K oferecia "Desempenho › Qualidade", montava a
   * URL `?aba=qualidade`, e a página ignorava o parâmetro — a pessoa chegava no
   * topo da rolagem achando que tinha errado a busca.
   *
   * Aba desconhecida cai na primeira em vez de mostrar tela vazia: URL colada de
   * outra versão do produto não pode virar página em branco.
   */
  const { aba: abaParam } = await searchParams;
  const aba: AbaDesempenho = ABAS.includes(abaParam as AbaDesempenho)
    ? (abaParam as AbaDesempenho)
    : "busca";

  const supabase = await createClient();
  const permissoes = await permissoesDo();
  /**
   * Esta tela é GLOBAL (soma todas as documentações), mas a aba "Acessos" é por
   * documentação. O espaço vem do cookie — a última escolhida — só para a aba
   * vizinha não perder a seleção. Sem isso, sair de Desempenho para Acessos
   * jogaria a pessoa na primeira documentação da lista.
   */
  const { data: espacos } = await supabase.from("spaces").select("id");
  const spaceParaAbas = await resolvedSpaceId(undefined, espacos ?? []);

  // Página dinâmica de admin: "hoje" é avaliado por requisição, de propósito —
  // não há re-render de cliente para o valor divergir.
  // eslint-disable-next-line react-hooks/purity
  const corte90d = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: busca }, { data: chat }, { count: convCount }, { data: fb }, { data: leitura }, { data: serie }, { data: semVisitaRows }, { data: quality }, { data: spacesList }] =
    await Promise.all([
      /**
       * CHAT E BUSCA AGREGADOS — ver 20260817223000_analises_chat_busca.sql.
       *
       * Eram `.limit(3000)` e `.limit(2000)` com o TAMANHO DA AMOSTRA exibido
       * como total: o cartão "Respostas" mostrava `msgRows.length`, então a
       * partir de 2.000 assistentes ele travaria em 2.000 para sempre. E os
       * rankings saíam de uma amostra ordenada por data — eram o topo do que é
       * recente, não o topo do período; um termo muito buscado há dois meses
       * sumia.
       */
      supabase.rpc("analises_busca", { p_dias: 90, p_top: 8 }),
      supabase.rpc("analises_chat", { p_dias: 90 }),
      supabase.from("conversations").select("id", { count: "exact", head: true }),
      supabase.from("article_feedback").select("node_id, helpful").order("created_at", { ascending: false }).limit(2000),
      /**
       * LEITURA AGREGADA NO BANCO — ver 20260817220000_analises_agregado.sql.
       *
       * Aqui vinham `(nó, dia, views)` crus, SEM limite, somados em JS. Duas
       * consequências: o teto silencioso de 1.000 linhas do PostgREST, e uma
       * linha por ARTIGO por DIA trafegando só para desenhar um gráfico de
       * 90 pontos por documentação — com 1.392 publicados, teto teórico de
       * ~125 mil linhas. A série agregada tem 22 pontos hoje.
       */
      supabase.rpc("analises_leitura", { p_dias: 90, p_top: 8 }),
      supabase.rpc("analises_serie", { p_dias: 90 }),
      supabase.rpc("analises_sem_visita", { p_dias: 90, p_top: 8 }),
      // `quality_reports` também estava sem limite; o teto vale igual.
      supabase.from("quality_reports").select("node_id, space_id, issues, score, run_at").order("score", { ascending: false }).limit(2000),
      supabase.from("spaces").select("id, name").order("name"),
    ]);

  // Busca: totais e rankings contados sobre a janela inteira, no banco.
  const buscaRows = busca ?? [];
  const totalSearches = Number(buscaRows[0]?.total ?? 0);
  const zeroCount = Number(buscaRows[0]?.sem_resultado ?? 0);
  const topQueries: [string, number][] = buscaRows
    .filter((r) => r.achou === true && r.termo)
    .map((r) => [r.termo!, Number(r.vezes)]);
  const topGaps: [string, number][] = buscaRows
    .filter((r) => r.achou === false && r.termo)
    .map((r) => [r.termo!, Number(r.vezes)]);

  // Chat: contagens e média de latência calculadas pelo Postgres.
  const chatRow = chat?.[0];
  const answers = Number(chatRow?.respostas ?? 0);
  const up = Number(chatRow?.uteis ?? 0);
  const down = Number(chatRow?.nao_uteis ?? 0);
  const refusals = Number(chatRow?.recusas ?? 0);
  const avgLatency = Number(chatRow?.latencia_media ?? 0);

  const fbRows = fb ?? [];
  const helpful = fbRows.filter((f) => f.helpful).length;
  const notHelpful = fbRows.filter((f) => !f.helpful).length;
  // Artigos com mais "não ajudou".
  const negByNode = topBy(fbRows, (f) => f.node_id, (f) => !f.helpful, 6);

  // Leitura (últimos 90 dias) — tudo já somado pelo Postgres.
  const leituraRows = leitura ?? [];
  const totalViews = Number(leituraRows[0]?.total_views ?? 0);
  /** Top já vem ordenado e COM título: não depende mais da lista de publicados. */
  const topViewed: [string, number, string][] = leituraRows
    .filter((r) => r.node_id)
    .map((r) => [r.node_id, Number(r.views), r.title]);
  const semVisitaTotal = Number(semVisitaRows?.[0]?.total_sem_visita ?? 0);
  const publicadosTotal = Number(semVisitaRows?.[0]?.total_publicados ?? 0);
  const artigosVistos = publicadosTotal - semVisitaTotal;
  const semVisita = (semVisitaRows ?? []).filter((r) => r.node_id);

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

  // O top de leitura já vem com título da RPC; só os agregados de FEEDBACK
  // (que ainda saem de uma amostra) precisam resolver nome por id.
  const idsComTitulo = [...new Set([...negByNode.map(([id]) => id), ...bestRated.map(([id]) => id)])];
  const titleById = new Map<string, string>(topViewed.map(([id, , titulo]) => [id, titulo]));
  const faltando = idsComTitulo.filter((id) => !titleById.has(id));
  if (faltando.length) {
    const { data: nodes } = await supabase.from("nodes").select("id, title").in("id", faltando);
    for (const n of nodes ?? []) titleById.set(n.id, n.title);
  }

  // Série do gráfico: já agregada por (dia, documentação) no banco. O cruzamento
  // com a lista de nós — que só existia para descobrir a documentação de cada
  // visita — deixou de ser necessário, e com ele foi embora a dependência de
  // `publicados` estar completo.
  const pontosGrafico = (serie ?? []).map((r) => ({
    day: r.day,
    spaceId: r.space_id,
    views: Number(r.views),
  }));

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

  const descricoes: Record<AbaDesempenho, string> = {
    busca: "O que os leitores procuram — e o que eles não encontram.",
    leitura: "O que está sendo lido, o que ninguém abre e o que as pessoas acharam útil.",
    chat: "Volume, latência e feedback das respostas do assistente.",
    qualidade: "Descrição, alt de imagem, títulos e links — o que a varredura encontrou.",
  };

  return (
    <PageShell
      // "Desempenho" é o nome no menu. O título dizia "Análises", e barra
      // lateral e cabeçalho contando histórias diferentes é justamente o que
      // impedia escrever um breadcrumb honesto.
      titulo="Desempenho"
      descricao={descricoes[aba]}
      largura="wide"
      className="space-y-8"
      abas={<AbasRota rota="/admin/analises" atual={aba} permissoes={permissoes} spaceId={spaceParaAbas} />}
    >

      {/* Busca */}
      {aba === "busca" && (
      <section>
        <h2 className={`mb-3 ${eyebrowLabel}`}>Busca</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Buscas registradas" value={totalSearches} />
          <StatCard label="Sem resultado" value={zeroCount} hint="lacunas na documentação" />
          <StatCard
            label="Taxa sem resultado"
            value={totalSearches ? `${Math.round((zeroCount / totalSearches) * 100)}%` : "—"}
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
      )}

      {/* Chat — o desempenho AGREGADO do assistente. A leitura caso a caso
          ("por que esta resposta saiu assim") mora em Assistente de IA ›
          Conversas, junto do rastreio. Número e caso são perguntas diferentes,
          feitas por pessoas diferentes. */}
      {aba === "chat" && (
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
      )}

      {/* Leitura */}
      {aba === "leitura" && (
      <section>
        <h2 className={`mb-3 ${eyebrowLabel}`}>Leitura (90 dias)</h2>
        <div className="mb-3">
          <ViewsChart pontos={pontosGrafico} spaces={spacesList ?? []} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Visualizações" value={totalViews} hint="1× por artigo por sessão" />
          <StatCard label="Artigos vistos" value={artigosVistos} />
          <StatCard
            label="Publicados sem visita"
            value={publicadosTotal ? semVisitaTotal : "—"}
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
        {semVisita.length > 0 && artigosVistos > 0 && (
          <div className="mt-3">
            <RankList
              title={`Publicados que ninguém abriu nos últimos 90 dias — ${semVisitaTotal} de ${publicadosTotal}`}
              rows={semVisita.map((n) => [n.title ?? "—", 0])}
              empty=""
              accent
            />
          </div>
        )}
      </section>
      )}

      {/* Feedback dos artigos — mesma aba que Leitura de propósito: "quantos
          abriram" e "quantos acharam útil" são a mesma pergunta em dois passos,
          e separá-las obrigava a comparar duas telas de cabeça. */}
      {aba === "leitura" && (
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
      )}

      {/* Qualidade/SEO (varredura do worker: painel Otimizar em massa) */}
      {aba === "qualidade" && (
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
      )}
    </PageShell>
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
