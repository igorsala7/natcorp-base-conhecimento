/**
 * Seed da base NATCORP no módulo de Integrações.
 *
 * Registra, de forma IDEMPOTENTE (re-executável), a base, a credencial OAuth, o
 * catálogo de ferramentas (consultas do colaborador + relatórios em PDF), a
 * ativação por base e o agente que as reúne — o equivalente nativo aos workflows
 * do n8n. Roda com a `service_role` (ignora RLS e a tabela isolada de segredos).
 *
 * Uso:
 *   npm run seed:natcorp
 *
 * Requer no .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   NATCORP_OAUTH_CLIENT_ID, NATCORP_OAUTH_CLIENT_SECRET   (segredo OAuth)
 *   NATCORP_SPACE_SLUG  (opcional — slug da documentação p/ RAG; pode vincular depois na UI)
 *
 * O segredo é cifrado com `encryptSecret` (AES-256-GCM); sem APP_ENCRYPTION_KEY
 * ele é gravado com o prefixo `plain:` — a tela de Integrações avisa. O
 * client_secret NUNCA é gravado em arquivo versionado.
 */
import ws from "ws";
// supabase-js recente exige WebSocket nativo (Node 22+); em Node 20, polyfill.
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import { createClient } from "@supabase/supabase-js";
import { encryptSecret } from "../src/lib/crypto/secrets";
import type { Database, Json } from "../src/lib/database.types";
import {
  NATCORP_AGENTS,
  NATCORP_BASE_CODE,
  NATCORP_BASE_NAME,
  NATCORP_BASE_URL,
  NATCORP_CREDENTIAL_NAME,
  NATCORP_TOKEN_URL,
  NATCORP_TOOLS,
} from "./natcorp-tools";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clientId = process.env.NATCORP_OAUTH_CLIENT_ID;
const clientSecret = process.env.NATCORP_OAUTH_CLIENT_SECRET;
// Chave de sessão do login ORDS — habilita validação do usuário + CPF/perfil.
const sessionKey = process.env.NATCORP_SESSION_KEY?.trim();
const spaceSlug = process.env.NATCORP_SPACE_SLUG?.trim();

if (!url || !serviceRole) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}

