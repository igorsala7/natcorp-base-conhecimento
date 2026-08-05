"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import type { Json } from "@/lib/database.types";
import type { IntegResult } from "./actions";
import { listarPerfis } from "@/lib/integrations/perfis";
import { syncToolEmbedding } from "@/lib/integrations/tool-catalog";
import { invalidateBaseContext } from "@/lib/integrations/resolve";

async function garantirPermissao(): Promise<string | null> {
  try {
    await requirePermission("integrations.manage", null);
    return null;
  } catch {
    return "Sem permissão para gerenciar integrações.";
  }
}

// ─────────────────────────────── Params ─────────────────────────────────────
const paramSchema = z.object({
  nome: z.string().trim().min(1, "Todo parâmetro precisa de nome."),
  descricao: z.string().trim().default(""),
  tipo: z.enum(["string", "number", "date", "enum", "boolean"]),
  origem: z.enum(["modelo", "identidade", "fixo", "credencial", "pessoa"]),
  obrigatorio: z.boolean().default(false),
  local: z.enum(["query", "path", "body", "header", "none"]).default("query"),
  mascara: z.string().nullish(),
  opcoes: z.array(z.string()).optional(),
  campoIdentidade: z.enum(["usuario", "cod_empresa", "matricula", "perfil", "portal", "cpf", "base"]).nullish(),
  valorFixo: z.string().nullish(),
  campoCredencial: z.string().nullish(),
  // Preserva o segmento composto no path (ex.: enum "empresa/filial" do bi_risco) — sem
  // isto, o Zod removia rawPath ao salvar e o {agrupamento} quebrava (barras encodadas).
  rawPath: z.boolean().nullish(),
});

/** Loop/expansão — ver LoopConfig / ai_tools.loop. `month` usa from/to; `values` só param. */
const loopSchema = z.object({
  unit: z.enum(["month", "values", "batch"]),
  param: z.string().trim().min(1),
  from: z.string().trim().nullish(),
  to: z.string().trim().nullish(),
  max: z.number().int().positive().nullish(),
});

/** Escopo de dados por painel (PO/PG/PC) — ver ai_tools.panel_scope / panel-scope.ts. */
const escopoPainelEnum = z.enum(["todos", "equipe", "proprios", "nenhum"]);
const panelScopeSchema = z
  .object({
    PO: escopoPainelEnum.optional(),
    PG: escopoPainelEnum.optional(),
    PC: escopoPainelEnum.optional(),
  })
  .nullish();

const toolSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .min(1, "Informe uma chave.")
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Chave: só minúsculas, números e _."),
  name: z.string().trim().min(1, "Informe um nome.").max(200),
  description: z.string().trim().min(1, "Descreva o que a API faz (a IA usa isto)."),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path_template: z.string().trim().default(""),
  auth_type: z.enum(["none", "basic", "api_key", "bearer", "oauth2"]),
  params: z.array(paramSchema).default([]),
  response_hint: z.string().trim().nullish(),
  search_terms: z.string().trim().nullish(),
  active: z.boolean().default(true),
  // Roteamento por assunto (Opção A): essencial (entra sempre) + tags de módulo.
  always_include: z.boolean().default(false),
  modulos: z
    .array(z.object({ modulo: z.string().trim().min(1), submodulo: z.string().trim().nullish() }))
    .optional(),
  // Reestrutura: endpoint externo + prompt próprio + campos avançados.
  endpoint_kind: z.enum(["base", "external"]).default("base"),
  external_url: z.string().trim().nullish(),
  credential_id: z.string().uuid().nullish(),
  system_prompt: z.string().trim().default(""),
  body_mode: z.string().trim().nullish(),
  guard: z.string().trim().nullish(),
  cache_ttl: z.number().int().positive().nullish(),
  cache_scope: z.enum(["user", "empresa", "global"]).default("user"),
  loop: loopSchema.nullish(),
  // Escopo por painel (PO/PG/PC) + "nunca os próprios" (ex.: desligamento).
  panel_scope: panelScopeSchema,
  exclude_self: z.boolean().default(false),
  /**
   * Acesso por base: cada base onde a tool fica ATIVA, com as allowlists de
   * PORTAL e PERFIL (#4). Vazio = liberado. `undefined` = não mexe nas bases.
   */
  bases: z
    .array(
      z.object({
        id: z.string().uuid(),
        portais: z.array(z.string().trim().min(1).max(20)).default([]),
        empresas: z.array(z.string().trim().min(1).max(40)).default([]),
        perfis: z.array(z.string().trim().min(1).max(80)).default([]),
      }),
    )
    .optional(),
});

