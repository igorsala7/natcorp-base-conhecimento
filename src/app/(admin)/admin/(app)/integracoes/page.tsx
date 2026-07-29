import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/auth/permissions";
import { hasEncryptionKey } from "@/lib/crypto/secrets";
import { env } from "@/lib/env";
import { listSpaces } from "@/lib/content/spaces";
import type { AuthType } from "@/lib/integrations/credentials";
import type { WhatsappBundle } from "./integrations-shell";
import type { WhatsappSettings } from "./whatsapp-panel";
import type { ToolParam } from "@/lib/integrations/tools";
import type { BaseRow, SpaceOption } from "./integrations-manager";
import { IntegrationsShell } from "./integrations-shell";
import type { ToolRow, BaseToolRow } from "./tools-manager";
import type { AgentRow, ProviderOption } from "./agents-manager";

export const metadata: Metadata = { title: "Integrações" };

/**
 * Módulo de INTEGRAÇÕES: bases/clientes, suas credenciais (OAuth2/basic/…) e,
 * nas próximas fases, o catálogo de APIs/Tools e os agentes.
 *
 * Área GLOBAL (não por documentação) — exige `integrations.manage` (Admin
 * técnico, nível 80). Um papel restrito a uma documentação não a alcança.
 */
export default async function IntegracoesPage() {
  const pode = await hasPermission("integrations.manage", null);
  if (!pode) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
        <p className="mt-2 text-text-muted">
          Você não tem permissão para gerenciar integrações. Esta área exige um papel{" "}
          <strong className="font-medium">global</strong> de administração técnica.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const [
    { data: bases },
    { data: baseSpacesData },
    { data: creds },
    { data: toolsData },
    { data: baseToolsData },
    { data: agentsData },
    { data: agentToolsData },
    { data: providersData },
    { data: waSettings },
  ] = await Promise.all([
    supabase.from("ai_bases").select("id, base_code, name, active").order("name"),
    supabase.from("ai_base_spaces").select("base_id, space_id, position"),
    supabase.from("ai_base_credentials").select("id, base_id, name, auth_type, active").order("name"),
    supabase
      .from("ai_tools")
      .select("id, key, name, description, method, path_template, auth_type, params, response_hint, active")
      .order("name"),
    supabase.from("ai_base_tools").select("base_id, tool_id, enabled, base_url, credential_id"),
    supabase
      .from("ai_agents")
      .select("id, key, name, description, provider_id, model, system_prompt, parent_agent_id, scope_permission, priority, active")
      .order("priority", { ascending: false })
      .order("name"),
    supabase.from("ai_agent_tools").select("agent_id, tool_id"),
    supabase.from("ai_providers").select("id, name").eq("active", true).order("name"),
    supabase.from("whatsapp_settings").select("*").eq("id", true).maybeSingle(),
  ]);

  // Presença de segredo: `ai_base_credential_secrets` é deny-all (só service-role
  // lê). Buscamos só os ids que TÊM segredo — o valor nunca sai do servidor.
  const admin = createAdminClient();
  const [{ data: secretRows }, { data: waSec }] = await Promise.all([
    admin.from("ai_base_credential_secrets").select("credential_id"),
    admin
      .from("whatsapp_secrets")
      .select("app_secret_enc, access_token_enc, verify_token_enc, identity_secret_enc")
      .eq("id", true)
      .maybeSingle(),
  ]);
  const comSegredo = new Set((secretRows ?? []).map((r) => r.credential_id));

  const spaceOptions: SpaceOption[] = (await listSpaces()).map((s) => ({ id: s.id, name: s.name }));

  const baseRows: BaseRow[] = (bases ?? []).map((b) => ({
    id: b.id,
    base_code: b.base_code,
    name: b.name,
    active: b.active,
    spaceIds: (baseSpacesData ?? [])
      .filter((x) => x.base_id === b.id)
      .sort((a, z) => a.position - z.position)
      .map((x) => x.space_id),
    credentials: (creds ?? [])
      .filter((c) => c.base_id === b.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        auth_type: c.auth_type as AuthType,
        active: c.active,
        hasSecret: comSegredo.has(c.id),
      })),
  }));

  const toolRows: ToolRow[] = (toolsData ?? []).map((t) => ({
    id: t.id,
    key: t.key,
    name: t.name,
    description: t.description,
    method: t.method as ToolRow["method"],
    path_template: t.path_template,
    auth_type: t.auth_type as AuthType,
    params: (t.params as unknown as ToolParam[]) ?? [],
    response_hint: t.response_hint,
    active: t.active,
  }));

  const baseToolRows: BaseToolRow[] = (baseToolsData ?? []).map((x) => ({
    base_id: x.base_id,
    tool_id: x.tool_id,
    enabled: x.enabled,
    base_url: x.base_url,
    credential_id: x.credential_id,
  }));

  const agentRows: AgentRow[] = (agentsData ?? []).map((a) => ({
    id: a.id,
    key: a.key,
    name: a.name,
    description: a.description,
    provider_id: a.provider_id,
    model: a.model,
    system_prompt: a.system_prompt,
    parent_agent_id: a.parent_agent_id,
    scope_permission: a.scope_permission,
    priority: a.priority,
    active: a.active,
    toolIds: (agentToolsData ?? []).filter((x) => x.agent_id === a.id).map((x) => x.tool_id),
  }));

  const providerOptions: ProviderOption[] = (providersData ?? []).map((p) => ({ id: p.id, name: p.name }));

  const whatsapp: WhatsappBundle = {
    settings: {
      active: waSettings?.active ?? false,
      phone_number_id: waSettings?.phone_number_id ?? null,
      waba_id: waSettings?.waba_id ?? null,
      business_account_id: waSettings?.business_account_id ?? null,
      unidentified_message: waSettings?.unidentified_message ?? "",
      identity_endpoint: waSettings?.identity_endpoint ?? null,
      identity_method: waSettings?.identity_method ?? "GET",
      identity_auth_type: (waSettings?.identity_auth_type ?? "none") as WhatsappSettings["identity_auth_type"],
      identity_phone_param: waSettings?.identity_phone_param ?? "telefone",
      identity_phone_local: waSettings?.identity_phone_local ?? "query",
      identity_map: (waSettings?.identity_map as Record<string, string>) ?? {},
    },
    secretsPresent: {
      app_secret: !!waSec?.app_secret_enc,
      access_token: !!waSec?.access_token_enc,
      verify_token: !!waSec?.verify_token_enc,
      identity: !!waSec?.identity_secret_enc,
    },
    webhookUrl: `${env.NEXT_PUBLIC_SITE_URL}/api/whatsapp/webhook`,
  };

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
        Clientes/bases, suas credenciais, e o catálogo de APIs que a IA pode consultar. Cada base
        tem seu próprio <code>base_code</code> (o <code>p_base</code> do token), endpoints e credenciais.
      </p>

      <IntegrationsShell
        bases={baseRows}
        tools={toolRows}
        baseTools={baseToolRows}
        agents={agentRows}
        providers={providerOptions}
        spaces={spaceOptions}
        whatsapp={whatsapp}
        temChaveMestra={hasEncryptionKey()}
      />
    </div>
  );
}
