import { streamText } from "ai";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { chatModel, hasAiKey } from "@/lib/ai/config";
import {
  retrieveContext,
  buildContextBlock,
  RAG_SYSTEM_PROMPT,
} from "@/lib/ai/rag";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const { spaceId, messages, conversationId } = (await req.json()) as {
    spaceId: string;
    messages: ChatMessage[];
    conversationId?: string;
  };

  if (!hasAiKey()) {
    return Response.json({ error: "AI_API_KEY não configurada." }, { status: 400 });
  }
  if (!(await hasPermission("content.view", spaceId))) {
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const started = Date.now();
  const sources = await retrieveContext(spaceId, question);

  // Garante a conversa (para persistir histórico).
  let convId = conversationId;
  if (!convId) {
    const { data: conv } = await supabase
      .from("conversations")
      .insert({ space_id: spaceId, user_ref: user?.id ?? null })
      .select("id")
      .single();
    convId = conv?.id;
  }
  await supabase.from("messages").insert({
    conversation_id: convId!,
    role: "user",
    content: question,
  });

  const citationsB64 = Buffer.from(
    JSON.stringify(sources.map((s) => ({ n: s.n, title: s.title, url: s.url }))),
  ).toString("base64");
  const baseHeaders: Record<string, string> = {
    "X-Citations": citationsB64,
    "X-Conversation-Id": convId ?? "",
  };

  // Contexto fraco → recusa (proibido responder por conhecimento geral).
  if (sources.length === 0) {
    const refusal =
      "Não encontrei essa informação na documentação deste espaço. " +
      "Recomendo refinar a pergunta ou falar com um atendente humano.";
    await supabase.from("messages").insert({
      conversation_id: convId!,
      role: "assistant",
      content: refusal,
      latency_ms: Date.now() - started,
    });
    return new Response(refusal, { headers: { ...baseHeaders, "Content-Type": "text/plain; charset=utf-8" } });
  }

  const result = streamText({
    model: chatModel(),
    system: RAG_SYSTEM_PROMPT + "\n\nCONTEXTO:\n" + buildContextBlock(sources),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    onFinish: async ({ text, usage }) => {
      await supabase.from("messages").insert({
        conversation_id: convId!,
        role: "assistant",
        content: text,
        citations: sources.map((s) => ({ n: s.n, title: s.title, url: s.url })) as never,
        latency_ms: Date.now() - started,
        tokens: usage?.totalTokens ?? null,
      });
    },
  });

  return result.toTextStreamResponse({ headers: baseHeaders });
}