export async function saveTool(input: unknown): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = toolSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const t = parsed.data;

  const externa = t.endpoint_kind === "external";
  const supabase = await createClient();
  const linha = {
    key: t.key,
    name: t.name,
    description: t.description,
    method: t.method,
    path_template: t.path_template,
    auth_type: t.auth_type,
    params: t.params as unknown as Json,
    response_hint: t.response_hint?.trim() || null,
    search_terms: t.search_terms?.trim() || "",
    active: t.active,
    always_include: t.always_include,
    endpoint_kind: t.endpoint_kind,
    external_url: externa ? t.external_url?.trim() || null : null,
    credential_id: externa ? t.credential_id ?? null : null,
    system_prompt: t.system_prompt ?? "",
    body_mode: t.body_mode?.trim() || null,
    guard: t.guard?.trim() || null,
    cache_ttl: t.cache_ttl ?? null,
    cache_scope: t.cache_scope,
    loop: (t.loop ?? null) as unknown as Json,
    panel_scope: (t.panel_scope ?? null) as unknown as Json,
    exclude_self: t.exclude_self,
    updated_at: new Date().toISOString(),
  };

  let toolId = t.id;
  if (t.id) {
    const { error } = await supabase.from("ai_tools").update(linha).eq("id", t.id);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Já existe uma tool com essa chave." };
      return { ok: false, error: `Falha ao salvar: ${error.message}` };
    }
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("ai_tools")
      .insert({ ...linha, created_by: user?.id ?? null })
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") return { ok: false, error: "Já existe uma tool com essa chave." };
      return { ok: false, error: `Falha ao criar: ${error?.message}` };
    }
    toolId = data.id;
  }

  // Catálogo semântico: recalcula o embedding (name + description) da tool para o
  // roteador de fonte do chat casar a mensagem com a tool certa. Best-effort — não
  // derruba o salvamento se o provedor de embedding falhar.
  await syncToolEmbedding(supabase, toolId!, t.name, t.description, { searchTerms: t.search_terms, responseHint: t.response_hint });

  // Acesso por base: reescreve ai_base_tools (enabled + allowlists portal/perfil)
  // a partir do editor de bases. Só quando `bases` foi enviado (o diálogo sempre
  // envia a seleção atual).
  if (t.bases) {
    await supabase.from("ai_base_tools").delete().eq("tool_id", toolId!);
    if (t.bases.length) {
      const byId = new Map(t.bases.map((b) => [b.id, b])); // dedup: última vence
      await supabase.from("ai_base_tools").insert(
        [...byId.values()].map((b) => ({
          base_id: b.id,
          tool_id: toolId!,
          enabled: true,
          portais: [...new Set(b.portais)],
          empresas: [...new Set(b.empresas)],
          perfis: [...new Set(b.perfis)],
        })),
      );
    }
  }

  // Tags de módulo (roteamento por assunto). Vínculo GLOBAL (produto), em texto,
  // desacoplado do cache recarregável. Só reescreve quando `modulos` foi enviado.
  if (t.modulos) {
    await supabase.from("ai_tool_modules").delete().eq("tool_id", toolId!);
    if (t.modulos.length) {
      const vistos = new Set<string>();
      const linhas: { tool_id: string; modulo: string; submodulo: string | null }[] = [];
      for (const m of t.modulos) {
        const sub = m.submodulo?.trim() || null;
        const chave = `${m.modulo} ${sub ?? ""}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        linhas.push({ tool_id: toolId!, modulo: m.modulo, submodulo: sub });
      }
      if (linhas.length) await supabase.from("ai_tool_modules").insert(linhas);
    }
  }

  await audit({
    action: t.id ? "integrations.tool.update" : "integrations.tool.create",
    entityType: "ai_tool",
    entityId: toolId!,
    spaceId: null,
    after: { key: t.key, endpoint_kind: t.endpoint_kind, bases: t.bases?.length, modulos: t.modulos?.length },
  });
  invalidateBaseContext();
  revalidatePath("/admin/integracoes");
  return { ok: true, id: toolId };
}

/**
 * Atualiza flags de nível-tool (catálogo, global) de UMA ou VÁRIAS tools de uma
 * vez — usado pela edição inline da tabela e pela edição em lote (Fase C). Só
 * grava os campos ENVIADOS (patch parcial). `loop: null` desliga o loop.
 */
const flagsSchema = z
  .object({
    toolIds: z.array(z.string().uuid()).min(1, "Selecione ao menos uma tool."),
    active: z.boolean().optional(),
    always_include: z.boolean().optional(),
    loop: loopSchema.nullable().optional(),
    cache_ttl: z.number().int().min(0).nullable().optional(),
    panel_scope: panelScopeSchema,
    exclude_self: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.active !== undefined ||
      v.always_include !== undefined ||
      v.loop !== undefined ||
      v.cache_ttl !== undefined ||
      v.panel_scope !== undefined ||
      v.exclude_self !== undefined,
    { message: "Nada para alterar." },
  );

export async function setToolFlags(input: unknown): Promise<IntegResult & { count?: number }> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = flagsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { toolIds, active, always_include, loop, cache_ttl, panel_scope, exclude_self } = parsed.data;

  const patch: {
    updated_at: string;
    active?: boolean;
    always_include?: boolean;
    loop?: Json;
    cache_ttl?: number | null;
    panel_scope?: Json;
    exclude_self?: boolean;
  } = { updated_at: new Date().toISOString() };
  if (active !== undefined) patch.active = active;
  if (always_include !== undefined) patch.always_include = always_include;
  if (loop !== undefined) patch.loop = (loop ?? null) as unknown as Json;
  // 0 (ou vazio) desliga o cache → grava NULL.
  if (cache_ttl !== undefined) patch.cache_ttl = cache_ttl && cache_ttl > 0 ? cache_ttl : null;
  if (panel_scope !== undefined) patch.panel_scope = (panel_scope ?? null) as unknown as Json;
  if (exclude_self !== undefined) patch.exclude_self = exclude_self;

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("ai_tools")
    .update(patch, { count: "exact" })
    .in("id", [...new Set(toolIds)]);
  if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };
  await audit({
    action: "integrations.tool.flags",
    entityType: "ai_tool",
    entityId: toolIds.length === 1 ? toolIds[0] : `${toolIds.length} tools`,
    spaceId: null,
    after: {
      active,
      always_include,
      loop: loop === undefined ? undefined : !!loop,
      cache_ttl,
      panel_scope: panel_scope === undefined ? undefined : panel_scope,
      exclude_self,
      count: count ?? toolIds.length,
    },
  });
  invalidateBaseContext();
  revalidatePath("/admin/integracoes");
  return { ok: true, count: count ?? toolIds.length };
}

// ───────────────────────── Edição em LOTE (Fase C) ──────────────────────────

const moduleTagSchema = z.object({ modulo: z.string().trim().min(1), submodulo: z.string().trim().nullish() });

/** Adiciona/remove tags de módulo em VÁRIAS tools de uma vez (roteamento). */
const bulkModulesSchema = z.object({
  toolIds: z.array(z.string().uuid()).min(1, "Selecione ao menos uma tool."),
  op: z.enum(["add", "remove"]),
  modulos: z.array(moduleTagSchema).min(1, "Escolha ao menos um módulo."),
});

export async function bulkSetToolModules(input: unknown): Promise<IntegResult & { count?: number }> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = bulkModulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { toolIds, op, modulos } = parsed.data;
  const ids = [...new Set(toolIds)];
  const supabase = await createClient();

  for (const m of modulos) {
    const submodulo = m.submodulo?.trim() || null;
    // Sempre remove primeiro (idempotência do 'add', ação do 'remove').
    let del = supabase.from("ai_tool_modules").delete().in("tool_id", ids).eq("modulo", m.modulo);
    del = submodulo === null ? del.is("submodulo", null) : del.eq("submodulo", submodulo);
    const { error: delErr } = await del;
    if (delErr) return { ok: false, error: `Falha: ${delErr.message}` };
    if (op === "add") {
      const { error: insErr } = await supabase
        .from("ai_tool_modules")
        .insert(ids.map((tool_id) => ({ tool_id, modulo: m.modulo, submodulo })));
      if (insErr) return { ok: false, error: `Falha: ${insErr.message}` };
    }
  }
  await audit({ action: "integrations.tool.bulk_modules", entityType: "ai_tool", entityId: `${ids.length} tools`, spaceId: null, after: { op, modulos: modulos.length } });
  invalidateBaseContext();
  revalidatePath("/admin/integracoes");
  return { ok: true, count: ids.length };
}

/** União/diferença case-insensitive, preservando a ordem e os valores atuais. */
function mergeList(cur: string[], op: "add" | "remove", vals: string[]): string[] {
  if (vals.length === 0) return cur;
  const alvo = new Set(vals.map((s) => s.toLowerCase()));
  if (op === "remove") return cur.filter((x) => !alvo.has(x.toLowerCase()));
  const out = [...cur];
  const seen = new Set(cur.map((s) => s.toLowerCase()));
  for (const v of vals) {
    const k = v.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out;
}

/**
 * Adiciona/remove PORTAL/EMPRESA/PERFIL da allowlist de VÁRIAS tools numa base.
 * Listas vazias não mexem naquela dimensão. Tools não ativas na base são PULADAS,
 * a menos que `ativar` (só faz sentido no 'add'), que as cria já ativas.
 */
const bulkAccessSchema = z
  .object({
    toolIds: z.array(z.string().uuid()).min(1, "Selecione ao menos uma tool."),
    baseId: z.string().uuid(),
    op: z.enum(["add", "remove"]),
    portais: z.array(z.string().trim().min(1).max(20)).default([]),
    empresas: z.array(z.string().trim().min(1).max(40)).default([]),
    perfis: z.array(z.string().trim().min(1).max(80)).default([]),
    ativar: z.boolean().default(false),
  })
  .refine((v) => v.portais.length + v.empresas.length + v.perfis.length > 0, {
    message: "Informe ao menos um portal, empresa ou perfil.",
  });

export async function bulkSetToolAccess(
  input: unknown,
): Promise<IntegResult & { count?: number; puladas?: number }> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = bulkAccessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { toolIds, baseId, op, portais, empresas, perfis, ativar } = parsed.data;
  const ids = [...new Set(toolIds)];
  const supabase = await createClient();

  const { data: existentes } = await supabase
    .from("ai_base_tools")
    .select("tool_id, portais, empresas, perfis")
    .eq("base_id", baseId)
    .in("tool_id", ids);
  const porTool = new Map((existentes ?? []).map((r) => [r.tool_id, r]));

  let aplicadas = 0;
  let puladas = 0;
  for (const toolId of ids) {
    const row = porTool.get(toolId);
    if (!row) {
      if (op !== "add" || !ativar) { puladas++; continue; }
      const { error } = await supabase.from("ai_base_tools").insert({
        base_id: baseId,
        tool_id: toolId,
        enabled: true,
        portais: mergeList([], "add", portais),
        empresas: mergeList([], "add", empresas),
        perfis: mergeList([], "add", perfis),
      });
      if (error) return { ok: false, error: `Falha: ${error.message}` };
      aplicadas++;
      continue;
    }
    const { error } = await supabase
      .from("ai_base_tools")
      .update({
        portais: mergeList(row.portais ?? [], op, portais),
        empresas: mergeList(row.empresas ?? [], op, empresas),
        perfis: mergeList(row.perfis ?? [], op, perfis),
      })
      .eq("base_id", baseId)
      .eq("tool_id", toolId);
    if (error) return { ok: false, error: `Falha: ${error.message}` };
    aplicadas++;
  }
  await audit({ action: "integrations.tool.bulk_access", entityType: "ai_base_tool", entityId: `${aplicadas} tools`, spaceId: null, after: { baseId, op, portais, empresas, perfis, ativar, aplicadas, puladas } });
  invalidateBaseContext();
  revalidatePath("/admin/integracoes");
  return { ok: true, count: aplicadas, puladas };
}

/**
 * DUPLICA uma tool para facilitar cadastrar outra parecida: copia TODOS os campos
 * (método, caminho, parâmetros, guard, loop, prompt…), os vínculos de base (ativações +
 * allowlists portal/empresa/perfil) e as tags de módulo. A cópia nasce com chave única
 * (`<key>_copia`) e INATIVA — assim não dispara no chat até o admin ajustar e ativar.
 */
export async function duplicateTool(id: string): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Ferramenta inválida." };
  const supabase = await createClient();

  const { data: orig, error: e0 } = await supabase
    .from("ai_tools")
    .select(
      "key, name, description, method, path_template, auth_type, params, response_hint, always_include, endpoint_kind, external_url, credential_id, system_prompt, body_mode, guard, cache_ttl, cache_scope, loop, panel_scope, exclude_self",
    )
    .eq("id", id)
    .single();
  if (e0 || !orig) return { ok: false, error: "Ferramenta não encontrada." };

  // Chave única: <key>_copia, _copia2, _copia3… (respeita o teto de 80 chars).
  const bruta = orig.key.slice(0, 72);
  const { data: existentes } = await supabase.from("ai_tools").select("key").ilike("key", `${bruta}_copia%`);
  const usadas = new Set((existentes ?? []).map((r) => r.key));
  let novaKey = `${bruta}_copia`;
  for (let n = 2; usadas.has(novaKey); n++) novaKey = `${bruta}_copia${n}`;

  const { data: { user } } = await supabase.auth.getUser();
  const nome = `${orig.name} (cópia)`.slice(0, 200);
  const now = new Date().toISOString();
  const { data: nova, error: e1 } = await supabase
    .from("ai_tools")
    .insert({ ...orig, key: novaKey, name: nome, active: false, created_by: user?.id ?? null, created_at: now, updated_at: now })
    .select("id")
    .single();
  if (e1 || !nova) {
    if (e1?.code === "23505") return { ok: false, error: "Conflito de chave ao duplicar — tente novamente." };
    return { ok: false, error: `Falha ao duplicar: ${e1?.message}` };
  }

  // Vínculos de base (ativações + allowlists) e tags de módulo.
  const { data: bases } = await supabase.from("ai_base_tools").select("base_id, enabled, portais, empresas, perfis").eq("tool_id", id);
  if (bases?.length) await supabase.from("ai_base_tools").insert(bases.map((b) => ({ ...b, tool_id: nova.id })));
  const { data: mods } = await supabase.from("ai_tool_modules").select("modulo, submodulo").eq("tool_id", id);
  if (mods?.length) await supabase.from("ai_tool_modules").insert(mods.map((m) => ({ ...m, tool_id: nova.id })));

  await syncToolEmbedding(supabase, nova.id, nome, orig.description);
  await audit({ action: "integrations.tool.duplicate", entityType: "ai_tool", entityId: nova.id, spaceId: null, after: { from: id, key: novaKey } });
  invalidateBaseContext();
  revalidatePath("/admin/integracoes");
  return { ok: true, id: nova.id };
}

export async function deleteTool(id: string): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const supabase = await createClient();
  // As ativações por base (ai_base_tools) e os vínculos com agentes caem por cascade.
  const { error } = await supabase.from("ai_tools").delete().eq("id", id);
  if (error) return { ok: false, error: `Falha ao excluir: ${error.message}` };
  await audit({ action: "integrations.tool.delete", entityType: "ai_tool", entityId: id, spaceId: null });
  invalidateBaseContext();
  revalidatePath("/admin/integracoes");
  return { ok: true };
}

// ─────────── Ativação de UMA tool em UMA base (ai_base_tools.enabled) ─────────
// A URL base e a credencial vivem na base/tool (não mais aqui); resta só o flag.
const baseToolSchema = z.object({
  baseId: z.string().uuid(),
  toolId: z.string().uuid(),
  enabled: z.boolean().default(true),
});

export async function setBaseTool(input: unknown): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = baseToolSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { baseId, toolId, enabled } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_base_tools")
    .upsert({ base_id: baseId, tool_id: toolId, enabled }, { onConflict: "base_id,tool_id" });
  if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };
  await audit({ action: "integrations.base_tool.set", entityType: "ai_base_tool", entityId: `${baseId}:${toolId}`, spaceId: null, after: { enabled } });
  invalidateBaseContext();
  revalidatePath("/admin/integracoes");
  return { ok: true };
}

export async function removeBaseTool(baseId: string, toolId: string): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const supabase = await createClient();
  const { error } = await supabase.from("ai_base_tools").delete().eq("base_id", baseId).eq("tool_id", toolId);
  if (error) return { ok: false, error: `Falha ao remover: ${error.message}` };
  await audit({ action: "integrations.base_tool.remove", entityType: "ai_base_tool", entityId: `${baseId}:${toolId}`, spaceId: null });
  invalidateBaseContext();
  revalidatePath("/admin/integracoes");
  return { ok: true };
}

// ─────── Perfis do cliente (API da base) para popular a allowlist (#4) ────────
export async function listarPerfisDaBase(
  baseId: string,
): Promise<{ ok: boolean; perfis?: string[]; error?: string }> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  if (!z.string().uuid().safeParse(baseId).success) return { ok: false, error: "Base inválida." };
  try {
    return { ok: true, perfis: await listarPerfis(baseId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao buscar perfis." };
  }
}
