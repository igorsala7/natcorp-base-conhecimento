import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import { arquivoBaixavel } from "@/lib/documentacoes/download-de-arquivo";
import { BUCKET_ARQUIVOS } from "@/lib/documentacoes/arquivos-da-base";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  clientIp,
  extractKey,
  rateLimitOk,
} from "@/lib/widget/auth";

export const runtime = "nodejs";

/** Validade da URL assinada. Curta: ela é o arquivo, e link vaza em print. */
const SEGUNDOS_DE_VALIDADE = 120;

/**
 * GET /api/v1/arquivo/[id] — o download do arquivo da empresa, pelo chatbot.
 *
 * Query: `key` (chave pública do widget) e `track` (o MESMO token cifrado que o
 * widget recebe em `data-token`). Responde `302` para uma URL assinada de curta
 * duração do Storage.
 *
 * ── É GET COM REDIRECT, e não POST devolvendo a URL ──────────────────────
 * O link vive dentro da citação, e a citação é um `<a>`. Um POST obrigaria o
 * widget a buscar a URL e só então abrir a aba, e abertura que não é
 * consequência direta do clique é bloqueada como pop-up. Mesmo raciocínio (e
 * mesmo comentário) de `/api/v1/connect/[provider]/start`.
 *
 * ── A IDENTIDADE VEM DO TOKEN, NUNCA DOS PARÂMETROS ──────────────────────
 * `track` é cifrado com a chave do espaço e não é forjável; `p_base`,
 * `p_perfil`, `p_centro_custo` e as outras nove dimensões saem DELE. Quem
 * chamar esta rota acrescentando `?p_perfil=MASTER` não muda nada: esses nomes
 * não são lidos. É a mesma máquina do chat, e é o que faz o corte acontecer em
 * SQL (`public.elegivel`, dentro de `documentos_da_base`) e não na URL.
 *
 * ── AS TRÊS RECUSAS DEVOLVEM A MESMA RESPOSTA ────────────────────────────
 * Não é do meu cliente · download não liberado · a regra não me alcança — as
 * três saem como o MESMO 404 com o MESMO texto. Distinguir "não existe" de
 * "existe e você não pode" conta ao chamador que o arquivo existe, e num
 * endpoint público com id de 36 caracteres essa diferença é um oráculo: dá para
 * varrer ids e mapear o acervo de outro cliente sem baixar um byte.
 *
 * `excluirArquivoDaBase` já segue essa regra ("Arquivo não encontrado nesta
 * empresa", mesma mensagem para as duas causas), e `/api/v1/search` segue a
 * versão dela para identidade ausente. Aqui é a terceira ocorrência da mesma
 * decisão, de propósito.
 *
 * As recusas que NÃO são sobre o arquivo continuam distintas — chave inválida
 * (401), origem não autorizada (403), rate limit (429) —, porque elas falam do
 * CHAMADOR e não ensinam nada sobre o acervo.
 */

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: cors });

  /**
   * A ÚNICA resposta de recusa sobre o arquivo. Uma função, e não três
   * literais iguais: três literais divergem no dia em que alguém "melhora" uma
   * mensagem, e a divergência reabre o oráculo sem nenhum teste falhar.
   */
  const naoDisponivel = () =>
    json({ error: "Arquivo não disponível para download." }, 404);

  const { id } = await ctx.params;
  const url = req.nextUrl;

  const key = await resolveWidgetKey(extractKey(req, url.searchParams.get("key")));
  if (!key) return json({ error: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) {
    return json({ error: "Origem não autorizada." }, 403);
  }

  // `key.space_id` (o espaço DONO), não `key.space_ids`: é o espaço que guarda
  // a chave de rastreio, e é o mesmo que `/api/v1/chat` usa para decodificar.
  const track = await decodeTrackForSpace(key.space_id, url.searchParams.get("track"));
  const base = String(track.p_base ?? "").trim();

  // O balde por PESSOA quando há identidade, como no resto da v1: um teto por
  // chave puniria a empresa inteira por causa de um usuário.
  const sujeito = `${base}:${String(track.p_usuario ?? track.p_matricula ?? "").trim()}`;
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit, base ? sujeito : null))) {
    return json({ error: "Muitas requisições. Tente em instantes." }, 429);
  }

  // Sem base no token não há a QUEM o arquivo pertencer, e a cerca de
  // propriedade é justamente por base. Mesma resposta das outras três: dizer
  // "falta o token" aqui distinguiria esta chamada de uma recusa por alcance.
  if (!base) return naoDisponivel();
  // Id fora de forma nem chega ao banco (o PostgREST devolveria erro de tipo).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return naoDisponivel();
  }

  const db = createAdminClient();
  const arquivo = await arquivoBaixavel(db, base, track, id);
  if (!arquivo) return naoDisponivel();

  /*
    URL ASSINADA, e não proxy de bytes por este servidor.

    É o padrão que o produto já usa para servir do Storage, e evita segurar uma
    conexão do Node por toda a duração de um download que pode ser um vídeo de
    dezenas de MB. `download` faz o Storage mandar o `Content-Disposition` com
    o nome ORIGINAL — sem isso o navegador salvaria o uuid do caminho.
  */
  const { data, error } = await db.storage
    .from(BUCKET_ARQUIVOS)
    .createSignedUrl(arquivo.storagePath, SEGUNDOS_DE_VALIDADE, { download: arquivo.nome });

  if (error || !data?.signedUrl) {
    // Falha NOSSA, não recusa: o arquivo existe e a pessoa pode baixá-lo. Dizer
    // "não disponível" aqui mandaria quem tem direito procurar permissão.
    console.error(
      `[api/v1/arquivo] falha ao assinar "${arquivo.storagePath}":`,
      error?.message ?? "sem url",
    );
    return json({ error: "Não foi possível preparar o download agora. Tente de novo." }, 502);
  }

  return new Response(null, {
    status: 302,
    headers: {
      ...cors,
      Location: data.signedUrl,
      // A URL assinada é credencial de curta duração: nenhum intermediário deve
      // guardá-la, e o 302 em si também não.
      "Cache-Control": "no-store",
    },
  });
}
