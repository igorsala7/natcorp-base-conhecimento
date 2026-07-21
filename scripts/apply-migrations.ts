/**
 * Aplica arquivos de migration no banco, na ordem passada, cada um em
 * transação própria.
 *
 * Uso: npm run migrate:apply -- supabase/migrations/20260721120000_x.sql [...]
 *
 * Existe porque o CLI do Supabase tropeça em senhas com `@`/`#` na URL —
 * aqui o parse é o `parseDbConfig` do projeto (mesmo do worker), que aceita
 * pooler, Postgres local, IPv6 e querystring.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error — o pacote `pg` (transitivo via pg-boss) não traz tipos próprios.
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";

async function main() {
  const arquivos = process.argv.slice(2);
  if (arquivos.length === 0) {
    console.error("Passe ao menos um arquivo .sql de supabase/migrations/.");
    process.exit(1);
  }

  const client = new pg.Client(parseDbConfig());
  await client.connect();
  try {
    for (const arq of arquivos) {
      const sql = readFileSync(resolve(arq), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("commit");
        console.log(`OK  ${arq}`);
      } catch (e) {
        await client.query("rollback");
        console.error(`ERRO em ${arq}: ${(e as Error).message}`);
        process.exitCode = 1;
        break;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
