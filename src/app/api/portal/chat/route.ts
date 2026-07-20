import { streamText } from "ai";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatModel, hasAiKey } from "@/lib/ai/config";
import {
  retrievePublicContext,
  buildContextBlock,
} from "@/lib/ai/rag";
import { buildSystemPrompt, withContext } from "@/lib/ai/prompt-cascade";
import { getPortalAccess } from "@/lib/portal/data";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

/**
 * POST /api/portal/chat — "Perguntar à IA" para o leitor do portal.
 * Mesma origem (sem chave). Escopo: apenas o espaço (respeita o gate de senha).
 * Rate limit por IP. Resposta em SSE: {type:'citations'|'token'|'done'|'error'}.
 */
export async function POST(req: NextRequest) {
  const json = (b: unknown, s: number) => Response.json(b, { status: s });

  let payload: {
    spaceSlug?: string;
    messages?: ChatMessage[];
    conversationId?: string;
    sessionId?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  if (!payload.spaceSlug) return json({ error: "Espaço ausente." }, 400);
  const access = await getPortalAccess(payload.spaceSlug);
  if (!access || access.locked) return json({ error: "Espaço indisponível." }, 403);
  if (!await hasAiKey()) return json({ error: "IA não configurada." }, 503);

  const supabase = createAdminClient();

  // Rate limit por IP (janela de 60s).
  const { data: allowed } = await supabase.rpc("rate_limit_hit", {
    p_bucket: `portal:${clientIp(req)}`,
    p_max: 20,
    p_window_seconds: 60,
  });
  if (allowed === false) return json({ error: "Muitas perguntas. Tente em instantes." }, 429);

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!question.trim()) return json({ error: "Pergunta vazia." }, 400);

  const spaceId = access.space.id;
  const started = Date.now();
  const sources = await retrievePublicContext(spaceId, question);

  // Ask-AI do portal usa a persona da própria documentação.
  const { data: espaco } = await supabase
    .from("spaces")
    .select("chat_prompt")
    .eq("id", spaceId)
    .maybeSingle();
  const systemPrompt = buildSystemPrompt({ promptDoEspaco: espaco?.chat_prompt ?? null });

  let convId = payload.conversationId;
  if (convId) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", convId)
      .eq("space_id", spaceId)
      .maybeSingle();
    if (!existing) convId = undefined;
  }
  if (!convId) {
    const { data: conv } = await supabase
      .from("conversations")
      .insert({ space_id: spaceId, session_id: payload.sessionId ?? null })
      .select("id")
      .single();
    convId = conv?.id;
  }
  await supabase.from("messages").insert({
    conversation_id: convId!,
    role: "user",
    content: question,
  });

  const citations = sources.map((s) => ({
    n: s.n,
    title: s.title,
    url: s.url,
    image: s.image,
    heading_path: s.heading_path,
  }));
  const enc = new TextEncoder();
  const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
  const headers = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };

  if (sources.length === 0) {
    const refusal =
      "Não encontrei essa informação nesta documentação. " +
      "Tente reformular a pergunta ou fale com o suporte.";
    await supabase.from("messages").insert({
      conversation_id: convId!,
      role: "assistant",
      content: refusal,
      latency_ms: Date.now() - started,
    });
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(sse({ type: "citations", citations: [] }));
        c.enqueue(sse({ type: "token", value: refusal }));
        c.enqueue(sse({ type: "done", conversationId: convId }));
        c.close();
      },
    });
    return new Response(stream, { headers });
  }

  const result = streamText({
    // Sem isto a falha do provedor (chave inválida, crédito esgotado, timeout)
    // vira um stream VAZIO: o usuário vê as fontes e nenhuma resposta, sem
    // pista do motivo. O cliente também trata resposta vazia como erro.
    onError: ({ error }) => {
      console.error("[chat] falha ao gerar resposta:", error);
    },
    model: await chatModel(),
    system: withContext(systemPrompt, buildContextBlock(sources)),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const stream = new ReadableStream({
    async start(c) {
      c.enqueue(sse({ type: "citations", citations }));
      let full = "";
      try {
        for await (const delta of result.textStream) {
          full += delta;
          c.enqueue(sse({ type: "token", value: delta }));
        }
      } catch {
        c.enqueue(sse({ type: "error", message: "Falha ao gerar a resposta." }));
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
      c.enqueue(sse({ type: "done", conversationId: convId }));
      c.close();
    },
  });

  return new Response(stream, { headers });
}
