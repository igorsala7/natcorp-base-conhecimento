import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secrets";
import type { AuthType } from "./credentials";
import type { ToolParam } from "./tools";
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
};
export type BaseContext = { baseId: string; name: string; tools: BaseToolContext[] };

type EmbeddedRow = {
  base_url: string | null;
  credential_id: string | null;
  enabled: boolean;
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
    active: boolean;
  } | null;
};

/** Base ATIVA + suas tools HABILITADAS (com base_url e credencial). */
export async function loadBaseContext(baseCode: string): Promise<BaseContext | null> {
  const db = createAdminClient();
  const { data: base } = await db
    .from("ai_bases")
    .select("id, name, active")
    .eq("base_code", baseCode)
    .eq("active", true)
    .maybeSingle();
  if (!base) return null;

  const { data } = await db
    .from("ai_base_tools")
    .select(
      "base_url, credential_id, enabled, tool:ai_tools(id, key, name, description, method, path_template, auth_type, params, response_hint, body_mode, active)",
    )
    .eq("base_id", base.id)
    .eq("enabled", true);

  const rows = (data ?? []) as unknown as EmbeddedRow[];
  const tools: BaseToolContext[] = [];
  for (const r of rows) {
    const t = r.tool;
    if (!t || !t.active) continue; // tool desativada no catálogo não aparece
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
      },
      baseUrl: r.base_url,
      credentialId: r.credential_id,
    });
  }
  return { baseId: base.id, name: base.name, tools };
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
