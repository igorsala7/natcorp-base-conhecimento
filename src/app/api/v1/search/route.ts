import type { NextRequest } from "next/server";
import { retrievePublicContext, type RetrievedSource } from "@/lib/ai/rag";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  clientIp,
  extractKey,
  rateLimitOk,
} from "@/lib/widget/auth";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

function toResults(sources: RetrievedSource[]) {
  return sources.map((s) => ({
    title: s.title,
    heading_path: s.heading_path,
    snippet: s.snippet ?? s.content.slice(0, 200),
    url: s.url,
  }));
}

/**
 * Handler compartilhado da busca híbrida pública, escopada ao espaço da
 * chave. `/api/v1/search` e `/api/docs` chamam esta função com uma exigência
 * de identidade DIFERENTE — a distinção fica explícita aqui, no parâmetro,
 * em vez de dependir de qual rota "sabe" alguma coisa que a outra não sabe.
 *
 * `exigirIdentidade: true` (usado só por `/api/v1/search`): a documentação
 * pode ser restrita por base, portal e perfil (mesma regra do chat e do
 * WhatsApp — tarefa 4). Servir sem identidade devolveria conteúdo que a regra
 * do cliente excluiu, então a chamada sem `track` válido é recusada.
 *
 * `exigirIdentidade: false` (usado só por `/api/docs`): é o nome canônico que
 * a ferramenta interna NatDocs consome para ler a documentação; não
 * representa usuário de cliente, e por isso não carrega token — decisão
 * explícita do dono, não esquecimento. Consequência aceita: `/api/docs` usa
 * as documentações da CHAVE (`key.space_ids`) sem passar por `base`/`track`,
 * então pode devolver documentação que a regra de uma base excluiu; a
 * exposição é para ferramenta interna, não para usuário de cliente.
 *
 * Body: { query: string, limit?: number, key?: string, track?: string | { token: string } }
 * Resposta: { results: [{ title, heading_path, snippet, url }] }
 */
export async function buscar(req: NextRequest, opts: { exigirIdentidade: boolean }) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) =>
    Response.json(body, { status, headers: cors });

  let payload: { query?: string; limit?: number; key?: string; track?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const key = await resolveWidgetKey(extractKey(req, payload.key));
  if (!key) return json({ error: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) {
    return json({ error: "Origem não autorizada." }, 403);
  }
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) {
    return json({ error: "Muitas requisições. Tente em instantes." }, 429);
  }

  const query = (payload.query ?? "").trim();
  if (!query) return json({ error: "Consulta vazia." }, 400);
  const limit = Math.min(Math.max(payload.limit ?? 8, 1), 20);

  // space_ids (união de widget_key_spaces), não space_id: a busca precisa
  // enxergar as mesmas documentações que /api/v1/chat enxerga.
  if (opts.exigirIdentidade) {
    // `key.space_id` (o espaço DONO), não `key.space_ids`: é o mesmo espaço
    // que guarda a chave de rastreio (`space_tracking_keys`) e é o que
    // `/api/v1/chat` usa para decodificar — `decodeTrackForSpace` espera UM
    // espaço, não a união de documentações anexadas.
    const track = await decodeTrackForSpace(key.space_id, payload.track);
    if (!track.p_base) {
      // Não diz QUAL base tem restrição nem que a chave tem escopo restrito —
      // só o que fazer. Uma resposta que mencionasse "esta base tem
      // documentação restrita" vazaria a um terceiro que aquele cliente
      // configurou restrições.
      return json(
        {
          error:
            "Esta rota exige o token de rastreio (`track`) porque o conteúdo da documentação pode ser restrito por identidade. Envie o mesmo token que o widget recebe em `data-token`.",
        },
        400,
      );
    }
    const sources = await retrievePublicContext(key.space_ids, query, limit, undefined, undefined, {
      base: track.p_base ?? null,
      track,
    });
    return json({ results: toResults(sources) }, 200);
  }

  const sources = await retrievePublicContext(key.space_ids, query, limit);
  return json({ results: toResults(sources) }, 200);
}

/** POST /api/v1/search — exige identidade (ver comentário em `buscar`). */
export async function POST(req: NextRequest) {
  return buscar(req, { exigirIdentidade: true });
}
