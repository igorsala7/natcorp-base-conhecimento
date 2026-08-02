/**
 * Cadastra (idempotente) a tool `consulta_ir` na base natcorp — o endpoint ORDS
 * que devolve 100% das linhas de um Interactive Report. É USO INTERNO do widget
 * (route /api/v1/report-data), NÃO uma ferramenta do modelo: por isso `active=false`
 * (o chat filtra tools inativas), mas o vínculo com a base fica `enabled=true` para
 * o `loadBaseTool` resolvê-la.
 *
 * Rodar: npm run tool:consulta-ir   (tsx --env-file=.env.local)
 */
import ws from "ws";
// supabase-js recente exige WebSocket nativo (Node 22+); em Node 20, polyfill.
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../src/lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}
const db = createClient<Database>(url, serviceRole, { auth: { persistSession: false } });

const BASE_CODE = "natcorp";
const TOOL_KEY = "consulta_ir";
const PATH_TEMPLATE = "chatbot/dados/v1/consulta_ir";

async function main() {
  const { data: base, error: eb } = await db
    .from("ai_bases")
    .select("id, name, base_url, credential_id")
    .ilike("base_code", BASE_CODE)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (eb) throw eb;
  if (!base) throw new Error(`Base "${BASE_CODE}" não encontrada (ou inativa).`);
  console.log(`Base: ${base.name} (${base.id})`);
  console.log(`  base_url: ${base.base_url ?? "(vazio)"}  credential_id: ${base.credential_id ?? "(vazio)"}`);
  if (!base.base_url) console.warn("  ⚠️ base_url vazio — cadastre a URL base da natcorp em Bases/Clientes.");
  if (!base.credential_id) console.warn("  ⚠️ credencial vazia — cadastre a credencial OAuth2 da natcorp.");

  const { data: tool, error: et } = await db
    .from("ai_tools")
    .upsert(
      {
        key: TOOL_KEY,
        name: "Consulta de Interactive Report (ORDS)",
        description: "Uso interno do widget: devolve 100% das linhas do IR (apex_ir.get_report). Não é chamada pelo modelo.",
        method: "POST",
        path_template: PATH_TEMPLATE,
        auth_type: "oauth2",
        params: [] as unknown as Json,
        endpoint_kind: "base", // herda base_url + credencial da base
        active: false, // invisível ao modelo do chat; o route a resolve mesmo assim
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    )
    .select("id")
    .single();
  if (et) throw et;
  console.log(`Tool "${TOOL_KEY}" ......... ok (${tool.id})  path=${PATH_TEMPLATE}  method=POST  active=false`);

  const { error: el } = await db
    .from("ai_base_tools")
    .upsert({ base_id: base.id, tool_id: tool.id, enabled: true }, { onConflict: "base_id,tool_id" });
  if (el) throw el;
  console.log(`Vínculo base↔tool ...... ok (enabled=true)`);
  console.log("\n✅ Pronto. O route /api/v1/report-data já resolve o caminho por esta tool.");
}

main().catch((e) => {
  console.error("Falhou:", e?.message ?? e);
  process.exit(1);
});
