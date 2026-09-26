import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { normalizarTermo, type DonoDaOntologia } from "./ontology";

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
 * Mescla um conjunto de termos (com sinônimos) na ontologia de UM DONO — uma
 * documentação (espaço) ou uma base —, sem duplicar: um `term_norm` OU um
 * `alias_norm` já existente aponta para o mesmo termo. Usado pela VARREDURA por
 * IA (worker) e pela IMPORTAÇÃO por arquivo. Devolve quantos itens NOVOS
 * (termos + aliases) foram gravados.
 *
 * O dono entra como união (`DonoDaOntologia`) e não como dois parâmetros
 * opcionais: uma chamada com os dois, ou com nenhum, não compila — e é o mesmo
 * que o CHECK `ontology_terms_um_dono` recusa no banco. Termo de base e termo de
 * espaço nunca se misturam nem se enxergam: a LEITURA abaixo filtra pelo dono, e
 * a mesclagem de um cliente não tem como achar (nem renomear) termo do global.
 *
 * `db` é service-role (worker/sistema) — a RLS de ontologia exige `ai.configure`.
 */
export async function mesclarTermos(
  db: SupabaseClient<Database>,
  dono: DonoDaOntologia,
  acumulado: Map<string, TermoAcumulado>,
  opts: { source: string; createdBy: string | null },
): Promise<number> {
  const { source, createdBy } = opts;
  if (acumulado.size === 0) return 0;

  /*
    O DONO, numa coluna e num valor — usado na leitura e na escrita.

    `.filter()` em vez de `.eq()` porque `src/lib/database.types.ts` ainda não
    conhece `ontology_terms.base_id` (conferido contra o banco em 26/09), e
    `filter` aceita nome de coluna fora do tipo gerado sem `as never`. Mesma
    fronteira declarada de `arquivos-da-base.ts`.
  */
  const coluna: "space_id" | "base_id" = dono.spaceId ? "space_id" : "base_id";
  const valorDoDono: string = dono.spaceId ?? dono.baseId!;

  /*
    A LEITURA PAGINA — o teto de 1.000 linhas do PostgREST é silencioso.

    Este `select` é o índice que impede a duplicata, e sem paginar ele via 1.000
    de 4.424 termos (medido em `natcorp`): para todo termo além do milésimo, a
    mesclagem achava que não existia, tentava inserir, tomava `unique_violation`,
    e o `if (!novo) continue` engolia — o sinônimo novo não era gravado e o
    contador `found` não contava, sem uma linha de log em lugar nenhum. É a mesma
    armadilha que `carregarOntologia` documenta acima do `fetchAllPaged` dela,
    e a ordem TOTAL por `id` é o que faz as fatias não pularem linha.
  */
  const exTerms = await fetchAllPaged<{ id: string; term_norm: string; description: string | null }>(
    (de, ate) =>
      db
        .from("ontology_terms")
        .select("id, term_norm, description")
        .filter(coluna, "eq", valorDoDono)
        .order("id")
        .range(de, ate),
  );
  const normToTermId = new Map<string, string>();
  const descById = new Map<string, string | null>();
  for (const t of exTerms) {
    normToTermId.set(t.term_norm, t.id);
    descById.set(t.id, t.description);
  }
  const exTermIds = exTerms.map((t) => t.id);
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
        // O dono vai numa chave só, e é o MESMO da leitura acima. `as never`
        // porque o tipo gerado não conhece `base_id` — ver o comentário do
        // `coluna`/`valorDoDono`.
        .insert({
          [coluna]: valorDoDono,
          term: t.term,
          term_norm: norm,
          kind: t.kind,
          description: t.description,
          source,
          created_by: createdBy,
        } as never)
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
