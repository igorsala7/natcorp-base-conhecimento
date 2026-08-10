import type { NextRequest } from "next/server";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  extractKey,
} from "@/lib/widget/auth";
import { pararRun, runIdValido } from "@/lib/chat/run-registry";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/chat/stop — o usuário clicou **Parar**.
 *
 * Existe porque fechar a conexão deixou de significar "cancele". Quando a aba
 * morre (logout, navegação), a geração agora SEGUE até terminar e gravar; então
 * o cancelamento precisa de um pedido explícito, e este é ele.
 *
 * Portão: mesma chave pública e mesma allowlist de origem do chat. Sem rate
 * limit de propósito — parar é o pedido mais barato que existe e recusá-lo por
 * excesso deixaria a pessoa sem botão justamente quando ela quer gastar menos.
 * O `runId` é opaco e de vida curta: quem não o tem não para nada.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: cors });

  let payload: { key?: string; runId?: string };
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

  const runId = runIdValido(payload.runId);
  if (!runId) return json({ error: "runId ausente ou inválido." }, 400);

  // `parado: false` não é erro: a geração pode ter acabado no intervalo entre o
  // clique e esta chamada. O widget trata os dois casos igual — parou de exibir.
  return json({ parado: pararRun(runId) }, 200);
}
