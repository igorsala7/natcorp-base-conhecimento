import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { traduzirTermos, type TermoParaTraduzir } from "./ontology-translate";
import { normalizarTermo } from "./ontology";
import { fetchAllPaged } from "@/lib/supabase/paginate";

type DbClient = SupabaseClient<Database>;
const LOTE = 20; // termos por chamada de IA

/**
 * Executa um job de TRADUÇÃO da ontologia: traduz para `lang` os termos do espaço
 * que AINDA não têm tradução (idempotente — cobre tanto o bulk inicial quanto a
 * auto-migração de um termo novo). Upsert por (term_id, lang). Atualiza progresso.
 */
export async function runTraducaoOntologia(
  supabase: DbClient,
  jobId: string,
  onProgress?: (done: number, total: number) => Promise<void> | void,
): Promise<{ traduzidos: number }> {
  const { data: job } = await supabase
    .from("ontology_translation_jobs")
    .select("space_id, lang")
    .eq("id", jobId)
    .single();
  if (!job) return { traduzidos: 0 };
  const spaceId = job.space_id;
  const lang = job.lang;

  // PAGINADO. Sem isto o PostgREST corta em 1000 SEM AVISAR e o job traduz os
  // 1000 primeiros termos como se fossem todos — depois se declara concluído.
  //
  // Não é hipótese: medido em 23/08/2026, `ontology_translations` tinha
  // EXATAMENTE 1000 linhas num espaço com 4.424 termos. Um número redondo numa
  // tabela de contagem natural é a assinatura desse corte.
  //
  // O caminho do RAG (`ontology.ts:165`) já usa `fetchAllPaged`; este ficou para
  // trás. A ordem precisa ser TOTAL e estável (`id` de desempate), senão as
  // fatias pulam ou repetem linhas na fronteira.
  const todos = await fetchAllPaged<{ id: string; term: string; description: string | null }>(
    (de, ate) =>
      supabase
        .from("ontology_terms")
        .select("id, term, description")
        .eq("space_id", spaceId)
        .order("id", { ascending: true })
        .range(de, ate),
  );
  const ids = todos.map((t) => t.id);

  // Já traduzidos neste idioma → pular (idempotente / auto-migração).
  const jaTraduzidos = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("ontology_translations")
      .select("term_id")
      .eq("lang", lang)
      .in("term_id", ids.slice(i, i + 200));
    for (const r of data ?? []) jaTraduzidos.add(r.term_id);
  }
  const pendentes = todos.filter((t) => !jaTraduzidos.has(t.id));
  const total = pendentes.length;
  await supabase
    .from("ontology_translation_jobs")
    .update({ status: "running", total, done: 0, progress: total ? 0 : 100 })
    .eq("id", jobId);
  if (!total) {
    await supabase.from("ontology_translation_jobs").update({ status: "done", progress: 100 }).eq("id", jobId);
    return { traduzidos: 0 };
  }

  // Sinônimos (aliases) dos pendentes, para a IA traduzir junto.
  const pendIds = pendentes.map((t) => t.id);
  const aliasPorTermo = new Map<string, string[]>();
  for (let i = 0; i < pendIds.length; i += 200) {
    const { data } = await supabase
      .from("ontology_aliases")
      .select("term_id, alias")
      .in("term_id", pendIds.slice(i, i + 200));
    for (const a of data ?? []) {
      const l = aliasPorTermo.get(a.term_id) ?? [];
      l.push(a.alias);
      aliasPorTermo.set(a.term_id, l);
    }
  }

  let done = 0;
  let traduzidos = 0;
  for (let i = 0; i < pendentes.length; i += LOTE) {
    const lote: TermoParaTraduzir[] = pendentes.slice(i, i + LOTE).map((t) => ({
      id: t.id,
      term: t.term,
      description: t.description,
      aliases: aliasPorTermo.get(t.id) ?? [],
    }));
    let out: Awaited<ReturnType<typeof traduzirTermos>> = [];
    try {
      out = await traduzirTermos(lote, lang);
    } catch {
      out = [];
    }
    if (out.length) {
      const rows = out.map((tr) => ({
        term_id: tr.id,
        lang,
        term: tr.term,
        term_norm: normalizarTermo(tr.term),
        description: tr.description,
        aliases: tr.aliases,
        source: "ia",
        reviewed: false,
        updated_at: new Date().toISOString(),
      }));
      await supabase.from("ontology_translations").upsert(rows, { onConflict: "term_id,lang" });
      traduzidos += rows.length;
    }
    done += lote.length;
    await supabase
      .from("ontology_translation_jobs")
      .update({ done, progress: Math.round((done / total) * 100) })
      .eq("id", jobId);
    if (onProgress) await onProgress(done, total);
  }

  await supabase.from("ontology_translation_jobs").update({ status: "done", progress: 100 }).eq("id", jobId);
  return { traduzidos };
}
