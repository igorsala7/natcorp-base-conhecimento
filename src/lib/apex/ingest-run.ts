import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { normalizarApexJson } from "./metadata";
import { colunasParaResolver, construirLinhasDicionario, type ResolucaoColunas } from "./ingest";
import { resolverColunasRegiao } from "@/lib/ai/apex-resolve";
import { alimentarOntologiaDeColunas } from "@/lib/data-dictionary/ontology-feed";
import { enfileirarTraducoesPendentes } from "@/lib/ai/ontology-translate-enqueue";

type DbClient = SupabaseClient<Database>;

/**
 * Executa um job de INGESTÃO de app APEX: resolve as colunas por região (IA lê o SQL),
 * grava o `data_dictionary` (re-ingest idempotente por app) e alimenta a ontologia (auto-
 * traduzida). Atualiza progresso. O metadado vem em `job.input.meta` (JSON do pkg_apex_meta).
 */
export async function runApexIngest(supabase: DbClient, jobId: string): Promise<{ componentes: number; colunas: number; termos: number }> {
  const vazio = { componentes: 0, colunas: 0, termos: 0 };
  const { data: job } = await supabase.from("data_dictionary_jobs").select("space_id, input").eq("id", jobId).single();
  if (!job) return vazio;
  const spaceId = job.space_id;
  const meta = normalizarApexJson((job.input as { meta?: unknown } | null)?.meta);
  if (!meta) {
    await supabase.from("data_dictionary_jobs").update({ status: "error", error: "Metadado APEX inválido (esperado o JSON de pkg_apex_meta)." }).eq("id", jobId);
    return vazio;
  }

  const regioes = colunasParaResolver(meta);
  const total = regioes.length + 2;
  await supabase.from("data_dictionary_jobs").update({ status: "running", total, done: 0, progress: 0 }).eq("id", jobId);

  const resolvido: ResolucaoColunas = new Map();
  let done = 0;
  for (const r of regioes) {
    resolvido.set(r.regionId, await resolverColunasRegiao(r.sql, r.entradas.map((e) => e.entrada)));
    done += 1;
    await supabase.from("data_dictionary_jobs").update({ done, progress: Math.round((done / total) * 100) }).eq("id", jobId);
  }

  const linhas = construirLinhasDicionario(spaceId, meta, resolvido);
  const appId = meta.app.id || "";
  await supabase.from("data_dictionary").delete().eq("space_id", spaceId).eq("source", "apex_dict").eq("app_id", appId);
  for (let i = 0; i < linhas.length; i += 500) await supabase.from("data_dictionary").insert(linhas.slice(i, i + 500));
  done += 1;
  await supabase.from("data_dictionary_jobs").update({ done, progress: Math.round((done / total) * 100) }).eq("id", jobId);

  const termos = await alimentarOntologiaDeColunas(supabase, spaceId, linhas);
  try {
    await enfileirarTraducoesPendentes(supabase, spaceId, null);
  } catch {
    /* best-effort */
  }

  const componentes = linhas.filter((l) => l.kind !== "column").length;
  const colunas = linhas.filter((l) => l.kind === "column").length;
  await supabase.from("data_dictionary_jobs").update({ status: "done", progress: 100, found: termos, result: { componentes, colunas, termos } }).eq("id", jobId);
  return { componentes, colunas, termos };
}
