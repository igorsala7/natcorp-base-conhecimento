import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/auth/permissions";
import { hasEncryptionKey } from "@/lib/crypto/secrets";
import { PageShell } from "@/components/ui/page-shell";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { env } from "@/lib/env";
import { listSpaces } from "@/lib/content/spaces";
import type { AuthType } from "@/lib/integrations/credentials";
import type { WhatsappBundle } from "./integrations-shell";
import type { WhatsappSettings } from "./whatsapp-panel";
import type { LoopConfig, ToolParam } from "@/lib/integrations/tools";
import { normalizarPanelScope } from "@/lib/integrations/panel-scope";
import type { BaseRow, NodePos, SpaceOption } from "./integrations-manager";
import { IntegrationsShell } from "./integrations-shell";
import type { EndpointKind, ToolRow, BaseToolRow, ModuleTag } from "./tools-manager";
import type { AgentRow, ProviderOption } from "./agents-manager";
import type { ProfileRow } from "./profiles-manager";
import type { RunRow } from "./runs-manager";

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
    /* `SemPermissao` e não uma recusa escrita à mão: o primitivo nomeia a
       PERMISSÃO e o PAPEL que faltam, e é isso que impede o link recebido de um
       colega de virar mistério. As outras 30 telas já usavam; esta tinha a sua
       própria, que dizia menos. */
    return (
      <SemPermissao
        titulo="Conexões"
        oQue="gerenciar as conexões com as bases dos clientes"
        permissao="integrations.manage"
        papel="Admin técnico"
      />
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
    { data: waSettingsRows },
    { data: runsData },
    { data: modulesData },
    { data: toolModulesData },
    { data: priorityRulesData },
    { data: profilesData },
    { data: profileModulesData },
  ] = await Promise.all([
    supabase.from("ai_bases").select("id, base_code, name, active, base_url, credential_id, tool_routing, widget_paineis, flow_layout, perfis_endpoint, perfis_campo").order("name"),
    supabase.from("ai_base_spaces").select("base_id, space_id, position"),
    supabase.from("ai_base_credentials").select("id, base_id, name, auth_type, active, provider").order("name"),
    supabase
      .from("ai_tools")
      .select(
        "id, key, name, description, descricao_usuario, selecionavel_no_chat, method, path_template, auth_type, params, response_hint, search_terms, active, always_include, prioridade, grupo_ambiguidade, endpoint_kind, external_url, credential_id, system_prompt, body_mode, guard, cache_ttl, cache_scope, loop, panel_scope, exclude_self",
      )
      .order("name"),
    supabase.from("ai_base_tools").select("base_id, tool_id, enabled, base_url, credential_id, portais, empresas, perfis"),
    supabase
      .from("ai_agents")
      .select("id, key, name, description, provider_id, model, system_prompt, parent_agent_id, scope_permission, priority, active, is_default")
      .order("priority", { ascending: false })
      .order("name"),
    supabase.from("ai_agent_tools").select("agent_id, tool_id"),
    supabase.from("ai_providers").select("id, name").eq("active", true).order("name"),
    supabase.from("whatsapp_settings").select("*").order("base_code"),
    supabase
      .from("ai_tool_runs")
      .select(
        "id, created_at, base_code, tool_key, agent_key, step_index, ok, status, cached, files, duration_ms, error, input, request, output, conversation:conversations(p_perfil, p_usuario, p_empresa, p_matricula, p_portal)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    // Taxonomia sincronizada (opções de tag) + tags atuais de cada tool.
    supabase.from("ai_modules").select("modulo, submodulo").order("modulo"),
    supabase.from("ai_tool_modules").select("tool_id, modulo, submodulo"),
    // Desempates pareados (quem vence quem quando as duas disputam o turno).
    supabase.from("ai_tool_priority_rules").select("winner_tool_id, loser_tool_id, modo, motivo"),
    // Perfis de análise de relatório (por módulo) + seus módulos vinculados.
    supabase
      .from("ai_agent_profiles")
      .select("id, base_code, titulo, nome, descricao, cargo, comportamento, acoes, prompt_refino, requires_perfil, priority, active")
      .order("priority", { ascending: false })
      .order("titulo"),
    supabase.from("ai_agent_profile_modules").select("profile_id, modulo, submodulo"),
  ]);

  // Presença de segredo: `ai_base_credential_secrets` é deny-all (só service-role
  // lê). Buscamos só os ids que TÊM segredo — o valor nunca sai do servidor.
  const admin = createAdminClient();
  const [{ data: secretRows }, { data: waSecRows }, { data: waBaseRows }] = await Promise.all([
    admin.from("ai_base_credential_secrets").select("credential_id"),
    admin.from("whatsapp_secrets").select("base_code, app_secret_enc, access_token_enc, verify_token_enc, identity_secret_enc"),
    admin.from("ai_bases").select("base_code").eq("active", true),
  ]);
  const comSegredo = new Set((secretRows ?? []).map((r) => r.credential_id));

  const spaceOptions: SpaceOption[] = (await listSpaces()).map((s) => ({ id: s.id, name: s.name }));

  // Opções de tag (roteamento por assunto): pares (módulo, submódulo) DISTINTOS do
  // cache sincronizado — o vínculo tool→módulo é global (produto), então unimos
  // todas as bases. Chave = "modulo\u0000submodulo".
  const moduleSeen = new Set<string>();
  const moduleOptions: ModuleTag[] = [];
  for (const m of modulesData ?? []) {
    const submodulo = m.submodulo ?? null;
    const chave = `${m.modulo}\u0000${submodulo ?? ""}`;
    if (moduleSeen.has(chave)) continue;
    moduleSeen.add(chave);
    moduleOptions.push({ modulo: m.modulo, submodulo });
  }

  // Tags atuais por tool.
  const tagsByTool = new Map<string, ModuleTag[]>();
  for (const tm of toolModulesData ?? []) {
    const arr = tagsByTool.get(tm.tool_id) ?? [];
    arr.push({ modulo: tm.modulo, submodulo: tm.submodulo ?? null });
    tagsByTool.set(tm.tool_id, arr);
  }

  const baseRows: BaseRow[] = (bases ?? []).map((b) => ({
    id: b.id,
    base_code: b.base_code,
    name: b.name,
    widget_paineis: b.widget_paineis ?? null,
    active: b.active,
    base_url: b.base_url,
    credential_id: b.credential_id,
    tool_routing: b.tool_routing,
    perfis_endpoint: b.perfis_endpoint,
    perfis_campo: b.perfis_campo,
    flow_layout: (b.flow_layout as unknown as Record<string, NodePos> | null) ?? null,
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
        // Não é segredo (mora em coluna), então PODE voltar para a tela. Sem
        // isto, editar uma credencial delegada mostrava o Provedor em branco
        // mesmo com valor gravado, e não havia como saber o que estava salvo.
        provider: c.provider ?? null,
      })),
  }));

  // Regras de desempate agrupadas pela VENCEDORA — é assim que o editor as mostra
  // ("esta ferramenta vence de: …"), do lado de quem declara a preferência.
  const venceDeByTool = new Map<string, ToolRow["vence_de"]>();
  for (const r of priorityRulesData ?? []) {
    const arr = venceDeByTool.get(r.winner_tool_id) ?? [];
    arr.push({ tool_id: r.loser_tool_id, modo: r.modo === "sempre" ? "sempre" : "empate", motivo: r.motivo });
    venceDeByTool.set(r.winner_tool_id, arr);
  }

  const toolRows: ToolRow[] = (toolsData ?? []).map((t) => ({
    id: t.id,
    key: t.key,
    name: t.name,
    description: t.description,
    descricao_usuario: t.descricao_usuario,
    selecionavel_no_chat: t.selecionavel_no_chat,
    method: t.method as ToolRow["method"],
    path_template: t.path_template,
    auth_type: t.auth_type as AuthType,
    params: (t.params as unknown as ToolParam[]) ?? [],
    response_hint: t.response_hint,
    search_terms: t.search_terms,
    active: t.active,
    always_include: t.always_include ?? false,
    prioridade: t.prioridade ?? 0,
    grupo_ambiguidade: t.grupo_ambiguidade,
    vence_de: venceDeByTool.get(t.id) ?? [],
    tags: tagsByTool.get(t.id) ?? [],
    endpoint_kind: (t.endpoint_kind as EndpointKind) ?? "base",
    external_url: t.external_url,
    credential_id: t.credential_id,
    system_prompt: t.system_prompt ?? "",
    body_mode: t.body_mode,
    guard: t.guard,
    cache_ttl: t.cache_ttl,
    cache_scope: t.cache_scope ?? "user",
    loop: (t.loop as unknown as LoopConfig | null) ?? null,
    panel_scope: normalizarPanelScope(t.panel_scope),
    exclude_self: t.exclude_self ?? false,
  }));

  const baseToolRows: BaseToolRow[] = (baseToolsData ?? []).map((x) => ({
    base_id: x.base_id,
    tool_id: x.tool_id,
    enabled: x.enabled,
    base_url: x.base_url,
    credential_id: x.credential_id,
    portais: x.portais ?? [],
    empresas: x.empresas ?? [],
    perfis: x.perfis ?? [],
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
    is_default: a.is_default,
    toolIds: (agentToolsData ?? []).filter((x) => x.agent_id === a.id).map((x) => x.tool_id),
  }));

  const providerOptions: ProviderOption[] = (providersData ?? []).map((p) => ({ id: p.id, name: p.name }));

  // Perfis de análise (por módulo) + seus módulos vinculados.
  const modulosByProfile = new Map<string, ModuleTag[]>();
  for (const pm of profileModulesData ?? []) {
    const arr = modulosByProfile.get(pm.profile_id) ?? [];
    arr.push({ modulo: pm.modulo, submodulo: pm.submodulo ?? null });
    modulosByProfile.set(pm.profile_id, arr);
  }
  const profileRows: ProfileRow[] = (profilesData ?? []).map((p) => ({
    id: p.id,
    base_code: p.base_code,
    titulo: p.titulo,
    nome: p.nome,
    descricao: p.descricao,
    cargo: p.cargo,
    comportamento: p.comportamento,
    acoes: Array.isArray(p.acoes) ? p.acoes : [],
    prompt_refino: p.prompt_refino ?? "",
    requires_perfil: p.requires_perfil,
    priority: p.priority,
    active: p.active,
    modulos: modulosByProfile.get(p.id) ?? [],
  }));

  const runRows: RunRow[] = (runsData ?? []).map((r) => {
    // conversation vem como objeto (FK to-one) ou array, conforme o embed; normaliza.
    const conv = (Array.isArray(r.conversation) ? r.conversation[0] : r.conversation) as
      | { p_perfil: string | null; p_usuario: string | null; p_empresa: string | null; p_matricula: string | null; p_portal: string | null }
      | null
      | undefined;
    return {
      id: r.id,
      created_at: r.created_at,
      base_code: r.base_code,
      tool_key: r.tool_key,
      agent_key: r.agent_key,
      step_index: r.step_index,
      ok: r.ok,
      status: r.status,
      cached: r.cached,
      files: r.files,
      duration_ms: r.duration_ms,
      error: r.error,
      input: r.input,
      request: r.request,
      output: r.output,
      perfil: conv?.p_perfil ?? null,
      usuario: conv?.p_usuario ?? null,
      empresa: conv?.p_empresa ?? null,
      matricula: conv?.p_matricula ?? null,
      portal: conv?.p_portal ?? null,
    };
  });

  const channels: Record<string, WhatsappSettings> = {};
  for (const s of waSettingsRows ?? []) {
    channels[s.base_code] = {
      active: s.active,
      provider: (s.provider === "evolution" ? "evolution" : "meta") as WhatsappSettings["provider"],
      evolution_url: s.evolution_url,
      evolution_instance: s.evolution_instance,
      phone_number_id: s.phone_number_id,
      waba_id: s.waba_id,
      business_account_id: s.business_account_id,
      unidentified_message: s.unidentified_message ?? "",
      identity_endpoint: s.identity_endpoint,
      identity_method: s.identity_method,
      identity_auth_type: (s.identity_auth_type ?? "none") as WhatsappSettings["identity_auth_type"],
      identity_phone_param: s.identity_phone_param,
      identity_phone_local: s.identity_phone_local,
      identity_map: (s.identity_map as Record<string, string>) ?? {},
    };
  }
  const waSecrets: Record<string, { app_secret: boolean; access_token: boolean; verify_token: boolean; identity: boolean }> = {};
  for (const r of waSecRows ?? []) {
    waSecrets[r.base_code] = {
      app_secret: !!r.app_secret_enc,
      access_token: !!r.access_token_enc,
      verify_token: !!r.verify_token_enc,
      identity: !!r.identity_secret_enc,
    };
  }
  const waBases = [
    ...new Set([
      ...(waBaseRows ?? []).map((b) => b.base_code).filter((c): c is string => !!c),
      ...Object.keys(channels).filter((b) => b !== ""),
    ]),
  ].sort();
  const whatsapp: WhatsappBundle = {
    channels,
    secrets: waSecrets,
    bases: waBases,
    webhookUrl: `${env.NEXT_PUBLIC_SITE_URL}/api/whatsapp/webhook`,
  };

  return (
    /* "Conexões" e não "Integrações": é o nome no menu, e cabeçalho discordando
       da barra lateral é o que impedia escrever um breadcrumb honesto.
       `wide` e não a antiga `max-w-5xl`: a aba "APIs / Tools" é uma tabela de
       catálogo, e cortar coluna é pior que rolar. */
    <PageShell
      titulo="Conexões"
      descricao={
        <>
          Clientes/bases, suas credenciais, e o catálogo de APIs que a IA pode consultar. Cada base
          tem seu próprio <code>base_code</code> (o <code>p_base</code> do token), endpoints e credenciais.
        </>
      }
      largura="wide"
    >
      <IntegrationsShell
        bases={baseRows}
        tools={toolRows}
        baseTools={baseToolRows}
        agents={agentRows}
        profiles={profileRows}
        providers={providerOptions}
        spaces={spaceOptions}
        runs={runRows}
        moduleOptions={moduleOptions}
        whatsapp={whatsapp}
        temChaveMestra={hasEncryptionKey()}
      />
    </PageShell>
  );
}
