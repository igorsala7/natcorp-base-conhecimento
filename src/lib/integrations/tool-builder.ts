import "server-only";
import { tool, type ToolSet } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBaseContext, loadCredentialSecret } from "./resolve";
import { buildModelSchema, identityFromTrack, type Identity } from "./params";
import { executeTool } from "./executor";

export { identityFromTrack };

export type IntegrationBundle = { tools: ToolSet; capabilities: string };

/**
 * Monta as tools do AI SDK para uma base: as APIs HABILITADAS que pertencem a um
 * AGENTE ATIVO (curadoria). Sem nenhum agente ativo, expõe todas as habilitadas
 * (para funcionar antes de configurar agentes).
 *
 * A IA só enxerga os parâmetros `origem=modelo` (buildModelSchema). Identidade e
 * segredos entram no `execute`, no servidor — o modelo nunca os fornece.
 */
export async function buildIntegrationTools(
  baseCode: string,
  identity: Identity,
): Promise<IntegrationBundle> {
  const ctx = await loadBaseContext(baseCode);
  if (!ctx || ctx.tools.length === 0) return { tools: {}, capabilities: "" };

  const db = createAdminClient();
  const [{ data: agents }, { data: links }] = await Promise.all([
    db.from("ai_agents").select("id, name, description").eq("active", true),
    db.from("ai_agent_tools").select("agent_id, tool_id"),
  ]);
  const activeIds = new Set((agents ?? []).map((a) => a.id));
  const curated = new Set((links ?? []).filter((l) => activeIds.has(l.agent_id)).map((l) => l.tool_id));
  const temAgentes = activeIds.size > 0;

  const tools: ToolSet = {};
  for (const bt of ctx.tools) {
    if (temAgentes && !curated.has(bt.toolId)) continue; // fora de todo agente ativo
    tools[bt.tool.key] = tool({
      description: [bt.tool.description, bt.tool.response_hint].filter(Boolean).join(" "),
      inputSchema: buildModelSchema(bt.tool.params),
      execute: async (args) => {
        try {
          if (!bt.baseUrl) return { erro: "Endpoint não configurado para esta base." };
          const credential = bt.credentialId ? await loadCredentialSecret(bt.credentialId) : null;
          const r = await executeTool({
            tool: bt.tool,
            baseUrl: bt.baseUrl,
            credential,
            modelArgs: (args ?? {}) as Record<string, unknown>,
            identity,
          });
          if (!r.ok) return { erro: `A API retornou HTTP ${r.status}.`, dados: r.data };
          return r.data;
        } catch (e) {
          return { erro: e instanceof Error ? e.message : String(e) };
        }
      },
    });
  }

  if (Object.keys(tools).length === 0) return { tools: {}, capabilities: "" };

  // Nota de capacidades para o system prompt (ajuda a rotear documentação × API).
  const especialidades = (agents ?? [])
    .filter((a) => (links ?? []).some((l) => l.agent_id === a.id && curated.has(l.tool_id)))
    .map((a) => `- ${a.name}: ${a.description}`)
    .join("\n");
  const capabilities =
    "Você tem FERRAMENTAS para consultar dados reais do sistema do usuário. Use-as quando ele pedir " +
    "dados/registros específicos — nunca invente valores. Para dúvidas de uso ou como-fazer, use a documentação." +
    (especialidades ? `\nEspecialidades disponíveis:\n${especialidades}` : "");

  return { tools, capabilities };
}
