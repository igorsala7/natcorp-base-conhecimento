import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secrets";
import type { AuthType } from "./credentials";
import type { LoopConfig, ToolParam } from "./tools";
import type { RuntimeTool, RuntimeCredential } from "./executor";
import { normalizarPanelScope } from "./panel-scope";
import { invalidateCatalogo } from "./tool-catalog";
import type { RegraDesempate } from "./tool-narrow";

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
  /** Allowlist de acesso (#4): portais/empresas/perfis liberados. Vazio = liberado. */
  portais: string[];
  empresas: string[];
  perfis: string[];
  /** Tags de assunto (Opção A): módulos/submódulos que esta tool serve. */
  modules: { modulo: string; submodulo: string | null }[];
  /** Tool "essencial": entra sempre, ignorando o roteamento por assunto. */
  alwaysInclude: boolean;
  /** Desempate numérico entre tools do mesmo `grupoAmbiguidade`. 0 = neutro. */
  prioridade: number;
  /** Grupo onde a prioridade compete (null = a prioridade não se aplica). */
  grupoAmbiguidade: string | null;
  /** Provedor da conta pessoal ('microsoft' | 'google') quando `identity_mode =
   *  'user'`; `null` nas demais. Sai daqui porque só este módulo sabe traduzir a
   *  credencial do catálogo em provedor — e o chat precisa do nome para dizer
   *  QUAL conta falta conectar. */
  provedorPessoal: string | null;
};
export type BaseContext = {
  baseId: string;
  name: string;
  tools: BaseToolContext[];
  /** Seleção de tools por assunto ligada para esta base (Opção A). */
  toolRouting: boolean;
  /** Desempates PAREADOS (catálogo global) — "quando as duas disputam, prefira X". */
  regrasDesempate: RegraDesempate[];
};

type EmbeddedRow = {
  base_url: string | null;
  credential_id: string | null;
  enabled: boolean;
  portais: string[] | null;
  empresas: string[] | null;
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
    /** Sinônimos e exemplos de frase — o vocabulário do usuário para esta tool. */
    search_terms: string | null;
    body_mode: string | null;
    guard: string | null;
    cache_ttl: number | null;
    cache_scope: string | null;
    loop: LoopConfig | null;
    endpoint_kind: string | null;
    external_url: string | null;
    credential_id: string | null;
    system_prompt: string | null;
    acao_em_lista: unknown;
    always_include: boolean | null;
    prioridade: number | null;
    grupo_ambiguidade: string | null;
    panel_scope: unknown;
    exclude_self: boolean | null;
    identity_mode: string | null;
    body_template: unknown;
    active: boolean;
  } | null;
};

// Cache EM MEMÓRIA do contexto da base (tools+params+módulos+agentes) — a config
// muda raramente mas era relida do Supabase A CADA MENSAGEM (custo que cresce com o
// nº de tools). TTL curto: mudança do admin reflete em ≤ TTL (e na hora, via
// invalidateBaseContext nas ações de edição). Por processo (o app roda em Docker,
// não serverless — o cache persiste entre requisições, como os de login/equipe).
type CtxCache = { exp: number; ctx: BaseContext | null };
const baseCtxCache = new Map<string, CtxCache>();
const BASE_CTX_TTL = 60_000;

/** Zera o cache do contexto da base (e do catálogo de embeddings). Chamado após
 *  editar tools/agentes para a mudança valer na hora, sem esperar o TTL. */
export function invalidateBaseContext(baseCode?: string): void {
  if (baseCode) baseCtxCache.delete(baseCode.trim().toLowerCase());
  else baseCtxCache.clear();
  invalidateCatalogo(baseCode);
}

/**
 * Base ATIVA + suas tools HABILITADAS (com base_url e credencial). Cacheado (TTL).
 *
 * Devolve sempre uma CÓPIA da lista de tools. O chamador filtra o catálogo por
 * PESSOA (conta conectada, painel, perfil, recorte) escrevendo em `ctx.tools` —
 * e escrever direto no objeto cacheado fazia o corte de um usuário valer para
 * todos os próximos 60 segundos, de todos os usuários daquela base.
 *
 * O sintoma, em 11/08/2026: a primeira pergunta de um turno cortava as 10
 * ferramentas Microsoft por falta de conta conectada (com trace e aviso, tudo
 * certo); a pergunta SEGUINTE, 36 segundos depois, já não encontrava ferramenta
 * pessoal nenhuma no contexto — sem corte, sem aviso, sem botão de conectar. A
 * ferramenta não tinha sumido do cadastro: tinha sumido do cache.
 */
