import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cria um job de ontologia acoplado ao publicar — um EFEITO DE SISTEMA (igual
 * ao embedding, que roda no publish sem exigir permissão extra além de
 * `content.publish`). Quem chama já validou `content.publish`.
 *
 * IMPORTANTE: passe um cliente SERVICE-ROLE (admin). A RLS de `ontology_jobs`
 * exige `ai.configure`, que um Gestor de conteúdo NÃO tem — mas ele pode
 * publicar. Com o cliente de usuário, a inserção seria silenciosamente barrada
 * pela RLS e a ontologia nunca rodaria.
 *
 * Escopo: `article` = só aquele nó; `subtree` = a pasta e TODO o conteúdo
 * abaixo (uma varredura em lote, não um job por artigo). Só insere a linha em
 * `ontology_jobs` e devolve o id; o ENVIO para a fila fica a cargo de quem
 * chama. Devolve `null` se a inserção falhar (o publish não pode ser derrubado
 * por um efeito colateral de indexação).
 */
export async function criarJobOntologia(
  db: SupabaseClient<Database>,
  input: {
    spaceId: string;
    scope: "article" | "subtree" | "document";
    targetId: string;
    createdBy: string | null;
  },
): Promise<string | null> {
  const { data: job } = await db
    .from("ontology_jobs")
    .insert({
      space_id: input.spaceId,
      scope: input.scope,
      target_id: input.targetId,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  return job?.id ?? null;
}

/**
 * Cria um job de TRADUÇÃO da ontologia (espaço × idioma). Só insere a linha e
 * devolve o id; o ENVIO para a fila fica a cargo de quem chama. `null` em falha.
 * Passe um cliente SERVICE-ROLE (a RLS de escrita é só service-role).
 */
export async function criarJobTraducao(
  db: SupabaseClient<Database>,
  input: { spaceId: string; lang: string; createdBy: string | null },
): Promise<string | null> {
  const { data: job } = await db
    .from("ontology_translation_jobs")
    .insert({ space_id: input.spaceId, lang: input.lang, created_by: input.createdBy })
    .select("id")
    .single();
  return job?.id ?? null;
}
