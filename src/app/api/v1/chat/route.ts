import { streamText } from "ai";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatModel, hasAiKey } from "@/lib/ai/config";
import {
  retrievePublicContext,
  buildContextBlock,
  RAG_SYSTEM_PROMPT,
} from "@/lib/ai/rag";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  clientIp,
  extractKey,
  rateLimitOk,
} from "@/lib/widget/auth";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/chat — chat RAG público (widget e integrações).
 * Auth: chave pública (pk_...). Escopo: apenas o espaço da chave.
 * Resposta: SSE (text/event-stream) com eventos JSON:
 *   {type:'citations', citations:[{n,title,url}]}
 *   {type:'token', value:'...'}   (vários)
 *   {type:'done', conversationId:'...'}
 *   {type:'error', message:'...'}
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) =>
    Response.json(body, { status, headers: cors });

  let payload: {
    messages?: ChatMessage[];
    conversationId?: string;
    sessionId?: string;
    key?: string;
  };
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
  if (!hasAiKey()) return json({ error: "IA não configurada no servidor." }, 503);
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) {
    return json({ error: "Muitas requisições. Tente em instantes." }, 429);
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!question.trim()) return json({ error: "Mensagem vazia." }, 400);

  const supabase = createAdminClient();
  const started = Date.now();
  const sources = await retrievePublicContext(key.space_id, question);

  // Garante a conversa (persiste histórico com session_id anônimo).
  let convId = payload.conversationId;
  if (!convId) {
    const { data: conv } = await supabase
      .from("conversations")
      .insert({ space_id: key.space_id, session_id: payload.sessionId ?? null })
      .select("id")
      .single();
    convId = conv?.id;
  }
  await supabase.from("messages").insert({
    conversation_id: convId!,
    role: "user",
    content: question,
  });

  const citations = sources.map((s) => ({ n: s.n, title: s.title, url: s.url }));
  const encoder = new TextEncoder();
  const sse = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  // Contexto fraco → recusa (proibido responder por conhecimento geral).
  if (sources.length === 0) {
    const refusal =
      "Não encontrei essa informação na documentação. " +
      "Recomendo refinar a pergunta ou falar com um atendente humano.";
    await supabase.from("messages").insert({
      conversation_id: convId!,
      role: "assistant",
      content: refusal,
      latency_ms: Date.now() - started,
    });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(sse({ type: "citations", citations: [] }));
        controller.enqueue(sse({ type: "token", value: refusal }));
        controller.enqueue(sse({ type: "done", conversationId: convId }));
        controller.close();
      },
    });
    return sseResponse(stream, cors);
  }

  const result = streamText({
    model: chatModel(),
    system: RAG_SYSTEM_PROMPT + "\n\nCONTEXTO:\n" + buildContextBlock(sources),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(sse({ type: "citations", citations }));
      let full = "";
      try {
        for await (const delta of result.textStream) {
          full += delta;
          controller.enqueue(sse({ type: "token", value: delta }));
        }
      } catch {
        controller.enqueue(sse({ type: "error", message: "Falha ao gerar a resposta." }));
      }
      const usage = await Promise.resolve(result.usage).catch(() => null);
      await supabase.from("messages").insert({
        conversation_id: convId!,
        role: "assistant",
        content: full,
        citations: citations as never,
        latency_ms: Date.now() - started,
        tokens: usage?.totalTokens ?? null,
      });
      controller.enqueue(sse({ type: "done", conversationId: convId }));
      controller.close();
    },
  });

  return sseResponse(stream, cors);
}

function sseResponse(stream: ReadableStream, cors: Record<string, string>) {
  return new Response(stream, {
    headers: {
      ...cors,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
