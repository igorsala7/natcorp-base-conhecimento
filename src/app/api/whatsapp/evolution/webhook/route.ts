import type { NextRequest } from "next/server";
import { loadWhatsappForEvolutionInstance } from "@/lib/whatsapp/config";
import { processEvolution } from "@/lib/whatsapp/chat";
import { evolutionInstanceDoPayload } from "@/lib/whatsapp/evolution";

export const runtime = "nodejs";

/**
 * Webhook da EVOLUTION API (WhatsApp não-oficial, self-hosted).
 *
 * O servidor Evolution faz POST dos eventos aqui. Roteamos pela INSTÂNCIA que
 * recebeu a mensagem → canal do cliente. Como o Evolution é self-hosted, a
 * autenticação é a `apikey` da instância: se o servidor a enviar no header
 * `apikey` (recomendado, configurável no webhook do Evolution), exigimos que
 * bata com a do canal; caso não envie, roteamos só pela instância.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const instance = evolutionInstanceDoPayload(payload);
  const rt = await loadWhatsappForEvolutionInstance(instance);
  // Instância desconhecida/inativa: confirma e ignora (evita retries do servidor).
  if (!rt || !rt.active || rt.provider !== "evolution") return new Response("ok", { status: 200 });

  // Se o servidor mandou a apikey no header, ela precisa casar com a do canal.
  const headerKey = req.headers.get("apikey");
  if (headerKey && rt.accessToken && headerKey !== rt.accessToken) {
    return new Response("invalid apikey", { status: 401 });
  }

  // Responde 200 já e processa depois — o LLM/tools podem passar do timeout.
  void processEvolution(rt, payload).catch((e) => console.error("[evolution] webhook:", e));
  return new Response("ok", { status: 200 });
}
