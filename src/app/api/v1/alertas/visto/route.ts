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

  /*
    O BALDE É POR PESSOA QUANDO HÁ PESSOA, E POR IP QUANDO NÃO HÁ.

    Com identidade, o sujeito é `base:usuario` (ou a matrícula), como no resto da
    v1: teto por chave puniria a empresa inteira porque um usuário reabriu o chat
    muitas vezes.

    SEM identidade não existe pessoa, e fingir que existe era o defeito: o sujeito
    virava `base:` — o MESMO valor para todo acesso anônimo daquela base —, então o
    balde que este comentário chamava de "por pessoa" era na verdade um balde por
    BASE. Com `rate_limit = 600` (o único valor nas três chaves de produção), duas
    consequências: um script gravava até 600 linhas por minuto na campanha dele, e
    drenava junto o balde de todos os outros anônimos daquela base, empurrando o
    número do painel para BAIXO.

    Com o IP no lugar da pessoa ausente, o abusador consome o próprio balde e quem
    está em outro IP não sente nada. O teto por IP que o `rateLimitOk` já aplica
    continua valendo por cima, e o efeito colateral é na direção certa: com sujeito
    presente aquele teto folga para 20× (é o caso do escritório atrás de um NAT),
    e o balde principal aperta de 600 compartilhados para 600 por IP.

    O IP É SUPOSIÇÃO, NÃO MEDIÇÃO — e enquanto ele é o sujeito, isto precisa estar
    escrito aqui. `clientIp` prefere `X-Real-IP` (o nginx o SUBSTITUI por
    `$remote_addr`, o peer TCP) e, na falta dele, lê o ÚLTIMO elemento de
    `X-Forwarded-For`, que é o que o proxy acrescentou. Nenhuma das duas leituras
    PROVA que o cabeçalho veio do nosso proxy: numa topologia com outro proxy na
    frente, o valor é o IP daquele hop e todos os anônimos daquele caminho caem num
    balde só (aperta, não afrouxa); num app exposto sem proxy, os dois cabeçalhos
    voltam a ser escolha de quem chama. Fechar isso exige saber quais hops são
    confiáveis, e a topologia é decisão de deploy — ver o comentário de `clientIp`.

    A inflação em si não fecha aqui, e não precisa: ela só fecharia com o roster do
    ERP, e o número deixou de se chamar pessoas.
  */
  const ip = clientIp(req);
  const quem = String(t.p_usuario ?? t.p_matricula ?? "").trim();
  const sujeito = `${base}:${quem || `ip:${ip}`}`;
  if (!(await rateLimitOk(key.id, ip, key.rate_limit, base ? sujeito : null))) {
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
