import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secrets";
import type { AuthType } from "./credentials";
import type { LoopConfig, ToolParam } from "./tools";
import type { RuntimeTool, RuntimeCredential } from "./executor";

/**
 * Carrega, por SERVICE-ROLE, o contexto de integração de uma base a partir do
 * `base_code` (= p_base do token). Só o servidor lê isto — as credenciais estão
 * numa tabela deny-all e cifradas.
 */

export type BaseToolContext = {
  toolId: string;
  tool: RuntimeTool;
  baseUrl: string | null;
  credentialId: string | null;
  /** Allowlist de acesso (#4): portais/perfis liberados. Vazio = liberado. */
  portais: string[];
  perfis: string[];
  /** Tags de assunto (Opção A): módulos/submódulos que esta tool serve. */
  modules: { modulo: string; submodulo: string | null }[];
  /** Tool "essencial": entra sempre, ignorando o roteamento por assunto. */
  alwaysInclude: boolean;
};
export type BaseContext = {
  baseId: string;
  name: string;
  tools: BaseToolContext[];
  /** Seleção de tools por assunto ligada para esta base (Opção A). */
  toolRouting: boolean;
};

type EmbeddedRow = {
  base_url: string | null;
  credential_id: string | null;
  enabled: boolean;
  portais: string[] | null;
  perfis: string[] | null;
  tool: {
    id: string;
    key: string;
    name: string;
    description: string;
    method: string;
    path_template: string;
    auth_type: string;
    params: unknown;
    response_hint: string | null;
    body_mode: string | null;
    guard: string | null;
    cache_ttl: number | null;
    loop: LoopConfig | null;
    endpoint_kind: string | null;
    external_url: string | null;
    credential_id: string | null;
    system_prompt: string | null;
    always_include: boolean | null;
    active: boolean;
  } | null;
};

/** Base ATIVA + suas tools HABILITADAS (com base_url e credencial). */
export async function loadBaseContext(baseCode: string): Promise<BaseContext | null> {
  const db = createAdminClient();
  // `base_code` é um slug, mas o `p_base` chega do APEX do cliente em qualquer
  // caixa (ex.: manda "NATCORP" e no banco está "natcorp"): casamos SEM
  // diferenciar maiúsc./minúsc.. Escapamos %/_/\ para o valor do cliente não
  // virar curinga de LIKE. Sem isto, um p_base fora da caixa = 0 tools no chat.
  const alvo = baseCode.trim().replace(/([\\%_])/g, "\\$1");
  const { data: base } = await db
    .from("ai_bases")
    .select("id, name, active, base_url, credential_id, tool_routing")
    .ilike("base_code", alvo)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (!base) return null;

  const { data } = await db
    .from("ai_base_tools")
    .select(
      "base_url, credential_id, enabled, portais, perfis, tool:ai_tools(id, key, name, description, method, path_template, auth_type, params, response_hint, body_mode, guard, cache_ttl, loop, endpoint_kind, external_url, credential_id, system_prompt, always_include, active)",
    )
    .eq("base_id", base.id)
    .eq("enabled", true);

  const rows = (data ?? []) as unknown as EmbeddedRow[];

  // Tags de assunto (Opção A): módulos/submódulos que cada tool serve. Carregadas
  // só quando a base usa roteamento por assunto (senão nem consulta).
  const toolIds = rows.map((r) => r.tool?.id).filter((x): x is string => !!x);
  const tagsPorTool = new Map<string, { modulo: string; submodulo: string | null }[]>();
  if (base.tool_routing && toolIds.length > 0) {
    const { data: tagRows } = await db
      .from("ai_tool_modules")
      .select("tool_id, modulo, submodulo")
      .in("tool_id", toolIds);
    for (const tr of tagRows ?? []) {
      const arr = tagsPorTool.get(tr.tool_id) ?? [];
      arr.push({ modulo: tr.modulo, submodulo: tr.submodulo });
      tagsPorTool.set(tr.tool_id, arr);
    }
  }

  const tools: BaseToolContext[] = [];
  for (const r of rows) {
    const t = r.tool;
    if (!t || !t.active) continue; // tool desativada no catálogo não aparece
    // Origem do endpoint: EXTERNA usa a URL/credencial da própria tool; INTERNA
    // usa a da BASE (com fallback às colunas antigas de ai_base_tools durante a
    // transição, caso o backfill não as tenha preenchido).
    const externa = t.endpoint_kind === "external";
    const baseUrl = externa ? t.external_url : (base.base_url ?? r.base_url);
    const credentialId = externa ? t.credential_id : (base.credential_id ?? r.credential_id);
    tools.push({
      toolId: t.id,
      tool: {
        key: t.key,
        name: t.name,
        description: t.description,
        method: t.method,
        path_template: t.path_template,
        auth_type: t.auth_type as AuthType,
        params: (t.params as ToolParam[]) ?? [],
        response_hint: t.response_hint,
        body_mode: t.body_mode,
        guard: t.guard,
        cache_ttl: t.cache_ttl,
        loop: t.loop,
        system_prompt: t.system_prompt,
      },
      baseUrl,
      credentialId,
      portais: r.portais ?? [],
      perfis: r.perfis ?? [],
      modules: tagsPorTool.get(t.id) ?? [],
      alwaysInclude: t.always_include === true,
    });
  }
  return { baseId: base.id, name: base.name, tools, toolRouting: base.tool_routing === true };
}

/** Carrega e DECIFRA a credencial (o blob de segredo em claro para o motor). */
export async function loadCredentialSecret(credentialId: string): Promise<RuntimeCredential | null> {
  const db = createAdminClient();
  const { data: cred } = await db
    .from("ai_base_credentials")
    .select("id, auth_type, active")
    .eq("id", credentialId)
    .maybeSingle();
  if (!cred || !cred.active) return null;
  if (cred.auth_type === "none") return { id: cred.id, auth_type: "none", secret: {} };

  const { data: sec } = await db
    .from("ai_base_credential_secrets")
    .select("secret_enc")
    .eq("credential_id", credentialId)
    .maybeSingle();

  let secret: Record<string, string> = {};
  if (sec?.secret_enc) {
    try {
      secret = JSON.parse(decryptSecret(sec.secret_enc));
    } catch {
      secret = {}; // segredo corrompido/ilegível: melhor vazio que quebrar o chat
    }
  }
  return { id: cred.id, auth_type: cred.auth_type as AuthType, secret };
}
