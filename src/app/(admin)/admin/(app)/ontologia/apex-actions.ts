"use server";

import { revalidatePath } from "next/cache";
import { motivoFila } from "@/lib/jobs/motivo-fila";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/permissions";
import { enqueueApexIngest, enqueueApexDocs, enqueueDbIngest, enqueueDbDocs } from "@/lib/jobs/boss";
import { normalizarApexJson } from "@/lib/apex/metadata";
import { normalizarDbJson } from "@/lib/dbobjects/metadata";
import { normalizarTermo } from "@/lib/ai/ontology";
import { idiomaNome } from "@/lib/i18n/languages";
import type { Json } from "@/lib/database.types";
import { fetchAllPaged } from "@/lib/supabase/paginate";

type Ok = { ok: true; jobId?: string } | { ok: false; error: string };

/** Recebe o JSON de `pkg_apex_meta.f_app_json` (colado/upload) → cria e enfileira o job. */
/**
 * O metadado vem por UM de dois caminhos, e a escolha é de tamanho:
 *
 *  · `jsonText` — colado no textarea. Cabe até ~7 MB, o limite prático de uma
 *    Server Action, e é o caminho natural para app pequeno.
 *  · `storagePath` — o arquivo já subiu para o Storage pelo navegador. É o
 *    único caminho possível para os 22 MB de um `f200.json` real: um corpo
 *    desse tamanho numa Server Action seria carregado inteiro na memória de um
 *    worker do Next, que não é onde esse trabalho pertence.
 *
 * Validar o conteúdo aqui exigiria BAIXAR os 22 MB de volta só para conferir o
 * formato — a validação fica no worker, que é quem já vai lê-lo de qualquer
 * jeito. O que se valida aqui é o que é barato: que veio um dos dois.
 */
export async function ingestApexJson(
  spaceId: string,
  entrada: { jsonText?: string; storagePath?: string },
): Promise<Ok> {
  try {
    await requirePermission("ai.configure", spaceId);
  } catch (e) {
    return { ok: false, error: "Sem permissão." };
  }
  let input: { meta?: Json; storagePath?: string };
  if (entrada.storagePath) {
    input = { storagePath: entrada.storagePath };
  } else if (entrada.jsonText?.trim()) {
    let meta: Json;
    try {
      meta = JSON.parse(entrada.jsonText) as Json;
    } catch {
      return { ok: false, error: "JSON inválido — cole a saída de pkg_apex_meta.f_app_json." };
    }
    if (!normalizarApexJson(meta)) {
      return { ok: false, error: "Não reconheci o metadado (esperado o JSON de pkg_apex_meta)." };
    }
    input = { meta };
  } else {
    return { ok: false, error: "Cole o JSON ou envie o arquivo." };
  }
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("data_dictionary_jobs")
    .insert({ space_id: spaceId, kind: "apex_ingest", input })
    .select("id")
    .single();
  if (!job) return { ok: false, error: "Falha ao criar o job." };
  try {
    await enqueueApexIngest(job.id);
  } catch (e) {
    await admin.from("data_dictionary_jobs").update({ status: "error", error: "Fila indisponível (worker parado?)." }).eq("id", job.id);
    return { ok: false, error: motivoFila(e) };
  }
  revalidatePath("/admin/ontologia");
  return { ok: true, jobId: job.id };
}

/** Gera a DOCUMENTAÇÃO por página (usuário + técnica) na base, a partir do mesmo JSON. */
/**
 * O metadado vem por UM de dois caminhos, e a escolha é de tamanho:
 *
 *  · `jsonText` — colado no textarea. Cabe até ~7 MB, o limite prático de uma
 *    Server Action, e é o caminho natural para app pequeno.
 *  · `storagePath` — o arquivo já subiu para o Storage pelo navegador. É o
 *    único caminho possível para os 22 MB de um `f200.json` real: um corpo
 *    desse tamanho numa Server Action seria carregado inteiro na memória de um
 *    worker do Next, que não é onde esse trabalho pertence.
 *
 * Validar o conteúdo aqui exigiria BAIXAR os 22 MB de volta só para conferir o
 * formato — a validação fica no worker, que é quem já vai lê-lo de qualquer
 * jeito. O que se valida aqui é o que é barato: que veio um dos dois.
 */
