import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { identidadeDoRastreio } from "@/lib/elegibilidade";
import type { TrackingKey } from "@/lib/chat/tracking";

/**
 * QUEM PODE BAIXAR UM ARQUIVO DA EMPRESA — a decisão, num lugar só.
 *
 * Dois chamadores, e é por isso que ela não mora em nenhum dos dois:
 *
 *   · `/api/v1/arquivo/[id]` — assina a URL, ou recusa. É o portão de verdade;
 *   · `/api/v1/chat` — decide se a CITAÇÃO daquele arquivo sai com link de
 *     download. O widget não decide nada: ele desenha o que o servidor mandou,
 *     e o endpoint reconfere tudo na hora do clique.
 *
 * Duas implementações desta regra divergiriam, e o modo de divergir seria o
 * pior: o chat oferecendo um link que o endpoint recusa (ruído) ou, ao
 * contrário, o endpoint servindo o que o chat não mostraria (vazamento).
 *
 * ── TRÊS CONDIÇÕES, E A CERCA É A MESMA DA BUSCA ─────────────────────────
 * `public.documentos_da_base(p_base, p_identidade)` já responde a duas delas de
 * uma vez, e é a MESMA função que o RAG usa para montar o escopo do turno:
 *
 *   1. PROPRIEDADE — o arquivo pertence à base do token (join por `base_code`
 *      normalizado). Arquivo de outro cliente simplesmente não volta;
 *   2. ALCANCE — `public.elegivel(regra, identidade)` roda dentro dela, em SQL.
 *      O filtro é no banco, nunca no prompt nem no cliente (regra 5.5).
 *
 * A terceira é a coluna `download_liberado`, conferida logo depois: "estar na
 * base de conhecimento" e "poder ser baixado" são escolhas independentes do
 * cliente, e um arquivo que o assistente LÊ não é, por isso, um arquivo que o
 * usuário BAIXA.
 *
 * Reaproveitar `documentos_da_base` em vez de escrever um SELECT novo tem uma
 * consequência que vale registrar: ela filtra `status = 'ready'`. Arquivo em
 * extração não é baixável — o que é correto aqui por outro motivo que não o
 * dela (o objeto no Storage já existe), mas a janela é de segundos e o preço
 * de um segundo sítio de definição da cerca é permanente.
 */

export type ArquivoBaixavel = {
  id: string;
  nome: string;
  storagePath: string;
  mime: string | null;
};

type LinhaBaixavel = {
  id: string;
  original_name: string;
  storage_path: string;
  mime: string | null;
};

/**
 * Dos ids pedidos, quais esta identidade pode BAIXAR nesta base.
 *
 * Devolve só o que passa nas três condições. Nunca lança: falha de RPC ou de
 * leitura vira conjunto vazio com log — recusar por falha de leitura é a
 * direção segura, e o silêncio é o que faria "não pode" e "quebrou" parecerem
 * a mesma coisa de fora.
 */
export async function arquivosBaixaveis(
  db: SupabaseClient,
  base: string | null | undefined,
  track: Partial<Record<TrackingKey, string>>,
  ids: string[],
): Promise<ArquivoBaixavel[]> {
  const baseLimpa = String(base ?? "").trim();
  const pedidos = [...new Set(ids.filter(Boolean))];
  if (!baseLimpa || pedidos.length === 0) return [];

  try {
    const { data: elegiveis, error } = await db.rpc("documentos_da_base", {
      p_base: baseLimpa,
      p_identidade: identidadeDoRastreio(track),
    });
    if (error) {
      console.error(
        `[download-de-arquivo] documentos_da_base respondeu com erro para a base "${baseLimpa}", nada é liberado:`,
        error.message,
      );
      return [];
    }
    const podeAlcancar = new Set(
      ((elegiveis ?? []) as { document_id: string }[]).map((d) => d.document_id),
    );
    // INTERSEÇÃO, e não uma segunda consulta por id: o conjunto elegível é a
    // cerca inteira, e consultar o id direto na tabela pularia justamente o
    // `public.elegivel` que mora dentro da função.
    const candidatos = pedidos.filter((id) => podeAlcancar.has(id));
    if (candidatos.length === 0) return [];

    const { data, error: erroLinhas } = await db
      .from("knowledge_documents")
      .select("id, original_name, storage_path, mime")
      .in("id", candidatos)
      // `filter` e não `eq`: a coluna entrou depois do último `gen types` e o
      // tipo gerado ainda não a conhece (ver `LinhaCrua` em `arquivos-da-base`).
      .filter("download_liberado", "eq", true);
    if (erroLinhas) {
      console.error(
        `[download-de-arquivo] leitura de knowledge_documents falhou para a base "${baseLimpa}", nada é liberado:`,
        erroLinhas.message,
      );
      return [];
    }

    return ((data ?? []) as unknown as LinhaBaixavel[]).map((l) => ({
      id: l.id,
      nome: l.original_name,
      storagePath: l.storage_path,
      mime: l.mime,
    }));
  } catch (e) {
    console.error(
      `[download-de-arquivo] falha ao resolver o download na base "${baseLimpa}", nada é liberado:`,
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}

/** Um id só. `null` quando qualquer uma das três condições não passa. */
export async function arquivoBaixavel(
  db: SupabaseClient,
  base: string | null | undefined,
  track: Partial<Record<TrackingKey, string>>,
  documentId: string,
): Promise<ArquivoBaixavel | null> {
  const [achado] = await arquivosBaixaveis(db, base, track, [documentId]);
  return achado ?? null;
}
