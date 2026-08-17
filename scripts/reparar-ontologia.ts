/**
 * REPARA A ONTOLOGIA POLUÍDA PELA RODADA DE 16/08.
 *
 *   npx tsx --tsconfig worker/tsconfig.json scripts/reparar-ontologia.ts <spaceId>            # ENSAIO
 *   npx tsx --tsconfig worker/tsconfig.json scripts/reparar-ontologia.ts <spaceId> --aplicar  # escreve
 *
 * Três defeitos criaram o estrago (commit `bc0a890`); o código já está
 * consertado, mas código consertado não desfaz linha gravada. Este script desfaz.
 *
 * ── O que ele repara ────────────────────────────────────────────────────────
 *
 * A. TERMOS ÓRFÃOS DA RENOMEAÇÃO. Quando a IA devolvia "Adiantamento Salarial"
 *    para "Adto salarial", a mesclagem procurava pelo nome NOVO, não achava, e
 *    criava um segundo termo — deixando o primeiro existindo como termo E como
 *    sinônimo do segundo. Aqui o antigo é FUNDIDO no novo: os sinônimos migram e
 *    a linha duplicada sai.
 *
 * B. SINÔNIMOS DE COLUNA SEM LASTRO. A IA recebia os nomes de coluna junto dos
 *    termos e os cruzava entre as 60 linhas do lote, colando
 *    `INCID_13_ADTO_RAIS` em "Adto 13". Sai todo alias em forma de coluna que o
 *    DICIONÁRIO não confirma — aqui a verdade é o dicionário, não a IA.
 *
 * ── Duas decisões que valem explicar ────────────────────────────────────────
 *
 * SQL direto (`pg`) e não `supabase-js`: o cliente puxa realtime, que exige Node
 * 22. E para reparo de dados o SQL é a ferramenta certa — o que se quer é
 * exatamente um conjunto, não uma sequência de chamadas REST.
 *
 * ENSAIO por padrão: apagar vocabulário é irreversível e silencioso. Ninguém
 * percebe um sinônimo que sumiu; percebe a busca que parou de achar, semanas
 * depois. Sem `--aplicar` o script conta, mostra amostra e não escreve.
 */

import pg from "pg";
import { config } from "dotenv";
import { ehExpansaoDe, aliasSemLastro } from "../src/lib/ai/ontology-reparo";

