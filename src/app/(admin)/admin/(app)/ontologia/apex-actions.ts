"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/permissions";
import { enqueueApexIngest } from "@/lib/jobs/boss";
import { normalizarApexJson } from "@/lib/apex/metadata";
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

/** CSV (;) do dicionário de colunas — para baixar a planilha. */
export async function dataDictionaryCsv(spaceId: string): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  try {
    await requirePermission("content.view", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const cols = await listDataDictionaryColumns(spaceId);
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const linhas = [["Tabela", "Coluna", "Label", "Outras labels"].map(esc).join(";")];
  for (const c of cols) {
    linhas.push([c.table ?? "", c.column ?? "", c.label ?? "", c.labels.filter((l) => l !== c.label).join(" | ")].map(esc).join(";"));
  }
  return { ok: true, csv: linhas.join("\n") };
}