export async function loadBaseContext(baseCode: string): Promise<BaseContext | null> {
  const chave = baseCode.trim().toLowerCase();
  const hit = baseCtxCache.get(chave);
  if (hit && hit.exp > Date.now()) return hit.ctx ? { ...hit.ctx, tools: [...hit.ctx.tools] } : null;
  const ctx = await carregarBaseContext(baseCode);
  baseCtxCache.set(chave, { exp: Date.now() + BASE_CTX_TTL, ctx });
  // Cópia também na primeira carga: o objeto que acabou de entrar no cache é o
  // mesmo que voltaria daqui, e a mutação do chamador o alcançaria igual.
  return ctx ? { ...ctx, tools: [...ctx.tools] } : null;
}

async function carregarBaseContext(baseCode: string): Promise<BaseContext | null> {
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
      "base_url, credential_id, enabled, portais, empresas, perfis, tool:ai_tools(id, key, name, description, search_terms, method, path_template, auth_type, identity_mode, body_template, params, response_hint, body_mode, guard, cache_ttl, cache_scope, loop, endpoint_kind, external_url, credential_id, system_prompt, always_include, prioridade, grupo_ambiguidade, panel_scope, exclude_self, acao_em_lista, active)",
    )
    .eq("base_id", base.id)
    .eq("enabled", true);

  const rows = (data ?? []) as unknown as EmbeddedRow[];

  // ── CREDENCIAL DA CONTA PESSOAL: sempre a DESTA base ────────────────────
  //
  // Ferramentas `identity_mode = 'user'` (Microsoft Graph, Gmail) são de
  // ENDPOINT EXTERNO, e endpoint externo herda a credencial do CATÁLOGO. Para
  // OAuth de aplicação isso está certo — o catálogo é global. Para conta
  // pessoal, não: o catálogo aponta para o registro no Entra de UM cliente, e
  // todas as bases herdavam esse mesmo id.
  //
  // A consequência era silenciosa e permanente. O consentimento
  // (`/api/v1/connect/*/start`) resolve a credencial pelo `p_base` — a da base
  // do usuário. A conexão era gravada nessa credencial, e a ferramenta
  // continuava perguntando pela credencial do catálogo: a conta aparecia como
  // "não conectada" para sempre, e o consentimento tinha sido dado ao app Azure
  // de outro cliente.
  //
  // Aqui a credencial vem do provedor: descobrimos qual é (pelo cadastro do
  // catálogo) e trocamos pela credencial `oauth2_user` do MESMO provedor NESTA
  // base. Sem essa credencial, a tool fica sem credencial — e sai do catálogo
  // no corte de disponibilidade, que é o resultado honesto: não há como esse
  // cliente conectar conta nenhuma enquanto o admin não cadastrar o registro
  // dele. NÃO há reserva para a credencial do catálogo: seria justamente
  // mandar o usuário de um cliente autenticar no app de outro.
  const credsPessoaisCatalogo = [
    ...new Set(
      rows
        .filter((r) => r.tool?.identity_mode === "user" && r.tool.credential_id)
        .map((r) => r.tool!.credential_id as string),
    ),
  ];
  /** provider (catálogo) → credencial oauth2_user desta base. */
  const credPessoalDaBase = new Map<string, string>();
  /** credencial do catálogo → provider, para traduzir tool → provider. */
  const providerDaCredCatalogo = new Map<string, string>();
  if (credsPessoaisCatalogo.length > 0) {
    const [{ data: catalogo }, { data: disponiveis }] = await Promise.all([
      db.from("ai_base_credentials").select("id, provider").in("id", credsPessoaisCatalogo),
      // A da BASE ou a GLOBAL — a mesma cascata de `idCredencialPessoal` (o
      // consentimento usa aquela; se as duas divergirem, a conta conecta numa
      // credencial e a ferramenta pergunta pela outra, que foi o defeito de
      // 11/08/2026). Global existe porque a URL de callback do sistema é única:
      // só um registro no provedor pode funcionar.
      db
        .from("ai_base_credentials")
        .select("id, provider, base_id, is_global")
        .eq("auth_type", "oauth2_user")
        .eq("active", true)
        .or(`base_id.eq.${base.id},is_global.is.true`),
    ]);
    for (const c of catalogo ?? []) if (c.provider) providerDaCredCatalogo.set(c.id, c.provider);
    for (const c of disponiveis ?? []) {
      if (!c.provider) continue;
      // A própria vence a global quando as duas existem.
      if (!credPessoalDaBase.has(c.provider) || c.base_id === base.id) {
        credPessoalDaBase.set(c.provider, c.id);
      }
    }
  }

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
    // Conta PESSOAL: a credencial é a desta base, pelo provedor (ver acima).
    const pessoal = t.identity_mode === "user";
    const provedorPessoal = pessoal ? providerDaCredCatalogo.get(t.credential_id ?? "") ?? null : null;
    const credentialId = pessoal
      ? credPessoalDaBase.get(provedorPessoal ?? "") ?? null
      : externa
        ? t.credential_id
        : (base.credential_id ?? r.credential_id);
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
        search_terms: t.search_terms,
        body_mode: t.body_mode,
        guard: t.guard,
        cache_ttl: t.cache_ttl,
        cache_scope: t.cache_scope,
        loop: t.loop,
        system_prompt: t.system_prompt,
        acao_em_lista: t.acao_em_lista,
        panel_scope: normalizarPanelScope(t.panel_scope),
        exclude_self: t.exclude_self === true,
        // 'user' = so roda com o token pessoal de quem perguntou.
        identity_mode: t.identity_mode ?? "service",
        body_template: t.body_template ?? null,
      },
      baseUrl,
      credentialId,
      portais: r.portais ?? [],
      empresas: r.empresas ?? [],
      perfis: r.perfis ?? [],
      modules: tagsPorTool.get(t.id) ?? [],
      alwaysInclude: t.always_include === true,
      prioridade: t.prioridade ?? 0,
      grupoAmbiguidade: t.grupo_ambiguidade?.trim() || null,
      provedorPessoal,
    });
  }

  // Desempates pareados. Tabela pequena (uma linha por colisão declarada) e o
  // contexto todo já é cacheado por 60s — lê junto, em chave, não por tool.
  const regrasDesempate: RegraDesempate[] = [];
  if (tools.length) {
    const keyPorId = new Map(tools.map((t) => [t.toolId, t.tool.key]));
    const { data: regras } = await db
      .from("ai_tool_priority_rules")
      .select("winner_tool_id, loser_tool_id, modo");
    for (const r of regras ?? []) {
      const vencedora = keyPorId.get(r.winner_tool_id);
      const perdedora = keyPorId.get(r.loser_tool_id);
      // Regra cuja dupla não vive nesta base é ruído — nem entra no contexto.
      if (!vencedora || !perdedora) continue;
      regrasDesempate.push({ vencedora, perdedora, modo: r.modo === "sempre" ? "sempre" : "empate" });
    }
  }
  return { baseId: base.id, name: base.name, tools, toolRouting: base.tool_routing === true, regrasDesempate };
}