const db = createClient<Database>(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Aborta com mensagem clara quando um passo do seed falha; devolve o dado não-nulo. */
function must<T>(step: string, res: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (res.error || res.data == null) {
    console.error(`✗ ${step}: ${res.error?.message ?? "sem retorno"}`);
    process.exit(1);
  }
  return res.data as NonNullable<T>;
}

async function main(): Promise<void> {
  console.log(`Seed da base "${NATCORP_BASE_NAME}" (base_code=${NATCORP_BASE_CODE})…`);

  // 1. Base ------------------------------------------------------------------
  const base = must<{ id: string }>(
    "base",
    await db
      .from("ai_bases")
      .upsert({ base_code: NATCORP_BASE_CODE, name: NATCORP_BASE_NAME, active: true }, { onConflict: "base_code" })
      .select("id")
      .single(),
  );
  console.log(`  base ................. ok (${base.id})`);

  // 2. Documentação p/ RAG (opcional) ---------------------------------------
  if (spaceSlug) {
    const space = await db.from("spaces").select("id").eq("slug", spaceSlug).maybeSingle();
    if (space.error || !space.data) {
      console.warn(`  ⚠ documentação "${spaceSlug}" não encontrada — vincule uma na UI (Integrações → base).`);
    } else {
      must(
        "base_space",
        await db
          .from("ai_base_spaces")
          .upsert({ base_id: base.id, space_id: space.data.id, position: 0 }, { onConflict: "base_id,space_id" })
          .select("base_id")
          .single(),
      );
      console.log(`  documentação ........ ok (${spaceSlug})`);
    }
  } else {
    console.warn("  ⚠ NATCORP_SPACE_SLUG não definido — vincule a documentação na UI para o RAG/atendimento funcionar.");
  }

  // 3. Credencial OAuth + segredo cifrado ------------------------------------
  const cred = must<{ id: string }>(
    "credencial",
    await db
      .from("ai_base_credentials")
      .upsert(
        { base_id: base.id, name: NATCORP_CREDENTIAL_NAME, auth_type: "oauth2", active: true },
        { onConflict: "base_id,name" },
      )
      .select("id")
      .single(),
  );
  if (clientId && clientSecret) {
    const blob: Record<string, string> = {
      token_url: NATCORP_TOKEN_URL,
      client_id: clientId,
      client_secret: clientSecret,
    };
    if (sessionKey) blob.session_key = sessionKey;
    const secretEnc = encryptSecret(JSON.stringify(blob));
    must(
      "segredo",
      await db
        .from("ai_base_credential_secrets")
        .upsert({ credential_id: cred.id, secret_enc: secretEnc }, { onConflict: "credential_id" })
        .select("credential_id")
        .single(),
    );
    console.log(
      `  credencial .......... ok (${cred.id})` +
        `${secretEnc.startsWith("plain:") ? " [segredo em texto — defina APP_ENCRYPTION_KEY]" : " [cifrado]"}` +
        `${sessionKey ? " [+ login ORDS: valida usuário + CPF/perfil]" : " [sem session_key — assinatura/validação desativadas]"}`,
    );
  } else {
    console.warn(
      `  ⚠ credencial criada SEM segredo (${cred.id}). Defina NATCORP_OAUTH_CLIENT_ID/SECRET e rode de novo, ` +
        "ou preencha a credencial na UI de Integrações.",
    );
  }

  // Limpeza: a antiga `dados_colaborador` (endpoint errado) foi substituída pela
  // resolução de identidade no servidor (login ORDS). Remove-a (cascata nas
  // ativações e vínculos de agente). No-op após a 1ª execução.
  await db.from("ai_tools").delete().eq("key", "dados_colaborador");

  // 4. Catálogo de ferramentas ----------------------------------------------
  const toolIds: string[] = [];
  const toolIdByKey: Record<string, string> = {};
  for (const t of NATCORP_TOOLS) {
    const tool = must<{ id: string }>(
      `tool ${t.key}`,
      await db
        .from("ai_tools")
        .upsert(
          {
            key: t.key,
            name: t.name,
            description: t.description,
            method: t.method ?? "GET",
            path_template: t.path_template,
            auth_type: "oauth2",
            params: t.params as unknown as Json,
            response_hint: t.response_hint ?? null,
            body_mode: t.body_mode ?? null,
            guard: t.guard ?? null,
            active: t.active ?? true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        )
        .select("id")
        .single(),
    );
    toolIds.push(tool.id);
    toolIdByKey[t.key] = tool.id;

    // 5. Ativação por base (endpoint + credencial) ---------------------------
    must(
      `ativação ${t.key}`,
      await db
        .from("ai_base_tools")
        .upsert(
          { base_id: base.id, tool_id: tool.id, enabled: true, base_url: NATCORP_BASE_URL, credential_id: cred.id },
          { onConflict: "base_id,tool_id" },
        )
        .select("tool_id")
        .single(),
    );
  }
  console.log(`  ferramentas ......... ok (${toolIds.length} ativas)`);

  // 6. Agentes + vínculo com as ferramentas ---------------------------------
  for (const a of NATCORP_AGENTS) {
    const agent = must<{ id: string }>(
      `agente ${a.key}`,
      await db
        .from("ai_agents")
        .upsert(
          {
            key: a.key,
            name: a.name,
            description: a.description,
            system_prompt: a.system_prompt,
            requires_perfil: a.requires_perfil,
            active: true,
            priority: 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        )
        .select("id")
        .single(),
    );
    // Re-sincroniza o conjunto de tools do agente (idempotente).
    const del = await db.from("ai_agent_tools").delete().eq("agent_id", agent.id);
    if (del.error) {
      console.error(`✗ limpar vínculos do agente ${a.key}: ${del.error.message}`);
      process.exit(1);
    }
    const rows = a.toolKeys
      .map((k) => toolIdByKey[k])
      .filter((id): id is string => Boolean(id))
      .map((tool_id) => ({ agent_id: agent.id, tool_id }));
    const link = await db.from("ai_agent_tools").insert(rows);
    if (link.error) {
      console.error(`✗ vincular tools ao agente ${a.key}: ${link.error.message}`);
      process.exit(1);
    }
    console.log(
      `  agente .............. ok ${a.key} (${rows.length} tools${a.requires_perfil ? `, perfil=${a.requires_perfil}` : ""})`,
    );
  }

  console.log("Concluído. Confira em /admin/integracoes.");
}

main().catch((e) => {
  console.error("Falha inesperada:", e);
  process.exit(1);
});
