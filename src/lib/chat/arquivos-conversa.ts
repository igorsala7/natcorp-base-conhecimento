import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { extrairArquivosDeMensagens, type ArquivoGerado, type LinhaMedia } from "./arquivos-conversa-parse";

/**
 * Os arquivos que o chat GEROU nesta conversa — não só neste turno.
 *
 * Por que existe: `ms_email_enviar_arquivo` (graph-file-tools.ts) só era
 * registrada quando `ctx.gerados.length > 0`, e `gerados` é o balde do turno
 * corrente. Mas pedir o arquivo e pedir o envio são SEMPRE dois turnos
 * diferentes ("faça um PPT" → … → "manda por e-mail"). Na prática a ferramenta
 * com anexo quase nunca existia no turno do envio: sobrava `ms_email_enviar`,
 * cujo schema não tem campo de arquivo, e o e-mail saía sem anexo relatando
 * sucesso. Medido em 27/08: PPT/PDF/Word gerados às 15:56, e-mail às 16:24 —
 * 28 minutos e ~10 turnos de distância.
 *
 * O que torna o conserto barato: os bytes JÁ estão no Storage. `route.ts:3175`
 * sobe cada arquivo gerado no bucket privado `chat-media` e grava o caminho em
 * `messages.media`. Aqui só relemos esse rastro.
 *
 * REGRA DE CUSTO: esta lista carrega METADADO, nunca bytes. A descrição da
 * ferramenta precisa apenas dos nomes; os bytes só importam para o arquivo que
 * o modelo escolher, e vêm por `baixarArquivoDaConversa` dentro do `execute`.
 */

export type { ArquivoGerado };

/** Bucket privado onde `route.ts` deposita o que o chat gera. */
const BUCKET = "chat-media";
/** Mensagens para trás que vale reler. Espelha `MAX_MESSAGES` do history-store. */
const MAX_MENSAGENS = 60;

/** Os arquivos gerados na conversa. Falha vira lista vazia: sem isto o chat
 *  continua inteiro, apenas sem oferecer anexo de turnos anteriores. */
export async function arquivosDaConversa(conversationId: string): Promise<ArquivoGerado[]> {
  if (!conversationId) return [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("messages")
      .select("media, created_at")
      .eq("conversation_id", conversationId)
      .not("media", "is", null)
      .order("created_at", { ascending: false })
      .limit(MAX_MENSAGENS);
    return extrairArquivosDeMensagens((data ?? []) as LinhaMedia[]);
  } catch {
    return [];
  }
}

/** Bytes de UM arquivo, sob demanda — chamado dentro do `execute` da ferramenta,
 *  depois que o modelo escolheu. Null quando o objeto sumiu do Storage. */
export async function baixarArquivoDaConversa(path: string): Promise<Buffer | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}
