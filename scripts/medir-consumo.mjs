/**
 * CONSUMO DE TOKENS POR TIPO DE USO.
 *
 * Lê `ai_chat_traces` e agrupa os turnos pelo que a pergunta EXIGIU, não pelo
 * texto dela: quem gera arquivo paga o passo do gerador, quem consulta API paga
 * o resultado da tool reenviado a cada passo, e quem só lê documentação paga o
 * RAG. Misturar os três numa média só esconde exatamente o que se quer achar.
 *
 * Uso:  node scripts/medir-consumo.mjs [horas] [--desde ISO]
 */
import pg from "pg";

const args = process.argv.slice(2);
const horas = Number(args.find((a) => /^\d+$/.test(a)) ?? 24);
const desdeIdx = args.indexOf("--desde");
const desde = desdeIdx >= 0 ? args[desdeIdx + 1] : null;

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(
  desde
    ? `select * from ai_chat_traces where created_at > $1::timestamptz order by created_at`
    : `select * from ai_chat_traces where created_at > now() - ($1 || ' hours')::interval order by created_at`,
  [desde ?? String(horas)],
);

const passo = (t, nome) => (t.passos ?? []).find((p) => p.passo === nome)?.info ?? null;
const todos = (t, nome) => (t.passos ?? []).filter((p) => p.passo === nome).map((p) => p.info);

/** O tipo é o TRABALHO que o turno deu, em ordem de custo. */
function tipoDeUso(t) {
  const r = passo(t, "resposta") ?? {};
  if ((r.arquivos ?? 0) > 0) return "Relatório / arquivo";
  if ((r.graficos ?? 0) > 0) return "Gráfico";
  if (todos(t, "tool_call").some((x) => x?.familia === "integracao")) return "Consulta a sistema (API)";
  if (passo(t, "coleta")?.deve_coletar) return "Análise de relatório da tela";
  if ((r.acoes_tela ?? []).length) return "Ação na tela";
  if (String(t.desfecho ?? "").startsWith("clarify")) return "Pergunta de esclarecimento";
  return "Documentação (RAG)";
}

const num = (n) => (n == null ? "—" : Math.round(n).toLocaleString("pt-BR"));
const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");
const mediana = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
const p90 = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.9)] : 0);

const grupos = new Map();
for (const t of rows) {
  const tipo = tipoDeUso(t);
  if (!grupos.has(tipo)) grupos.set(tipo, []);
  grupos.get(tipo).push(t);
}

console.log(`\nturnos: ${rows.length}  ·  janela: ${desde ? "desde " + desde : horas + "h"}\n`);
const linhas = [];
let totalGeral = 0;
for (const [tipo, ts] of [...grupos.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const tok = ts.map((t) => passo(t, "resposta")?.tokens_total ?? 0).filter(Boolean);
  const cr = ts.reduce((s, t) => s + (passo(t, "resposta")?.cache_read ?? 0), 0);
  const soma = tok.reduce((s, x) => s + x, 0);
  totalGeral += soma;
  const passos = ts.map((t) => passo(t, "resposta")?.passos_usados ?? 0).filter(Boolean);
  const bytes = ts.flatMap((t) => todos(t, "tool_result").map((x) => x?.bytes ?? 0));
  linhas.push({
    tipo,
    n: ts.length,
    "tokens medianos": num(mediana(tok)),
    "tokens p90": num(p90(tok)),
    "total": num(soma),
    "cache": pct(cr, soma + cr),
    "passos": mediana(passos) || "—",
    "maior tool (bytes)": bytes.length ? num(Math.max(...bytes)) : "—",
    "s medianos": ts.length ? Math.round(mediana(ts.map((t) => t.duracao_ms ?? 0)) / 1000) : "—",
  });
}
console.table(linhas);
console.log(`total de tokens na janela: ${num(totalGeral)}`);
const semResp = rows.filter((t) => !passo(t, "resposta")).length;
if (semResp) console.log(`(${semResp} turno(s) sem passo "resposta" — clarify, erro ou coleta)`);
await c.end();
