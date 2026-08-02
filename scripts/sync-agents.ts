/**
 * Sincroniza SÓ os agentes (ai_agents) e seus vínculos com tools (ai_agent_tools)
 * a partir de NATCORP_AGENTS — idempotente. Diferente do seed completo, NÃO toca em
 * ai_base_tools (preserva as allowlists de portal/perfil/empresa configuradas).
 *
 *   npm run sync:agents
 *
 * Requer NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no .env.local.
 */
import { WebSocket } from "undici";
(globalThis as { WebSocket?: unknown }).WebSocket ??= WebSocket;
import { createClient } from "@supabase/supabase-js";
import { NATCORP_AGENTS } from "./natcorp-tools";
import type { Database } from "../src/lib/database.types";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }
  const db = createClient<Database>(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

  // Ids das tools por chave (todas as chaves usadas pelos agentes).
  const allKeys = [...new Set(NATCORP_AGENTS.flatMap((a) => a.toolKeys))];
  const { data: tools, error: te } = await db.from("ai_tools").select("id, key").in("key", allKeys);
  if (te) {
    console.error("Falha ao ler ai_tools:", te.message);
    process.exit(1);
  }
  const idByKey = new Map((tools ?? []).map((t) => [t.key, t.id]));

  for (const a of NATCORP_AGENTS) {
    const { data: agent, error } = await db
      .from("ai_agents")
      .upsert(
        {
          key: a.key,
          name: a.name,
          description: a.description,
          system_prompt: a.system_prompt,
          requires_perfil: a.requires_perfil,
          priority: a.priority ?? 0,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      )
      .select("id")
      .single();
    if (error || !agent) {
      console.error(`✗ agente ${a.key}: ${error?.message ?? "sem retorno"}`);
      process.exit(1);
    }
    await db.from("ai_agent_tools").delete().eq("agent_id", agent.id);
    const rows = a.toolKeys
      .map((k) => idByKey.get(k))
      .filter((id): id is string => Boolean(id))
      .map((tool_id) => ({ agent_id: agent.id, tool_id }));
    if (rows.length) {
      const { error: le } = await db.from("ai_agent_tools").insert(rows);
      if (le) {
        console.error(`✗ vínculos ${a.key}: ${le.message}`);
        process.exit(1);
      }
    }
    console.log(`  ${a.key}: ${rows.length} tool(s), prio=${a.priority ?? 0}${a.requires_perfil ? `, perfil=${a.requires_perfil}` : ""}`);
  }
  console.log("✓ Agentes sincronizados (ai_base_tools intacto).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
