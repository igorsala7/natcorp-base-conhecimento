/**
 * PERCENTIS DE LATÊNCIA DO CHAT — read-only.
 *
 * `duracao_ms` está gravado em todo turno desde 02/08 e nunca virou nada além
 * de um número solto na tela de logs. Média não serve aqui: a distribuição de
 * latência tem cauda longa por construção (um turno que chama três ferramentas
 * demora múltiplos de um que responde da documentação), e a média fica presa
 * entre os dois sem descrever nenhum.
 *
 * Quem sente a lentidão é a cauda. p95 é o compromisso: alto o bastante para
 * pegar quem sofre, estável o bastante para não virar ruído de um outlier.
 *
 * Três recortes, porque respondem a perguntas diferentes:
 *
 *   GERAL     onde estamos hoje.
 *   POR DIA   a série. É aqui que uma regressão gradual aparece — a busca de
 *             documentação saiu de 1,0s (07/08) para 5,9s (23/08) sem ninguém
 *             mexer nela, acompanhando o crescimento do acervo. Um número único
 *             nunca teria mostrado isso.
 *   POR PASSO onde o tempo vai. É o que transforma "está lento" em uma linha de
 *             código.
 *
 *   npm run perf:latencia
 *   npm run perf:latencia -- --dias 7 --fonte ia
 */
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";

const arg = (nome: string, padrao = ""): string => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? String(process.argv[i + 1]) : padrao;
};

const DIAS = Number(arg("dias", "20"));
const FONTE = arg("fonte", "");

