import "server-only";
import { z } from "zod";
import { tool, type ToolSet } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/auth/audit";
import type { Json } from "@/lib/database.types";

/**
 * Ferramentas do CHAT CONSTRUTOR de Integrações: o assistente monta/edita o
 * esquema (ferramentas/APIs, agentes de IA e vínculos) conversando com o admin.
 *
 * Segurança: escrita direta por service-role — a ROTA já exige `integrations.manage`.
 * É NÃO-DESTRUTIVO: nunca apaga bases/tools/agentes nem mexe em CREDENCIAIS/segredos
 * (isso continua manual, na UI). Toda mudança é auditada.
 */

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const AUTHS = ["none", "basic", "api_key", "bearer", "oauth2"] as const;

const paramSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  tipo: z.enum(["string", "number", "date", "enum", "boolean"]),
  origem: z.enum(["modelo", "identidade", "fixo", "credencial"]),
  local: z.enum(["query", "path", "body", "header", "none"]),
  obrigatorio: z.boolean().optional(),
  mascara: z.string().optional(),
  opcoes: z.array(z.string()).optional(),
  campoIdentidade: z.enum(["usuario", "cod_empresa", "matricula", "perfil", "portal", "cpf"]).optional(),
  valorFixo: z.string().optional(),
  campoCredencial: z.string().optional(),
  rawPath: z.boolean().optional(),
});

/** Resumo compacto do esquema atual — vai no system prompt e no `estado_atual`. */
export async function resumoEsquema(): Promise<string> {
  const db = createAdminClient();
  const [{ data: bases }, { data: tools }, { data: agents }, { data: links }] = await Promise.all([
    db.from("ai_bases").select("id, base_code, name, active").order("name"),
    db.from("ai_tools").select("id, key, name, endpoint_kind, active").order("name"),
    db.from("ai_agents").select("id, key, name, active").order("name"),
    db.from("ai_agent_tools").select("agent_id, tool_id"),
  ]);
  const toolKeyById = new Map((tools ?? []).map((t) => [t.id, t.key]));
  const partes: string[] = [];
  partes.push(
    "BASES: " + ((bases ?? []).map((b) => `${b.base_code}${b.active ? "" : " (inativa)"}`).join(", ") || "nenhuma"),
  );
  partes.push(
    "FERRAMENTAS: " +
      ((tools ?? [])
        .map((t) => `${t.key}${t.endpoint_kind === "external" ? " (externa)" : ""}${t.active ? "" : " (inativa)"}`)
        .join(", ") || "nenhuma"),
  );
  for (const a of agents ?? []) {
    const suas = (links ?? []).filter((l) => l.agent_id === a.id).map((l) => toolKeyById.get(l.tool_id)).filter(Boolean);
    partes.push(`AGENTE ${a.key}${a.active ? "" : " (inativo)"}: ${suas.length ? suas.join(", ") : "sem ferramentas"}`);
  }
  return partes.join("\n");
}

async function baseIdsDeCodigos(codes: string[]): Promise<string[]> {
  const db = createAdminClient();
  const { data } = await db.from("ai_bases").select("id, base_code");
  return codes.map((c) => (data ?? []).find((b) => b.base_code === c)?.id).filter((x): x is string => Boolean(x));
}

