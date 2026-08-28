/**
 * Executor de SELECT em SOMENTE LEITURA para a auditoria do RAG.
 * Usa o `parseDbConfig` do projeto (a senha tem `@`/`#`, que quebra `new URL`).
 *
 *   SQLFILE=/caminho/x.sql npx tsx --env-file=.env.local .audit/sql.ts
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";

const sql = process.env.SQLFILE ? readFileSync(process.env.SQLFILE, "utf8") : process.argv.slice(2).join(" ");
const c = new pg.Client(parseDbConfig());
await c.connect();
await c.query("SET default_transaction_read_only = on");
const r = await c.query(sql);
console.log(JSON.stringify(r.rows, null, 1).slice(0, 500000));
await c.end();