const ms = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`;
};
const col = (v: unknown, w: number): string => ms(v).padStart(w);

async function main() {
  const c = new pg.Client(parseDbConfig());
  await c.connect();
  await c.query("SET default_transaction_read_only = on");

  const janela = `t.created_at > now() - interval '${DIAS} days'`;
  const filtroFonte = FONTE ? `and t.fonte = '${FONTE.replace(/'/g, "''")}'` : "";
  const escopo = `${janela} ${filtroFonte}`;

  console.log(`\nLATÊNCIA DO CHAT · últimos ${DIAS} dias${FONTE ? ` · fonte "${FONTE}"` : ""}`);

  // ── GERAL ────────────────────────────────────────────────────────────────
  const geral = await c.query(`
    select count(*) as n,
           percentile_cont(0.50) within group (order by duracao_ms) as p50,
           percentile_cont(0.90) within group (order by duracao_ms) as p90,
           percentile_cont(0.95) within group (order by duracao_ms) as p95,
           percentile_cont(0.99) within group (order by duracao_ms) as p99,
           avg(duracao_ms) as media, max(duracao_ms) as pior
      from ai_chat_traces t
     where ${escopo} and t.duracao_ms is not null`);
  const g = geral.rows[0];
  if (!g || Number(g.n) === 0) {
    console.log("\n  Nenhum turno na janela.\n");
    await c.end();
    return;
  }
  console.log(`\n── GERAL (${g.n} turnos) `.padEnd(64, "─"));
  console.log(`  p50 ${col(g.p50, 7)}   p90 ${col(g.p90, 7)}   p95 ${col(g.p95, 7)}   p99 ${col(g.p99, 7)}`);
  console.log(`  média ${ms(g.media)}   pior ${ms(g.pior)}`);
  // A média mente quando fica longe da mediana — é o sinal da cauda longa.
  const desvio = Number(g.media) / Number(g.p50);
  if (Number.isFinite(desvio) && desvio > 1.3) {
    console.log(`  ⚠ média ${desvio.toFixed(1)}× a mediana: cauda longa. Use p95, não a média.`);
  }

  // ── POR DIA ──────────────────────────────────────────────────────────────
  const dia = await c.query(`
    select t.created_at::date as d, count(*) as n,
           percentile_cont(0.50) within group (order by duracao_ms) as p50,
           percentile_cont(0.95) within group (order by duracao_ms) as p95
      from ai_chat_traces t
     where ${escopo} and t.duracao_ms is not null
     group by 1 having count(*) >= 5 order by 1`);
  if (dia.rows.length > 1) {
    console.log(`\n── POR DIA (dias com 5+ turnos) `.padEnd(64, "─"));
    const maxP95 = Math.max(...dia.rows.map((r) => Number(r.p95) || 0)) || 1;
    for (const r of dia.rows) {
      const barra = "█".repeat(Math.max(1, Math.round((Number(r.p95) / maxP95) * 28)));
      console.log(
        `  ${new Date(r.d).toISOString().slice(5, 10)}  n=${String(r.n).padStart(3)}` +
          `  p50 ${col(r.p50, 7)}  p95 ${col(r.p95, 7)}  ${barra}`,
      );
    }
  }

  // ── POR PASSO ────────────────────────────────────────────────────────────
  /**
   * O passo é registrado DEPOIS que o trabalho dele termina (conferido em
   * route.ts:2217-2219: `await _ragPromise` e só então `passo("rag")`). Logo o
   * tempo de um passo é `ms - ms_do_anterior`, atribuído ao passo ATUAL — usar
   * o seguinte deslocaria toda a medição em uma posição e culparia sempre o
   * vizinho errado.
   *
   * CAVEAT que muda a leitura: trabalho disparado em paralelo e aguardado
   * depois (o RAG é assim) aparece aqui como TEMPO BLOQUEANTE, não como tempo
   * total de trabalho. Para decidir o que otimizar isso é o certo — bloqueio é
   * o que o usuário sente —, mas não leia "rag = 300ms" como "o RAG custa
   * 300ms".
   */
  const passo = await c.query(`
    with p as (
      select t.id, e.ordinality as ord,
             e.value->>'passo' as passo,
             (e.value->>'ms')::numeric as marca
        from ai_chat_traces t,
             jsonb_array_elements(t.passos) with ordinality e(value, ordinality)
       where ${escopo}
    ),
    delta as (
      select passo,
             marca - coalesce(lag(marca) over (partition by id order by ord), 0) as dur
        from p
    )
    select passo, count(*) as n,
           percentile_cont(0.50) within group (order by dur) as p50,
           percentile_cont(0.95) within group (order by dur) as p95,
           sum(dur) as total
      from delta
     where dur >= 0
     group by passo
     order by total desc nulls last
     limit 14`);
  if (passo.rows.length) {
    const somaTudo = passo.rows.reduce((a, r) => a + Number(r.total || 0), 0) || 1;
    console.log(`\n── POR PASSO (tempo BLOQUEANTE, maior soma primeiro) `.padEnd(64, "─"));
    console.log(`  ${"passo".padEnd(26)} ${"n".padStart(5)} ${"p50".padStart(8)} ${"p95".padStart(8)}  % do total`);
    for (const r of passo.rows) {
      const share = (Number(r.total || 0) / somaTudo) * 100;
      console.log(
        `  ${String(r.passo).slice(0, 26).padEnd(26)} ${String(r.n).padStart(5)}` +
          ` ${col(r.p50, 8)} ${col(r.p95, 8)}  ${share.toFixed(1).padStart(5)}%`,
      );
    }

    /**
     * GUARDA CONTRA O PRÓPRIO INSTRUMENTO.
     *
     * Até 24/08 nenhum passo era registrado quando a geração do modelo
     * terminava, então esse tempo escorria para o passo seguinte — quase sempre
     * `dataset:registro`, que passava a "responder" por 30% da latência sem
     * gastar nada. O `onFinish` do streamText agora fecha esse balde
     * (`modelo:fim`), mas turnos ANTIGOS não têm o passo e continuam mentindo.
     *
     * Enquanto a janela pegar turnos dos dois períodos, o aviso fica: é mais
     * barato avisar do que alguém otimizar um `insert` de diagnóstico.
     */
    const temModeloFim = passo.rows.some((r) => r.passo === "modelo:fim");
    const registroPesado = passo.rows.some(
      (r) => r.passo === "dataset:registro" && Number(r.total || 0) / somaTudo > 0.1,
    );
    if (registroPesado && !temModeloFim) {
      console.log(
        `\n  ⚠ 'dataset:registro' aqui NÃO é custo dele: é a geração do modelo\n` +
          `    caindo no passo seguinte. Turnos anteriores a 24/08 não têm o passo\n` +
          `    'modelo:fim'. Reduza a janela (--dias) até o aviso sumir.`,
      );
    }
  }

  console.log();
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