/** Monta o toolset do construtor. `actorId` só rotula a auditoria. */
export function buildSchemaTools(): ToolSet {
  return {
    estado_atual: tool({
      description: "Lê o esquema atual das Integrações: bases, ferramentas e agentes com seus vínculos. Use antes de editar.",
      inputSchema: z.object({}),
      execute: async () => resumoEsquema(),
    }),

    salvar_ferramenta: tool({
      description:
        "Cria ou edita uma ferramenta/API (identificada pela `key`). Só os campos enviados mudam; os demais são preservados. " +
        "Para tool EXTERNA, informe endpoint_kind='external' e external_url. NÃO mexe em credenciais.",
      inputSchema: z.object({
        key: z.string().min(1).regex(/^[a-z0-9_]+$/, "key: minúsculas, números e _"),
        name: z.string().optional(),
        description: z.string().optional(),
        method: z.enum(METHODS).optional(),
        path_template: z.string().optional(),
        auth_type: z.enum(AUTHS).optional(),
        endpoint_kind: z.enum(["base", "external"]).optional(),
        external_url: z.string().optional(),
        system_prompt: z.string().optional(),
        response_hint: z.string().optional(),
        params: z.array(paramSchema).optional(),
        baseCodes: z.array(z.string()).optional().describe("Bases (base_code) onde a tool fica ativa. Omitido: mantém (edição) ou todas (nova)."),
        active: z.boolean().optional(),
      }),
      execute: async (a) => {
        const db = createAdminClient();
        const { data: existing } = await db.from("ai_tools").select("*").eq("key", a.key).maybeSingle();
        const row = {
          key: a.key,
          name: a.name ?? existing?.name ?? a.key,
          description: a.description ?? existing?.description ?? "",
          method: a.method ?? (existing?.method as string) ?? "GET",
          path_template: a.path_template ?? existing?.path_template ?? "",
          auth_type: a.auth_type ?? (existing?.auth_type as string) ?? "oauth2",
          params: (a.params ?? existing?.params ?? []) as unknown as Json,
          response_hint: a.response_hint ?? existing?.response_hint ?? null,
          active: a.active ?? existing?.active ?? true,
          endpoint_kind: a.endpoint_kind ?? (existing?.endpoint_kind as string) ?? "base",
          external_url: a.external_url ?? existing?.external_url ?? null,
          system_prompt: a.system_prompt ?? existing?.system_prompt ?? "",
          updated_at: new Date().toISOString(),
        };
        if (!row.description) return "Erro: informe uma descrição para a ferramenta (a IA usa isto para decidir usá-la).";
        const up = await db.from("ai_tools").upsert(row, { onConflict: "key" }).select("id").single();
        if (up.error || !up.data) return `Erro ao salvar a ferramenta: ${up.error?.message}`;
        const toolId = up.data.id;

        // Acesso por base: se enviou baseCodes, reescreve; se é nova e não enviou, ativa em todas.
        let baseIds: string[] | null = null;
        if (a.baseCodes) baseIds = await baseIdsDeCodigos(a.baseCodes);
        else if (!existing) baseIds = (await db.from("ai_bases").select("id")).data?.map((b) => b.id) ?? [];
        if (baseIds) {
          await db.from("ai_base_tools").delete().eq("tool_id", toolId);
          if (baseIds.length) await db.from("ai_base_tools").insert(baseIds.map((base_id) => ({ base_id, tool_id: toolId, enabled: true })));
        }
        await audit({ action: existing ? "integrations.builder.tool.update" : "integrations.builder.tool.create", entityType: "ai_tool", entityId: toolId, spaceId: null, after: { key: a.key } });
        return `Ferramenta "${a.key}" ${existing ? "atualizada" : "criada"}.`;
      },
    }),

    salvar_agente: tool({
      description:
        "Cria ou edita um agente de IA (identificado pela `key`). Só os campos enviados mudam. `toolKeys` define as ferramentas do agente (substitui a lista atual quando enviado).",
      inputSchema: z.object({
        key: z.string().min(1).regex(/^[a-z0-9_]+$/, "key: minúsculas, números e _"),
        name: z.string().optional(),
        description: z.string().optional(),
        system_prompt: z.string().optional(),
        model: z.string().optional(),
        priority: z.number().int().optional(),
        active: z.boolean().optional(),
        toolKeys: z.array(z.string()).optional(),
      }),
      execute: async (a) => {
        const db = createAdminClient();
        const { data: existing } = await db.from("ai_agents").select("*").eq("key", a.key).maybeSingle();
        const row = {
          key: a.key,
          name: a.name ?? existing?.name ?? a.key,
          description: a.description ?? existing?.description ?? "",
          system_prompt: a.system_prompt ?? existing?.system_prompt ?? "",
          model: a.model ?? existing?.model ?? null,
          priority: a.priority ?? existing?.priority ?? 0,
          active: a.active ?? existing?.active ?? true,
          updated_at: new Date().toISOString(),
        };
        if (!row.description) return "Erro: informe uma descrição do agente (o roteador usa isto para escolhê-lo).";
        const up = await db.from("ai_agents").upsert(row, { onConflict: "key" }).select("id").single();
        if (up.error || !up.data) return `Erro ao salvar o agente: ${up.error?.message}`;
        const agentId = up.data.id;

        if (a.toolKeys) {
          const { data: tks } = await db.from("ai_tools").select("id, key").in("key", a.toolKeys);
          await db.from("ai_agent_tools").delete().eq("agent_id", agentId);
          const rows = (tks ?? []).map((t) => ({ agent_id: agentId, tool_id: t.id }));
          if (rows.length) await db.from("ai_agent_tools").insert(rows);
        }
        await audit({ action: existing ? "integrations.builder.agent.update" : "integrations.builder.agent.create", entityType: "ai_agent", entityId: agentId, spaceId: null, after: { key: a.key } });
        return `Agente "${a.key}" ${existing ? "atualizado" : "criado"}${a.toolKeys ? ` com ${a.toolKeys.length} ferramenta(s)` : ""}.`;
      },
    }),

    vincular: tool({
      description: "Vincula UMA ferramenta a UM agente (pela key de cada). Idempotente.",
      inputSchema: z.object({ agentKey: z.string(), toolKey: z.string() }),
      execute: async ({ agentKey, toolKey }) => {
        const db = createAdminClient();
        const [{ data: ag }, { data: to }] = await Promise.all([
          db.from("ai_agents").select("id").eq("key", agentKey).maybeSingle(),
          db.from("ai_tools").select("id").eq("key", toolKey).maybeSingle(),
        ]);
        if (!ag) return `Agente "${agentKey}" não existe.`;
        if (!to) return `Ferramenta "${toolKey}" não existe.`;
        const r = await db.from("ai_agent_tools").upsert({ agent_id: ag.id, tool_id: to.id }, { onConflict: "agent_id,tool_id", ignoreDuplicates: true });
        if (r.error) return `Erro ao vincular: ${r.error.message}`;
        await audit({ action: "integrations.builder.link", entityType: "ai_agent_tool", entityId: `${ag.id}:${to.id}`, spaceId: null });
        return `"${toolKey}" vinculada ao agente "${agentKey}".`;
      },
    }),

    desvincular: tool({
      description: "Remove o vínculo de UMA ferramenta com UM agente (pela key de cada).",
      inputSchema: z.object({ agentKey: z.string(), toolKey: z.string() }),
      execute: async ({ agentKey, toolKey }) => {
        const db = createAdminClient();
        const [{ data: ag }, { data: to }] = await Promise.all([
          db.from("ai_agents").select("id").eq("key", agentKey).maybeSingle(),
          db.from("ai_tools").select("id").eq("key", toolKey).maybeSingle(),
        ]);
        if (!ag || !to) return "Agente ou ferramenta não encontrado.";
        const r = await db.from("ai_agent_tools").delete().eq("agent_id", ag.id).eq("tool_id", to.id);
        if (r.error) return `Erro ao desvincular: ${r.error.message}`;
        await audit({ action: "integrations.builder.unlink", entityType: "ai_agent_tool", entityId: `${ag.id}:${to.id}`, spaceId: null });
        return `"${toolKey}" desvinculada do agente "${agentKey}".`;
      },
    }),
  };
}
