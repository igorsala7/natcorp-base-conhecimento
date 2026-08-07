/**
 * Backfill dos embeddings do CATÁLOGO de tools (roteamento semântico de fonte).
 * Gera `ai_tools.embedding` para as tools que ainda não têm (ou todas, com --all).
 *
 * Uso:
 *   npm run embed:tools           # só as que faltam
 *   npm run embed:tools -- --all  # recalcula todas
 *
 * Requer NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY e o provedor de
 * embedding configurado (Sistema → IA, ou EMBEDDING_API_KEY). Roda com a condição
 * `react-server` para neutralizar o guard `server-only` do config de IA.
 */
import { WebSocket } from "undici";
// supabase-js constrói o RealtimeClient no construtor e exige WebSocket global —
// o Next fornece; num script Node 20, não há. Polyfill (não usamos Realtime aqui).
(globalThis as { WebSocket?: unknown }).WebSocket ??= WebSocket;
import { createClient } from "@supabase/supabase-js";
import { syncToolEmbedding } from "../src/lib/integrations/tool-catalog";
import type { Database } from "../src/lib/database.types";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }
  const db = createClient<Database>(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const todas = process.argv.includes("--all");

  const { data: tools, error } = await db.from("ai_tools").select("id, key, name, description, embedding, search_terms, response_hint");
  if (error) {
    console.error("Falha ao ler ai_tools:", error.message);
    process.exit(1);
  }
  const alvo = (tools ?? []).filter((t) => todas || t.embedding == null);
  console.log(`Tools: ${tools?.length ?? 0} | a embeddar: ${alvo.length}${todas ? " (--all)" : ""}`);
  if (!alvo.length) {
    console.log("Nada a fazer.");
    return;
  }
  // Chaves de TODAS as tools: uma frase que cita outra ferramenta é orquestração e
  // sai do vetor — era o que fazia "recibo de pagamento" vencer "histórico financeiro".
  const todasChaves = new Set((tools ?? []).map((t) => String(t.key).toLowerCase()));
  let ok = 0;
  for (const t of alvo) {
    const outras = new Set(todasChaves);
    outras.delete(String(t.key).toLowerCase());
    await syncToolEmbedding(db, t.id, t.name, t.description, { searchTerms: t.search_terms, responseHint: t.response_hint, chavesDeOutras: outras });
    ok++;
    process.stdout.write(`\r  ${ok}/${alvo.length}`);
  }
  console.log(`\n✓ ${ok} tool(s) com embedding atualizado.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
