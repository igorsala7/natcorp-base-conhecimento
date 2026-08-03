"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/permissions";
import { enqueueApexIngest } from "@/lib/jobs/boss";
import { normalizarApexJson } from "@/lib/apex/metadata";
import { normalizarTermo } from "@/lib/ai/ontology";
import { idiomaNome } from "@/lib/i18n/languages";
import type { Json } from "@/lib/database.types";

type Ok = { ok: true; jobId?: string } | { ok: false; error: string };

/** Recebe o JSON de `pkg_apex_meta.f_app_json` (colado/upload) → cria e enfileira o job. */
export async function ingestApexJson(spaceId: string, jsonText: string): Promise<Ok> {
  try {
    await requirePermission("ai.configure", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  let meta: Json;
  try {
    meta = JSON.parse(jsonText) as Json;
  } catch {
    return { ok: false, error: "JSON inválido — cole a saída de pkg_apex_meta.f_app_json." };
  }
  if (!normalizarApexJson(meta)) return { ok: false, error: "Não reconheci o metadado (esperado o JSON de pkg_apex_meta)." };
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("data_dictionary_jobs")
    .insert({ space_id: spaceId, kind: "apex_ingest", input: { meta } })
    .select("id")
    .single();
  if (!job) return { ok: false, error: "Falha ao criar o job." };
  try {
    await enqueueApexIngest(job.id);
  } catch {
    await admin.from("data_dictionary_jobs").update({ status: "error", error: "Fila indisponível (worker parado?)." }).eq("id", job.id);
    return { ok: false, error: "Fila indisponível — o worker precisa estar rodando (npm run worker)." };
  }
  revalidatePath("/admin/ontologia");
  return { ok: true, jobId: job.id };
}

export type ApexJob = { id: string; kind: string; status: string; progress: number; found: number; error: string | null; result: unknown };

/** Jobs de ingestão recentes (progresso). */
export async function listApexJobs(spaceId: string): Promise<ApexJob[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("data_dictionary_jobs")
    .select("id, kind, status, progress, found, error, result")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data ?? []) as ApexJob[];
}

export type DicColuna = { table: string | null; column: string | null; label: string | null; labels: string[] };

/** O dicionário de COLUNAS (tabela·coluna·label) — a "planilha" para revisar/exportar. */
export async function listDataDictionaryColumns(spaceId: string): Promise<DicColuna[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("data_dictionary")
    .select("db_table, db_column, label, metadata")
    .eq("space_id", spaceId)
    .eq("kind", "column")
    .order("db_table", { ascending: true })
    .order("db_column", { ascending: true });
  return (data ?? []).map((r) => {
    const labels = (r.metadata as { labels?: unknown } | null)?.labels;
    return { table: r.db_table, column: r.db_column, label: r.label, labels: Array.isArray(labels) ? labels.map(String) : [] };
  });
}

/** CSV (;) do dicionário de colunas — MULTILÍNGUE (uma coluna por idioma habilitado,
 *  com a tradução da label vinda da ontologia). Para baixar a planilha. */
export async function dataDictionaryCsv(spaceId: string): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  try {
    await requirePermission("content.view", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const supabase = await createClient();
  const cols = await listDataDictionaryColumns(spaceId);

  // Idiomas ativos + traduções das labels (via ontologia: label → term_norm → tradução).
  const { data: langsData } = await supabase.from("space_languages").select("lang").eq("space_id", spaceId).eq("active", true);
  const langs = (langsData ?? []).map((r) => r.lang);
  const tradPorNorm = new Map<string, Map<string, string>>(); // term_norm → (lang → termo)
  if (langs.length) {
    const { data: terms } = await supabase.from("ontology_terms").select("id, term_norm").eq("space_id", spaceId);
    const normPorId = new Map((terms ?? []).map((t) => [t.id, t.term_norm]));
    const ids = [...normPorId.keys()];
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase.from("ontology_translations").select("term_id, lang, term").in("lang", langs).in("term_id", ids.slice(i, i + 200));
      for (const r of data ?? []) {
        const norm = normPorId.get(r.term_id);
        if (!norm) continue;
        let m = tradPorNorm.get(norm);
        if (!m) { m = new Map(); tradPorNorm.set(norm, m); }
        m.set(r.lang, r.term);
      }
    }
  }

  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const cab = ["Tabela", "Coluna", "Label (PT)", "Outras labels", ...langs.map((l) => idiomaNome(l) ?? l)];
  const linhas = [cab.map(esc).join(";")];
  for (const c of cols) {
    const norm = c.label ? normalizarTermo(c.label) : "";
    const tr = tradPorNorm.get(norm);
    const cells = [
      c.table ?? "",
      c.column ?? "",
      c.label ?? "",
      c.labels.filter((l) => l !== c.label).join(" | "),
      ...langs.map((l) => tr?.get(l) ?? ""),
    ];
    linhas.push(cells.map(esc).join(";"));
  }
  return { ok: true, csv: linhas.join("\n") };
}
