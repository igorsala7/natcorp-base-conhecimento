import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { normalizarTermo } from "./ontology";

export type TermoAcumulado = {
  term: string;
  kind: string;
  description: string | null;
  aliases: Set<string>;
  /**
   * O nome que este conceito tinha ANTES de a IA expandi-lo.
   *
   * Sem isto, renomear duplica: a busca é feita pelo nome DEVOLVIDO, "Adiantamento
   * Salarial" não casa com o "Adto salarial" que já existia, e um segundo termo
   * nasce deixando o primeiro órfão. Medido em 17/08: 724 termos eram também
   * alias de outro, e cada nova rodada multiplicava.
   */
  normAnterior?: string;
};

/**
 * Mescla um conjunto de termos (com sinônimos) na ontologia de um espaço,
 * sem duplicar: um `term_norm` OU um `alias_norm` já existente aponta para o
 * mesmo termo. Usado pela VARREDURA por IA (worker) e pela IMPORTAÇÃO por
 * arquivo. Devolve quantos itens NOVOS (termos + aliases) foram gravados.
 *
 * `db` é service-role (worker/sistema) — a RLS de ontologia exige `ai.configure`.
 */
export async function mesclarTermos(
  db: SupabaseClient<Database>,
  spaceId: string,
  acumulado: Map<string, TermoAcumulado>,
  opts: { source: string; createdBy: string | null },
): Promise<number> {
  const { source, createdBy } = opts;
  if (acumulado.size === 0) return 0;

  // norm → termId cobre termos E aliases já existentes (não duplica nada).
  const { data: exTerms } = await db
    .from("ontology_terms")
    .select("id, term_norm, description")
    .eq("space_id", spaceId);
  const normToTermId = new Map<string, string>();
  const descById = new Map<string, string | null>();
  for (const t of exTerms ?? []) {
    normToTermId.set(t.term_norm, t.id);
    descById.set(t.id, t.description);
  }
  const exTermIds = (exTerms ?? []).map((t) => t.id);
  for (let i = 0; i < exTermIds.length; i += 200) {
    const { data: exAliases } = await db
      .from("ontology_aliases")
      .select("term_id, alias_norm")
      .in("term_id", exTermIds.slice(i, i + 200));
    for (const a of exAliases ?? []) if (!normToTermId.has(a.alias_norm)) normToTermId.set(a.alias_norm, a.term_id);
  }

  let found = 0;
  for (const [norm, t] of acumulado) {
    /**
     * Procura pelo nome NOVO e, se não achar, pelo ANTIGO — e aí RENOMEIA.
     *
     * É o que transforma "expandir a abreviação" em melhoria do termo existente
     * em vez de um segundo termo competindo com ele.
     */
    let existenteId = normToTermId.get(norm);
    if (!existenteId && t.normAnterior) {
      const antigoId = normToTermId.get(t.normAnterior);
      if (antigoId) {
        await db
          .from("ontology_terms")
          .update({ term: t.term, term_norm: norm, updated_at: new Date().toISOString() })
          .eq("id", antigoId);
        normToTermId.set(norm, antigoId);
        existenteId = antigoId;
      }
    }
    let termId: string;
    if (existenteId) {
      termId = existenteId;
      if (t.description && !descById.get(termId)) {
        await db
          .from("ontology_terms")
          .update({ description: t.description, updated_at: new Date().toISOString() })
          .eq("id", termId);
        descById.set(termId, t.description);
      }
    } else {
      const { data: novo } = await db
        .from("ontology_terms")
        .insert({ space_id: spaceId, term: t.term, term_norm: norm, kind: t.kind, description: t.description, source, created_by: createdBy })
        .select("id")
        .single();
      if (!novo) continue;
      termId = novo.id;
      normToTermId.set(norm, termId);
      descById.set(termId, t.description);
      found += 1;
    }
    for (const alias of t.aliases) {
      const an = normalizarTermo(alias);
      if (!an || an === norm) continue;
      if (normToTermId.has(an)) continue;
      await db
        .from("ontology_aliases")
        .upsert({ term_id: termId, alias, alias_norm: an, source }, { onConflict: "term_id,alias_norm", ignoreDuplicates: true });
      normToTermId.set(an, termId);
      found += 1;
    }
  }
  return found;
}
