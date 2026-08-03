import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";
import {
  vocabularioDeModulos,
  filtrarContraVocab,
  type ModuleTag,
} from "@/lib/integrations/module-match";
import {
  type PerfilAnalise,
  chaveRelatorio,
  vocabHashDe,
  selecionarPerfil,
  comporPersona,
} from "./report-profile-core";

// Re-exporta os puros (tipo + funções) para os consumidores importarem daqui.
export { type PerfilAnalise, chaveRelatorio, selecionarPerfil, comporPersona } from "./report-profile-core";

/**
 * PERFIL DE AGENTE por MÓDULO para ANÁLISE DE RELATÓRIOS.
 *
 * Em modoRelatório, a PERSONA/especialização é escolhida pelo MÓDULO do relatório —
 * detectado por um classificador leve sobre TÍTULO + COLUNAS (cacheado por estrutura de
 * relatório, uma vez, não por mensagem). O perfil NÃO precisa de tools: a análise sai do
 * próprio relatório + RAG + ontologia. Autocontido: só usa `ai_agent_profiles` +
 * `ai_agent_profile_modules` (o vocabulário do classificador vem dos perfis).
 */

type DbClient = SupabaseClient<Database>;

// Cache de 60s dos perfis por base — evita reconsultar a cada turno.
const cachePerfis = new Map<string, { at: number; perfis: PerfilAnalise[] }>();

export async function carregarPerfis(db: DbClient, baseCode: string): Promise<PerfilAnalise[]> {
  const bc = (baseCode ?? "").trim();
  if (!bc) return [];
  // `base_code` é um slug (ex.: "natcorp"), mas o `p_base` chega do APEX em QUALQUER
  // caixa ("NATCORP"). Casar case-insensitive, igual a loadBaseContext — senão os perfis
  // (gravados minúsculos) nunca casam com o p_base maiúsculo e o recurso não ativa.
  const chave = bc.toLowerCase();
  const cached = cachePerfis.get(chave);
  if (cached && Date.now() - cached.at < 60_000) return cached.perfis;
  const alvo = bc.replace(/([\\%_])/g, "\\$1"); // escapa curinga do LIKE → match exato
  const { data } = await db
    .from("ai_agent_profiles")
    .select(
      "id, titulo, nome, descricao, cargo, comportamento, acoes, prompt_refino, requires_perfil, priority, ai_agent_profile_modules(modulo, submodulo)",
    )
    .ilike("base_code", alvo)
    .eq("active", true);
  type Row = {
    id: string; titulo: string; nome: string | null; descricao: string | null;
    cargo: string | null; comportamento: string | null; acoes: string[] | null;
    prompt_refino: string | null; requires_perfil: string | null; priority: number | null;
    ai_agent_profile_modules: { modulo: string; submodulo: string | null }[] | null;
  };
  const perfis: PerfilAnalise[] = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    titulo: r.titulo,
    nome: r.nome,
    descricao: r.descricao,
    cargo: r.cargo,
    comportamento: r.comportamento,
    acoes: Array.isArray(r.acoes) ? r.acoes : [],
    prompt_refino: r.prompt_refino,
    requires_perfil: r.requires_perfil,
    priority: r.priority ?? 0,
    modulos: (r.ai_agent_profile_modules ?? []).map((m) => ({ modulo: m.modulo, submodulo: m.submodulo ?? null })),
  }));
  cachePerfis.set(chave, { at: Date.now(), perfis });
  return perfis;
}

/** Classificador leve: título + colunas → módulos (dentre os que TÊM perfil). */
async function classificarRelatorio(
  nome: string,
  colunas: string[],
  vocab: { modulo: string; submodulos: string[] }[],
): Promise<ModuleTag[]> {
  if (!vocab.length) return [];
  if (!(await hasAiKey("query_rewrite"))) return [];
  try {
    const lista = vocab
      .map((v, i) => `${i + 1}. ${v.modulo}` + (v.submodulos.length ? ` — submódulos: ${v.submodulos.join(" | ")}` : ""))
      .join("\n");
    const { object } = await generateObject({
      model: await languageModel("query_rewrite"),
      abortSignal: aiTimeout("query_rewrite"),
      schema: z.object({
        modulos: z
          .array(z.object({ modulo: z.string(), submodulo: z.string().nullable().optional() }))
          .max(6)
          .optional(),
      }),
      prompt: `Você classifica um RELATÓRIO de um sistema de RH (Brasil) em um ou mais MÓDULOS, pelo TÍTULO e pelos NOMES DAS COLUNAS. Use EXATAMENTE os nomes da lista; em dúvida (sem relação clara), deixe vazio.

MÓDULOS DISPONÍVEIS:
${lista}

RELATÓRIO:
Título: ${nome}
Colunas: ${colunas.join(", ")}`,
    });
    return (object?.modulos ?? []).map((m) => ({ modulo: m.modulo, submodulo: m.submodulo ?? null }));
  } catch {
    return [];
  }
}

/** Detecta o(s) módulo(s) do relatório, com CACHE por estrutura (base + report_key). */
export async function detectarModulo(
  db: DbClient,
  baseCode: string,
  nome: string,
  colunas: string[],
  vocabTags: ModuleTag[],
): Promise<{ modulos: ModuleTag[]; cacheHit: boolean }> {
  const vocab = vocabularioDeModulos(vocabTags);
  if (!vocab.length) return { modulos: [], cacheHit: false };
  const key = chaveRelatorio(nome, colunas, vocabHashDe(vocabTags));
  const { data: hit } = await db
    .from("ai_report_module_cache")
    .select("modulos")
    .eq("base_code", baseCode)
    .eq("report_key", key)
    .maybeSingle();
  if (hit && Array.isArray((hit as { modulos?: unknown }).modulos)) {
    return { modulos: (hit as { modulos: ModuleTag[] }).modulos, cacheHit: true };
  }
  const modulos = filtrarContraVocab(await classificarRelatorio(nome, colunas, vocab), vocabTags);
  await db
    .from("ai_report_module_cache")
    .upsert({ base_code: baseCode, report_key: key, modulos, updated_at: new Date().toISOString() })
    .then(() => {}, () => {}); // best-effort: um erro de cache não pode quebrar o turno
  return { modulos, cacheHit: false };
}

/** Orquestrador para a rota: título + colunas do relatório → persona (ou null). */
export async function personaDeRelatorio(
  db: DbClient,
  baseCode: string,
  nome: string,
  colunas: string[],
  perfilUsuario: string | undefined,
): Promise<{ persona: string; titulo: string; modulos: string[]; cacheHit: boolean } | null> {
  if (!baseCode || !colunas.length) return null;
  const perfis = await carregarPerfis(db, baseCode);
  if (!perfis.length) return null;
  const vocabTags = perfis.flatMap((p) => p.modulos);
  if (!vocabTags.length) return null;
  const { modulos, cacheHit } = await detectarModulo(db, baseCode, nome, colunas, vocabTags);
  const perfil = selecionarPerfil(perfis, modulos, perfilUsuario);
  if (!perfil) return null;
  return {
    persona: comporPersona(perfil),
    titulo: perfil.titulo,
    modulos: modulos.map((m) => (m.submodulo ? `${m.modulo}/${m.submodulo}` : m.modulo)),
    cacheHit,
  };
}
