import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { criarJobTraducao } from "./ontology-enqueue";
import { enqueueOntologyTranslate } from "@/lib/jobs/boss";

/**
 * Para CADA idioma habilitado do espaço (`space_languages` ativos), cria um job de
 * tradução e o enfileira. O job traduz só os termos AINDA sem tradução → serve tanto
 * ao bulk inicial quanto à AUTO-MIGRAÇÃO (termo novo salvo / varredura de IA). É
 * best-effort: uma falha de enfileiramento NÃO derruba quem chamou (salvar termo/
 * publicar). Passe um cliente SERVICE-ROLE. Devolve quantos idiomas foram enfileirados.
 */
export async function enfileirarTraducoesPendentes(
  db: SupabaseClient<Database>,
  spaceId: string,
  createdBy: string | null,
): Promise<number> {
  const { data: langs } = await db
    .from("space_languages")
    .select("lang")
    .eq("space_id", spaceId)
    .eq("active", true);
  let n = 0;
  for (const l of langs ?? []) {
    try {
      const jobId = await criarJobTraducao(db, { spaceId, lang: l.lang, createdBy });
      if (jobId) {
        await enqueueOntologyTranslate(jobId);
        n++;
      }
    } catch {
      /* best-effort: não derruba o fluxo que disparou a auto-migração */
    }
  }
  return n;
}
