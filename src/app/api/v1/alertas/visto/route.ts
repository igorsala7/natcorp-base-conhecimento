import type { NextRequest } from "next/server";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  clientIp,
  extractKey,
  rateLimitOk,
} from "@/lib/widget/auth";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import { registrarVisualizacao } from "@/lib/widget/alertas";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

type Payload = { key?: string; track?: unknown; campanhaId?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/alertas/visto — o widget informa que RENDERIZOU um alerta.
 *
 * Mesmo portão do resto da v1: chave pública (pk_...), allowlist de origem,
 * rate limit, e a identidade saindo do TOKEN.
 *
 * ── A IDENTIDADE VEM DO TOKEN, NUNCA DO CORPO ─────────────────────────────────
 * O corpo desta requisição é controlado por quem chama, e `widget.js` é público.
 * Se a matrícula viesse do corpo, qualquer um gravaria visualização no nome de
 * qualquer colega — e o painel do cliente mostraria pessoas que nunca viram o
 * aviso. O único campo do corpo que esta rota usa é `campanhaId`, e ele passa
 * pelo portão de `public.registrar_visualizacao`.
 *
 * ── `registrado: false` NÃO É ERRO ────────────────────────────────────────────
 * `registrar_visualizacao` devolve `false` quando o alerta não é entregável a
 * essa identidade NAQUELA base: id inventado, campanha de outro cliente,
 * campanha desligada, ou janela já encerrada entre a abertura e o desenho na
 * tela. Os quatro casos são a MESMA resposta, de propósito — variar o corpo por
 * motivo transformaria este endpoint num oráculo: com 36 caracteres de id e uma
 * resposta que distingue "não existe" de "não é sua", dá para varrer ids e
 * descobrir que campanhas outro cliente tem no ar.
 *
 * O widget trata `false` como assunto encerrado, e não tenta de novo. Repetição
 * da MESMA pessoa devolve `true` (a chave única absorve), então nem a repetição
 * nem a recusa fazem o cliente ficar reenviando.
 *
 * ── O QUE ESTA ROTA NÃO FAZ ───────────────────────────────────────────────────
 * Não decide elegibilidade, não filtra por base, não compara datas. Isso é o
 * predicado da função de entrega, e ela é o portão da gravação também — um
 * predicado num lugar só. Qualquer cerca escrita aqui seria uma segunda
 * implementação a divergir da primeira.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: cors });

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const key = await resolveWidgetKey(extractKey(req, payload.key));
  if (!key) return json({ error: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) {
    return json({ error: "Origem não autorizada." }, 403);
  }

  // `key.space_id` (o espaço DONO), o mesmo que `/api/v1/config` usou para
  // decodificar o token que entregou este alerta. Espaço diferente aqui leria
  // com outra chave e a identidade não fecharia.
  const t = await decodeTrackForSpace(key.space_id, payload.track);
  const base = String(t.p_base ?? "").trim();

  // Balde por PESSOA quando há identidade, como no resto da v1: teto por chave
  // puniria a empresa inteira porque um usuário reabriu o chat muitas vezes.
  const sujeito = `${base}:${String(t.p_usuario ?? t.p_matricula ?? "").trim()}`;
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit, base ? sujeito : null))) {
    // Uma visualização PERDIDA, e é a troca certa: o número que o painel mostra
    // fica menor do que a realidade, nunca maior. O widget tenta de novo na
    // próxima abertura.
    return json({ error: "Muitas requisições. Tente em instantes." }, 429);
  }

  const campanhaId = String(payload.campanhaId ?? "").trim();
  // Id fora de forma nem chega ao banco (o PostgREST devolveria erro de tipo).
  // Malformação é observável pelo próprio cliente, então distinguir aqui não
  // conta nada que ele já não saiba.
  if (!UUID.test(campanhaId)) return json({ error: "campanhaId inválido." }, 400);

  const r = await registrarVisualizacao(createAdminClient(), campanhaId, t);

  // Falha de banco é diferente de recusa do portão, e o status diz isso: aqui o
  // widget PODE tentar de novo na próxima abertura, enquanto `registrado: false`
  // é assunto encerrado.
  if (r.erro) return json({ ok: false, error: "Não foi possível registrar." }, 500);

  return json({ ok: true, registrado: r.registrado }, 200);
}
