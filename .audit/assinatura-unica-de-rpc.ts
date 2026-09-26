/**
 * TODA RPC QUE `src/` CHAMA TEM DE TER EXATAMENTE UMA ASSINATURA.
 *
 * ── O defeito que este script existe para pegar ─────────────────────────────
 * `create or replace function` com uma lista de parâmetros DIFERENTE não
 * substitui a função: para o Postgres, assinatura diferente é função diferente,
 * e o resultado são DUAS funções com o mesmo nome. A partir daí, toda chamada
 * `supabase.rpc("nome", { ... })` fica ambígua — o PostgREST não nomeia todos os
 * parâmetros — e o banco levanta:
 *
 *   ERROR: function public.hybrid_search_scoped(p_query => unknown,
 *   p_node_ids => unknown) is not unique
 *
 * O que torna isso caro não é o erro, é onde ele NÃO aparece: as chamadas de
 * `src/lib/ai/rag.ts` e de `src/app/(portal)/actions.ts` desestruturam só
 * `{ data }`. Sem ninguém lendo `error`, a busca devolve VAZIO e o chat responde
 * "não encontrei" com a documentação inteira de pé no banco. Não há log, não há
 * 500, não há nada para investigar.
 *
 * Este repositório não tem ledger de migrations, então reaplicar um arquivo à
 * mão é operação NORMAL — e existem oito arquivos antigos que, reaplicados
 * sozinhos, criam exatamente essa duplicata (cada um tem cabeçalho de aviso
 * desde a tarefa 12). Cabeçalho avisa quem lê o arquivo; este script pega quem
 * não leu.
 *
 * ── Por que aqui e não numa assertiva de migration ──────────────────────────
 * A assertiva no fim de `20260925120000` só roda quando ALGUÉM APLICA aquele
 * arquivo. O defeito nasce ao aplicar OUTRO. Este script não depende de aplicar
 * migration nenhuma: ele varre as chamadas reais do código e pergunta ao banco.
 * E vale para as 61 RPCs, não só para as duas da busca — a classe volta a cada
 * mudança de assinatura, em qualquer função.
 *
 * ── Contagem diferente de 1 falha, inclusive ZERO ───────────────────────────
 * Zero assinaturas é o MESMO sintoma: `supabase.rpc` de função que não existe
 * responde com erro que ninguém lê, e a tela mostra vazio. Medido em 25/09: as
 * 61 RPCs chamadas por `src/` têm exatamente uma assinatura cada, então exigir
 * `= 1` não custa nada hoje e trava as duas direções.
 *
 *   npm run verificar:rpc
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
// Relativo e sem extensão, como `.audit/sql.ts` já faz: o alias `@/` do
// tsconfig não é resolvido por scripts rodados fora do Next.
import { parseDbConfig } from "../src/lib/jobs/db-config";

/** `.ts`/`.tsx` de `src/`, recursivo. */
function arquivosDeFonte(dir: string): string[] {
  const saida: string[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules" || entrada.name === ".next") continue;
      saida.push(...arquivosDeFonte(caminho));
    } else if (entrada.name.endsWith(".ts") || entrada.name.endsWith(".tsx")) {
      saida.push(caminho);
    }
  }
  return saida;
}

/**
 * Aceita aspas simples e backtick além de duplas: hoje as 61 chamadas usam
 * aspas duplas, e uma varredura que só enxerga um estilo de citação vira um
 * portão que passa a não medir no dia em que alguém escrever diferente.
 */
const LITERAL = /\.rpc\(\s*(["'`])([A-Za-z0-9_]+)\1/g;
/**
 * Nome que NÃO é literal (`db.rpc(nome, …)`). O script não consegue resolver, e
 * ficar calado produziria a pior versão de um portão: verde porque não olhou.
 */
const DINAMICO = /\.rpc\(\s*(?!["'`])[A-Za-z_$]/g;

const nomes = new Set<string>();
const dinamicos: string[] = [];

for (const arquivo of arquivosDeFonte("src")) {
  const texto = readFileSync(arquivo, "utf8");
  for (const m of texto.matchAll(LITERAL)) nomes.add(m[2]!);
  if (DINAMICO.test(texto)) dinamicos.push(arquivo);
  DINAMICO.lastIndex = 0;
}

if (nomes.size === 0) {
  console.error(
    "Nenhuma chamada `.rpc(\"nome\")` encontrada em src/. Ou a varredura quebrou, ou o padrão de chamada mudou — nos dois casos este portão deixou de medir.",
  );
  process.exit(1);
}

const cliente = new pg.Client(parseDbConfig());
await cliente.connect();
await cliente.query("SET default_transaction_read_only = on");

const { rows } = await cliente.query<{ nome: string; assinaturas: string; args: string | null }>(
  `select a.nome,
          (select count(*) from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = a.nome) as assinaturas,
          (select string_agg('(' || pg_get_function_identity_arguments(p.oid) || ')', ' | '
                             order by pg_get_function_identity_arguments(p.oid))
             from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = a.nome) as args
     from unnest($1::text[]) as a(nome)
    order by a.nome`,
  [[...nomes].sort()],
);
await cliente.end();

const problemas = rows.filter((r) => Number(r.assinaturas) !== 1);

for (const arquivo of dinamicos) {
  console.warn(
    `AVISO  ${arquivo} chama .rpc() com nome que não é literal — esta varredura não o cobre.`,
  );
}

if (problemas.length > 0) {
  console.error("\nRPC com número de assinaturas diferente de 1 (o app chama e o banco não resolve):\n");
  for (const p of problemas) {
    const n = Number(p.assinaturas);
    console.error(
      n === 0
        ? `  ${p.nome}: ZERO assinaturas em public. A chamada responde com erro que ninguém lê e a tela mostra vazio.`
        : `  ${p.nome}: ${n} assinaturas — ${p.args}\n     Toda chamada fica ambígua ("function ... is not unique") e a busca devolve VAZIO em silêncio.`,
    );
  }
  console.error(
    "\nProvável causa: alguma migration antiga foi reaplicada à mão. Veja o cabeçalho dos oito arquivos superados em supabase/migrations/: derrube a assinatura antiga que o arquivo reaplicado criou e reaplique 20260926120000_funcoes_de_escopo_canonicas.sql, que é o sítio único do corpo vivo desde a tarefa 15.",
  );
  process.exit(1);
}

console.log(
  `Assinatura única: as ${rows.length} RPCs chamadas por src/ têm exatamente uma assinatura em public.`,
);
