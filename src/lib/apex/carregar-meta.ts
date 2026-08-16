import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarApexJson } from "./metadata";

/**
 * DE ONDE VEM O METADADO DO APEX.
 *
 * Ele chegava inteiro dentro de `data_dictionary_jobs.input.meta`, e isso
 * funcionava enquanto os JSONs eram pequenos. O `f200.json` real tem 22 MB —
 * uma aplicação só —, e o caminho inteiro quebrava antes de chegar ao worker:
 *
 *  · a Server Action estoura o limite de corpo do Next e devolve uma resposta
 *    que o cliente não sabe ler ("An unexpected response was received from the
 *    server"), sem dizer que o problema era tamanho;
 *  · e mesmo passando, 22 MB viram uma linha de `jsonb` no banco — carregada
 *    inteira toda vez que alguém lê o job, inclusive para mostrar o progresso.
 *
 * Agora o arquivo vai para o Storage e o job carrega só o CAMINHO. É o mesmo
 * desenho da importação de documentos, e o mesmo princípio do projeto:
 * "operação assíncrona longa vira job, não request HTTP".
 *
 * ── Compatibilidade ────────────────────────────────────────────────────────
 * `input.meta` continua funcionando. Há jobs antigos gravados assim, e um
 * `input.meta` inline ainda é o caminho certo para metadado pequeno — colar
 * 50 KB no textarea não deveria exigir upload.
 */
export async function carregarMetaApex(
  supabase: SupabaseClient,
  input: unknown,
): Promise<ReturnType<typeof normalizarApexJson>> {
  const i = (input ?? {}) as { meta?: unknown; storagePath?: string };

  // Inline vence: se está ali, é o que a pessoa mandou.
  if (i.meta) return normalizarApexJson(i.meta);

  if (!i.storagePath) return null;

  const { data: blob, error } = await supabase.storage.from("imports").download(i.storagePath);
  if (error || !blob) {
    throw new Error(`Metadado não encontrado no Storage (${i.storagePath}): ${error?.message ?? "sem corpo"}`);
  }
  // `JSON.parse` de 22 MB é aceitável no worker, que é um processo dedicado —
  // era no worker do Next que não cabia.
  return normalizarApexJson(JSON.parse(await blob.text()));
}
