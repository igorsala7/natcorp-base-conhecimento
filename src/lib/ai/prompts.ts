import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCategory } from "@/lib/ai/prompt-registry";
import { tempLayout, tempTexto, type Criatividade } from "@/lib/ai/creativity";

/**
 * Resolve os prompts/temperaturas parametrizáveis: usa o override gravado em
 * `prompt_overrides` quando existe, senão o default do código (registry).
 * Cache curto (30 s), invalidado ao salvar — mesmo padrão da config de IA.
 */
const TTL_MS = 30_000;
let cache: { at: number; data: Map<string, Record<string, string>> } | null = null;

async function loadOverrides(): Promise<Map<string, Record<string, string>>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const admin = createAdminClient();
  const { data } = await admin.from("prompt_overrides").select("key, fields");
  const m = new Map<string, Record<string, string>>();
  for (const row of data ?? []) {
    const f = row.fields as Record<string, unknown> | null;
    if (f && typeof f === "object") {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(f)) if (typeof v === "string") clean[k] = v;
      m.set(row.key, clean);
    }
  }
  cache = { at: Date.now(), data: m };
  return m;
}

export function invalidatePromptCache(): void {
  cache = null;
}

/** Todos os campos de uma categoria, já com override aplicado sobre os defaults. */
export async function resolveCategory(catKey: string): Promise<Record<string, string>> {
  const cat = getCategory(catKey);
  if (!cat) return {};
  const overrides = (await loadOverrides()).get(catKey) ?? {};
  const out: Record<string, string> = {};
  for (const f of cat.fields) {
    const ov = overrides[f.key];
    out[f.key] = typeof ov === "string" && ov.trim() !== "" ? ov : String(f.default);
  }
  return out;
}

/** Um campo de texto (com override ou default). */
export async function promptField(catKey: string, fieldKey: string): Promise<string> {
  return (await resolveCategory(catKey))[fieldKey] ?? "";
}

/** Substitui marcadores {{campo}} num template. */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

// ── Temperaturas (Criatividade) — resolvidas no servidor ──────────────────────
async function tempNumber(fieldKey: string, fallback: number): Promise<number> {
  const raw = (await loadOverrides()).get("criatividade")?.[fieldKey];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Temperatura do "Melhorar layout" para um nível — override do banco ou código. */
export async function resolveTempLayout(c: Criatividade): Promise<number> {
  return tempNumber(`layout_${c}`, tempLayout(c));
}

/** Temperatura da "IA no texto" para um nível — override do banco ou código. */
export async function resolveTempTexto(c: Criatividade): Promise<number> {
  return tempNumber(`texto_${c}`, tempTexto(c));
}