config({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");
const SPACE = process.argv[2];

if (!SPACE || SPACE.startsWith("--")) {
  console.error("uso: reparar-ontologia.ts <spaceId> [--aplicar]");
  process.exit(1);
}

/**
 * O laço que decide se um sinônimo de coluna tem lastro.
 *
 * `X` (que parece nome de coluna) só pertence ao termo T se o DICIONÁRIO tem uma
 * coluna X cujo rótulo é T — ou é um dos sinônimos de T.
 *
 * A segunda metade não é detalhe: depois de a IA expandir, o termo passa a ser
 * "Adiantamento Salarial" e o rótulo continua "Adto salarial". Sem olhar os
 * sinônimos, o reparo apagaria justamente os vínculos que o conserto criou.
 */
const COM_LASTRO = `
  exists (
    select 1 from data_dictionary d
    where upper(d.db_column) = upper(a.alias)
      and d.label is not null
      and (
        lower(d.label) = t.term_norm
        or exists (select 1 from ontology_aliases o where o.term_id = t.id and o.alias_norm = lower(d.label))
      )
  )`;

/** Alias que tem cara de identificador de banco: MAIÚSCULA, 3+ chars. */
const PARECE_COLUNA = `a.alias ~ '^[A-Z][A-Z0-9_]{2,}$'`;

async function main() {
  const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
  await c.connect();
  console.log(`\n${APLICAR ? "APLICANDO" : "ENSAIO (nada será escrito)"} — espaço ${SPACE}\n`);

  const total = await c.query(
    `select (select count(*) from ontology_terms where space_id = $1) termos,
            (select count(*) from ontology_aliases a join ontology_terms t on t.id = a.term_id
             where t.space_id = $1) sinonimos`,
    [SPACE],
  );
  console.log(`  ${total.rows[0].termos} termos · ${total.rows[0].sinonimos} sinônimos`);

  // ── A. termos órfãos ──────────────────────────────────────────────────────
  //
  // `antigo.id < novo.id` corta o par recíproco: a IA às vezes gerou A→B e B→A,
  // e fundir os dois lados apagaria o conceito inteiro. Com a desigualdade só um
  // sentido sobrevive, sempre o mesmo, e o resultado é reproduzível.
  const FUSOES = `
    select distinct on (antigo.id) antigo.id antigo_id, antigo.term antigo_term,
           novo.id novo_id, novo.term novo_term
    from ontology_aliases a
    join ontology_terms novo   on novo.id = a.term_id and novo.space_id = $1
    join ontology_terms antigo on antigo.term_norm = a.alias_norm and antigo.space_id = $1
    where antigo.id <> novo.id and antigo.id < novo.id
    order by antigo.id, novo.id`;

  // O SQL levanta CANDIDATOS; quem decide é `ehExpansaoDe`, que tem teste.
  // Confiar no "estão ligados" do banco seria usar o dado poluído como prova —
  // foi assim que a primeira versão propôs fundir "Desconto PLR Folha" em
  // "Adiantamento de PLR".
  const candidatos = (await c.query(FUSOES, [SPACE])).rows;
  const fusoes = candidatos.filter((f) => ehExpansaoDe(f.antigo_term, f.novo_term));
  console.log(`\nA. TERMOS ÓRFÃOS DA RENOMEAÇÃO: ${fusoes.length} para fundir`);
  console.log(`   (de ${candidatos.length} candidatos; ${candidatos.length - fusoes.length} recusados por não serem o mesmo conceito)`);
  for (const f of fusoes.slice(0, 6)) console.log(`     "${f.antigo_term}"  →  "${f.novo_term}"`);
  for (const f of candidatos.filter((x) => !ehExpansaoDe(x.antigo_term, x.novo_term)).slice(0, 4))
    console.log(`     recusado: "${f.antigo_term}"  ✗  "${f.novo_term}"`);

  // ── B. sinônimos sem lastro ───────────────────────────────────────────────
  const SEM_LASTRO = `
    from ontology_aliases a join ontology_terms t on t.id = a.term_id
    where t.space_id = $1 and ${PARECE_COLUNA} and not ${COM_LASTRO}`;

  const candAlias = (await c.query(
    `select a.id, a.alias, t.id term_id, t.term,
            coalesce((select array_agg(o.alias) from ontology_aliases o where o.term_id = t.id), '{}') sinonimos,
            coalesce((select array_agg(distinct d.label) from data_dictionary d
                      where upper(d.db_column) = upper(a.alias) and d.label is not null), '{}') rotulos
     from ontology_aliases a join ontology_terms t on t.id = a.term_id
     where t.space_id = $1 and ${PARECE_COLUNA}`,
    [SPACE],
  )).rows as { id: string; alias: string; term: string; sinonimos: string[]; rotulos: string[] }[];

  const semLastro = candAlias.filter((r) =>
    aliasSemLastro({ alias: r.alias, termo: r.term, sinonimosDoTermo: r.sinonimos, rotulosDaColuna: r.rotulos }),
  );
  console.log(`\nB. SINÔNIMOS DE COLUNA SEM LASTRO: ${semLastro.length} para remover`);
  for (const r of semLastro.slice(0, 6)) console.log(`     "${r.term}"  ✗  ${r.alias}`);
  console.log(`\n   (${candAlias.length - semLastro.length} de ${candAlias.length} sinônimos em forma de coluna PRESERVADOS)`);

  if (!APLICAR) {
    console.log("\nEnsaio. Rode com --aplicar para escrever.\n");
    await c.end();
    return;
  }

  // ── escrita, numa transação ───────────────────────────────────────────────
  // Tudo ou nada: um reparo aplicado pela metade deixa a ontologia num estado
  // que nem o script nem a pessoa sabem descrever.
  await c.query("begin");
  try {
    // Os sinônimos do antigo migram ANTES de ele sair — o `on delete cascade` os
    // levaria junto, e o conserto tiraria vocabulário em vez de consertar.
    const antigos = fusoes.map((f) => f.antigo_id);
    const novos = fusoes.map((f) => f.novo_id);
    const mig = await c.query(
      `insert into ontology_aliases (term_id, alias, alias_norm, source)
       select p.novo_id, a.alias, a.alias_norm, 'ia'
       from unnest($1::uuid[], $2::uuid[]) as p(antigo_id, novo_id)
       join ontology_aliases a on a.term_id = p.antigo_id
       join ontology_terms novo on novo.id = p.novo_id
       where a.alias_norm <> novo.term_norm
       on conflict (term_id, alias_norm) do nothing`,
      [antigos, novos],
    );
    const del = await c.query(`delete from ontology_terms where id = any($1::uuid[])`, [antigos]);
    const rem = await c.query(`delete from ontology_aliases where id = any($1::uuid[])`, [semLastro.map((r) => r.id)]);
    await c.query("commit");
    console.log(`\n  fundidos ${del.rowCount} termos (${mig.rowCount} sinônimos migrados)`);
    console.log(`  removidos ${rem.rowCount} sinônimos sem lastro\n`);
  } catch (e) {
    await c.query("rollback");
    console.error("\n  REVERTIDO:", e instanceof Error ? e.message : e, "\n");
    process.exitCode = 1;
  }
  await c.end();
}

void main();
