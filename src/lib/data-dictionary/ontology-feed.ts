import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { normalizarTermo } from "@/lib/ai/ontology";

type DbClient = SupabaseClient<Database>;
type LinhaDic = Database["public"]["Tables"]["data_dictionary"]["Insert"];

/**
 * Alimenta a ONTOLOGIA a partir das linhas `column` do dicionário de dados (APEX ou banco):
 * a LABEL vira o termo canônico e a COLUNA do banco (+ outras labels) viram sinônimos —
 * assim o RAG/chat entende tanto "Id. Empresa" quanto "COD_EMPRESA". Devolve nº de termos novos.
 * (A auto-tradução é disparada por quem chama, via enfileirarTraducoesPendentes.)
 */
export async function alimentarOntologiaDeColunas(supabase: DbClient, spaceId: string, linhas: LinhaDic[]): Promise<number> {
  let criados = 0;
  for (const c of linhas.filter((l) => l.kind === "column" && l.label)) {
    const term = String(c.label ?? "").trim();
    if (term.length < 2) continue;
    const norm = normalizarTermo(term);
    const { data: existente } = await supabase.from("ontology_terms").select("id").eq("space_id", spaceId).eq("term_norm", norm).maybeSingle();
    let termId = existente?.id;
    if (!termId) {
      const { data: novo } = await supabase.from("ontology_terms").insert({ space_id: spaceId, term, term_norm: norm, kind: "entidade", source: "ia" }).select("id").single();
      termId = novo?.id;
      if (termId) criados += 1;
    }
    if (!termId) continue;
    const aliases = new Set<string>();
    if (c.db_column) aliases.add(String(c.db_column));
    const labels = (c.metadata as { labels?: unknown } | null)?.labels;
    if (Array.isArray(labels)) for (const l of labels) { const s = String(l).trim(); if (s && s.toLowerCase() !== term.toLowerCase()) aliases.add(s); }
    for (const a of aliases) {
      const an = normalizarTermo(a);
      if (an.length < 2 || an === norm) continue;
      await supabase.from("ontology_aliases").upsert({ term_id: termId, alias: a, alias_norm: an, source: "ia" }, { onConflict: "term_id,alias_norm", ignoreDuplicates: true });
    }
  }
  return criados;
}