export async function gerarDocsApex(
  spaceId: string,
  entrada: { jsonText?: string; storagePath?: string },
): Promise<Ok> {
  try {
    await requirePermission("content.create", spaceId);
    await requirePermission("ai.configure", spaceId);
  } catch (e) {
    return { ok: false, error: "Sem permissão (precisa criar conteúdo + configurar IA)." };
  }
  let input: { meta?: Json; storagePath?: string };
  if (entrada.storagePath) {
    input = { storagePath: entrada.storagePath };
  } else if (entrada.jsonText?.trim()) {
    let meta: Json;
    try {
      meta = JSON.parse(entrada.jsonText) as Json;
    } catch {
      return { ok: false, error: "JSON inválido — cole a saída de pkg_apex_meta.f_app_json." };
    }
    if (!normalizarApexJson(meta)) {
      return { ok: false, error: "Não reconheci o metadado (esperado o JSON de pkg_apex_meta)." };
    }
    input = { meta };
  } else {
    return { ok: false, error: "Cole o JSON ou envie o arquivo." };
  }
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("data_dictionary_jobs")
    .insert({ space_id: spaceId, kind: "apex_docs", input })
    .select("id")
    .single();
  if (!job) return { ok: false, error: "Falha ao criar o job." };
  try {
    await enqueueApexDocs(job.id);
  } catch (e) {
    await admin.from("data_dictionary_jobs").update({ status: "error", error: "Fila indisponível (worker parado?)." }).eq("id", job.id);
    return { ok: false, error: motivoFila(e) };
  }
  revalidatePath("/admin/ontologia");
  return { ok: true, jobId: job.id };
}

/** Recebe o JSON de `pkg_db_meta.f_schema_json` (objetos de banco) → cria e enfileira a ingestão. */
export async function ingestDbJson(
  spaceId: string,
  entrada: { jsonText?: string; storagePath?: string },
): Promise<Ok> {
  try {
    await requirePermission("ai.configure", spaceId);
  } catch (e) {
    return { ok: false, error: "Sem permissão." };
  }
  let input: { meta?: Json; storagePath?: string };
  if (entrada.storagePath) {
    input = { storagePath: entrada.storagePath };
  } else if (entrada.jsonText?.trim()) {
    let meta: Json;
    try {
      meta = JSON.parse(entrada.jsonText) as Json;
    } catch {
      return { ok: false, error: "JSON inválido — cole a saída de pkg_db_meta.f_schema_json." };
    }
    if (!normalizarDbJson(meta)) {
      return { ok: false, error: "Não reconheci o metadado (esperado o JSON de pkg_db_meta)." };
    }
    input = { meta };
  } else {
    return { ok: false, error: "Cole o JSON ou envie o arquivo." };
  }
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("data_dictionary_jobs")
    .insert({ space_id: spaceId, kind: "db_objects", input })
    .select("id")
    .single();
  if (!job) return { ok: false, error: "Falha ao criar o job." };
  try {
    await enqueueDbIngest(job.id);
  } catch (e) {
    await admin.from("data_dictionary_jobs").update({ status: "error", error: "Fila indisponível (worker parado?)." }).eq("id", job.id);
    return { ok: false, error: motivoFila(e) };
  }
  revalidatePath("/admin/ontologia");
  return { ok: true, jobId: job.id };
}

