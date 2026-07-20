/**
 * Migração de conteúdo TipTap → blocos v2 (uma vez, re-executável, idempotente).
 *
 * Percorre `articles` e `snippets`, normaliza cada `content_json` para o formato
 * de blocos v2 e regrava. Para artigos, também recomputa `content_text`/`excerpt`
 * a partir dos blocos, mantendo a busca consistente. Documentos já em v2 são
 * pulados (idempotente).
 *
 * Uso:
 *   npm run migrate:blocks              # aplica
 *   npm run migrate:blocks -- --dry     # só relata, não grava
 *
 * Requer SUPABASE_DB_URL no .env.local. O parse é feito por parseDbConfig
 * (a senha do Supabase tem '@'/'#', que quebram new URL()).
 */
// @ts-expect-error — o pacote `pg` (transitivo via pg-boss) não traz tipos próprios.
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";
import { normalizeDoc } from "../src/lib/blocks/convert";
import { blocksToText } from "../src/lib/blocks/serialize";
import { isBlockDoc } from "../src/lib/blocks/schema";

const DRY = process.argv.includes("--dry");

async function main() {
  const client = new pg.Client(parseDbConfig());
  await client.connect();
  console.log(`Conectado. Modo: ${DRY ? "DRY-RUN (sem gravar)" : "APLICAR"}`);

  let articlesConverted = 0;
  let articlesSkipped = 0;
  let snippetsConverted = 0;
  let snippetsSkipped = 0;

  // ── Artigos ────────────────────────────────────────────────────────────────
  const arts = await client.query<{ id: string; content_json: unknown }>(
    "select id, content_json from public.articles",
  );
  for (const row of arts.rows) {
    if (isBlockDoc(row.content_json)) {
      articlesSkipped++;
      continue;
    }
    const doc = normalizeDoc(row.content_json);
    const text = blocksToText(doc.blocks);
    const excerpt = text.slice(0, 200);
    if (!DRY) {
      await client.query(
        "update public.articles set content_json = $1, content_text = $2, excerpt = $3 where id = $4",
        [JSON.stringify(doc), text, excerpt, row.id],
      );
    }
    articlesConverted++;
  }

  // ── Snippets ───────────────────────────────────────────────────────────────
  const snips = await client.query<{ id: string; content_json: unknown }>(
    "select id, content_json from public.snippets",
  );
  for (const row of snips.rows) {
    if (isBlockDoc(row.content_json)) {
      snippetsSkipped++;
      continue;
    }
    const doc = normalizeDoc(row.content_json);
    if (!DRY) {
      await client.query("update public.snippets set content_json = $1 where id = $2", [
        JSON.stringify(doc),
        row.id,
      ]);
    }
    snippetsConverted++;
  }

  await client.end();
  console.log("\nResumo:");
  console.log(`  Artigos:  ${articlesConverted} convertidos, ${articlesSkipped} já em v2`);
  console.log(`  Snippets: ${snippetsConverted} convertidos, ${snippetsSkipped} já em v2`);
  console.log(DRY ? "\nDRY-RUN — nada foi gravado." : "\nConcluído.");
}

main().catch((e) => {
  console.error("Falha na migração:", e);
  process.exit(1);
});
