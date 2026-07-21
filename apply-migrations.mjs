// Aplica migrations via pg. A CLI do Supabase quebra com a senha deste projeto
// (tem @ e #), então o parse da URL é manual — mesma lógica de
// src/lib/jobs/db-config.ts, inlinada porque isto aqui é script descartável.
//
// Cada arquivo roda em SUA transação: falha reverte aquele arquivo e para tudo.
// Registra a versão em supabase_migrations.schema_migrations para que um
// `supabase db push` futuro não tente reaplicar.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import pg from "pg";

function parseDbConfig(url = process.env.SUPABASE_DB_URL) {
  if (!url) throw new Error("SUPABASE_DB_URL não definido.");
  const semScheme = url.replace(/^postgres(ql)?:\/\//, "");
  // Último `@`: a senha pode conter `@`, o host não. Igual a
  // src/lib/jobs/db-config.ts (que também cobre pooler e Postgres local).
  const at = semScheme.lastIndexOf("@");
  if (at === -1) throw new Error("SUPABASE_DB_URL sem credenciais (user:senha@host).");
  const userinfo = semScheme.slice(0, at);
  const resto = semScheme.slice(at + 1);
  const ci = userinfo.indexOf(":");
  const semQuery = resto.split("?")[0];
  const barra = semQuery.indexOf("/");
  const hostPort = barra === -1 ? semQuery : semQuery.slice(0, barra);
  const [host, port] = hostPort.split(":");
  const local = host === "localhost" || host === "127.0.0.1";
  return {
    host,
    port: port ? Number(port) : 5432,
    user: userinfo.slice(0, ci),
    password: userinfo.slice(ci + 1),
    database: (barra === -1 ? "" : semQuery.slice(barra + 1)) || "postgres",
    ...(local ? {} : { ssl: { rejectUnauthorized: false } }),
  };
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error("uso: node apply-migrations.mjs <arquivo.sql> [...]");
  process.exit(1);
}

const client = new pg.Client(parseDbConfig());
await client.connect();

for (const f of files) {
  const nome = basename(f);
  const versao = nome.split("_")[0];
  process.stdout.write(`\n── ${nome}\n`);
  try {
    await client.query("begin");
    await client.query(readFileSync(f, "utf8"));
    await client.query(
      `insert into supabase_migrations.schema_migrations (version, name)
       values ($1, $2) on conflict (version) do nothing`,
      [versao, nome.replace(/^\d+_/, "").replace(/\.sql$/, "")],
    );
    await client.query("commit");
    console.log("   aplicada");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.error(`   FALHOU (revertida): ${e.message}`);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("\nTodas aplicadas.");