/** Resolve UM tool de uma base pelo `key` (base_url + credencial + path_template,
 *  respeitando herança base↔tool e endpoint externo). Usado por integrações do
 *  servidor onde o CAMINHO é registrado como tool (ex.: consulta de IR via ORDS) —
 *  nada fixo no código; o path fica no cadastro da tool, distinto por base. */
export async function loadBaseTool(
  baseCode: string,
  toolKey: string,
): Promise<{ baseUrl: string | null; credentialId: string | null; pathTemplate: string; method: string } | null> {
  const db = createAdminClient();
  const alvo = baseCode.trim().replace(/([\\%_])/g, "\\$1");
  const { data: base } = await db
    .from("ai_bases")
    .select("id, base_url, credential_id")
    .ilike("base_code", alvo)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (!base) return null;

  const { data } = await db
    .from("ai_base_tools")
    .select("base_url, credential_id, tool:ai_tools(key, path_template, method, endpoint_kind, external_url, credential_id, active)")
    .eq("base_id", base.id)
    .eq("enabled", true);

  const alvoKey = toolKey.trim().toLowerCase();
  const rows = (data ?? []) as unknown as {
    base_url: string | null;
    credential_id: string | null;
    tool: { key: string; path_template: string; method: string; endpoint_kind: string | null; external_url: string | null; credential_id: string | null; active: boolean } | null;
  }[];
  const row = rows.find((r) => r.tool && r.tool.key.trim().toLowerCase() === alvoKey);
  if (!row?.tool) return null;

  const t = row.tool;
  const externa = t.endpoint_kind === "external";
  const baseUrl = externa ? t.external_url : (base.base_url ?? row.base_url);
  const credentialId = externa ? t.credential_id : (base.credential_id ?? row.credential_id);
  return { baseUrl, credentialId, pathTemplate: t.path_template ?? "", method: (t.method || "POST").toUpperCase() };
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
