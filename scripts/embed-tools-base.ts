/**
 * Gera os embeddings de ferramenta POR BASE, enriquecidos com a ONTOLOGIA do cliente
 * (`ai_tool_base_embeddings`). É o que faz a IA achar a ferramenta quando o usuário
 * usa a palavra DELE — "célula" em vez de "centro de custo" — sem ninguém ter
 * digitado esse sinônimo no cadastro da tool.
 *
 * Idempotente: só refaz o que mudou (hash do texto-fonte). `--force` refaz tudo.
 *
 * Uso:
 *   npm run embed:tools:base                 # todas as bases ativas
 *   npm run embed:tools:base -- natcorp      # uma base
 *   npm run embed:tools:base -- --force
 */
import { WebSocket } from "undici";
(globalThis as { WebSocket?: unknown }).WebSocket ??= WebSocket;
import { createClient } from "@supabase/supabase-js";
import { syncToolBaseEmbeddings } from "../src/lib/integrations/tool-catalog";
import type { Database } from "../src/lib/database.types";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }
  const db = createClient<Database>(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const alvos = args.filter((a) => !a.startsWith("--"));

  const { data: bases } = await db.from("ai_bases").select("base_code, name").eq("active", true).order("name");
  const lista = (bases ?? []).filter((b) => !alvos.length || alvos.includes(b.base_code));
  if (!lista.length) {
    console.error(alvos.length ? `Base não encontrada: ${alvos.join(", ")}` : "Nenhuma base ativa.");
    process.exit(1);
  }

  for (const b of lista) {
    process.stdout.write(`\n${b.name} (${b.base_code})${force ? " [--force]" : ""}\n`);
    const r = await syncToolBaseEmbeddings(db, b.base_code, {
      force,
      onProgresso: (feito, total) => process.stdout.write(`\r  ${feito}/${total}`),
    });
    process.stdout.write(
      `\r  ${r.total} ferramenta(s): ${r.regerados} regerada(s), ${r.pulados} sem mudança, ` +
        `${r.semOntologia} sem termo de ontologia casado.\n`,
    );
  }
  console.log("\n✓ Pronto. O roteamento passa a usar o vetor da base (o global fica de reserva).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
