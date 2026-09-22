/**
 * Cliente de banco para os scripts de auditoria em `.mjs`.
 *
 * ── Por que este arquivo existe ─────────────────────────────────────────────
 * Onze scripts daqui montavam o cliente assim:
 *
 *     new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ... })
 *
 * e os onze pararam de rodar. A senha do banco tem `@` e `#`; o `#` não
 * codificado corta a URL no fragmento e o `new URL()` do `pg-connection-string`
 * estoura com `ERR_INVALID_URL` — antes de tentar conectar, sem dizer que o
 * problema é a senha. O projeto já resolve isso em `src/lib/jobs/db-config.ts`
 * (`parseDbConfig`), usado por `.audit/sql.ts` e pelo worker.
 *
 * Um `.mjs` consegue importar aquele `.ts` porque estes scripts rodam sob
 * `tsx`, que resolve os dois. Então em vez de duplicar o parse — que é
 * exatamente o tipo de cópia que diverge sem ninguém perceber — o helper
 * reexporta a função do projeto.
 *
 *   import { abrir } from "./db.mjs";
 *   const c = await abrir();          // já conectado e em SOMENTE LEITURA
 *   const { rows } = await c.query("select 1");
 *   await c.end();
 *
 * `abrir()` já aplica `default_transaction_read_only`, como `sql.ts`: script de
 * auditoria lê o banco de PRODUÇÃO (não há banco de dev separado neste
 * projeto), e um `update` esquecido num script de medição não tem desfazer.
 */
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config.ts";

/** Cliente conectado e travado em leitura. Lembre do `await c.end()`. */
export async function abrir() {
  const c = new pg.Client(parseDbConfig());
  await c.connect();
  await c.query("SET default_transaction_read_only = on");
  return c;
}

/** Abre, roda, fecha — para o caso comum de uma consulta só. */
export async function comBanco(fn) {
  const c = await abrir();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}