/** Gera a DOCUMENTAÇÃO TÉCNICA dos objetos de banco (um artigo por objeto) na base. */
export async function gerarDbDocs(
  spaceId: string,
  entrada: { jsonText?: string; storagePath?: string },
): Promise<Ok> {
  try {
    await requirePermission("content.create", spaceId);
    await requirePermission("ai.configure", spaceId);
  } catch (e) {
    return { ok: false, error: "Sem permissão (precisa criar conteúdo + configurar IA)." };
  }
  let input: { meta?: Json; storagePath?: string };
  if (entrada.storagePath) {
    input = { storagePath: entrada.storagePath };
  } else if (entrada.jsonText?.trim()) {
    let meta: Json;
    try {
      meta = JSON.parse(entrada.jsonText) as Json;
    } catch {
      return { ok: false, error: "JSON inválido — cole a saída de pkg_db_meta.f_schema_json." };
    }
    if (!normalizarDbJson(meta)) {
      return { ok: false, error: "Não reconheci o metadado (esperado o JSON de pkg_db_meta)." };
    }
    input = { meta };
  } else {
    return { ok: false, error: "Cole o JSON ou envie o arquivo." };
  }
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("data_dictionary_jobs")
    .insert({ space_id: spaceId, kind: "db_docs", input })
    .select("id")
    .single();
  if (!job) return { ok: false, error: "Falha ao criar o job." };
  try {
    await enqueueDbDocs(job.id);
  } catch (e) {
    await admin.from("data_dictionary_jobs").update({ status: "error", error: "Fila indisponível (worker parado?)." }).eq("id", job.id);
    return { ok: false, error: motivoFila(e) };
  }
  revalidatePath("/admin/ontologia");
  return { ok: true, jobId: job.id };
}

/**
 * `total`, `done` e `created_at` faltavam, e eram justamente o que permite
 * ACOMPANHAR. Sem total/done a tela só mostra a porcentagem — e num job de 78
 * mil colunas, "1%" parado por um minuto parece travado, enquanto "1.200 de
 * 78.126" mostra que anda. Sem `created_at` não dá para distinguir a falha de
 * agora da de ontem.
 */
export type ApexJob = {
  id: string;
  kind: string;
  status: string;
  progress: number;
  total: number | null;
  done: number | null;
  found: number;
  error: string | null;
  result: unknown;
  created_at: string;
};

/** Jobs de ingestão recentes (progresso). */
export async function listApexJobs(spaceId: string): Promise<ApexJob[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("data_dictionary_jobs")
    .select("id, kind, status, progress, total, done, found, error, result, created_at")
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
  } catch (e) {
    return { ok: false, error: "Sem permissão." };
  }
  const supabase = await createClient();
  const cols = await listDataDictionaryColumns(spaceId);

  // Idiomas ativos + traduções das labels (via ontologia: label → term_norm → tradução).
  const { data: langsData } = await supabase.from("space_languages").select("lang").eq("space_id", spaceId).eq("active", true);
  const langs = (langsData ?? []).map((r) => r.lang);
  const tradPorNorm = new Map<string, Map<string, string>>(); // term_norm → (lang → termo)
  if (langs.length) {
    // Paginado: são 2.240 termos no maior espaço, e sem `.range()` o PostgREST
    // devolvia 1.000. O tradutor então "não encontrava" tradução para 1.240
    // termos que existiam — e o sintoma seria lacuna de tradução, não erro.
    const terms = await fetchAllPaged<{ id: string; term_norm: string }>((from, to) =>
      supabase.from("ontology_terms").select("id, term_norm").eq("space_id", spaceId).range(from, to),
    );
    const normPorId = new Map(terms.map((t) => [t.id, t.term_norm]));
    const ids = [...normPorId.keys()];
    for (let i = 0; i < ids.length; i += 200) {
      // 200 termos × N idiomas passa de 1000 com cinco idiomas.
      const data = await fetchAllPaged<{ term_id: string; lang: string; term: string }>((from, to) =>
        supabase
          .from("ontology_translations")
          .select("term_id, lang, term")
          .in("lang", langs)
          .in("term_id", ids.slice(i, i + 200))
          .range(from, to),
      );
      for (const r of data) {
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
