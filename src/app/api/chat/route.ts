import { streamText } from "ai";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { chatModel, hasAiKey } from "@/lib/ai/config";
import {
  retrieveContext,
  buildContextBlock,
} from "@/lib/ai/rag";
import { buildSystemPrompt, withContext } from "@/lib/ai/prompt-cascade";
import { limitarHistorico } from "@/lib/ai/history";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const { spaceId, messages: messagesBrutas, conversationId } = (await req.json()) as {
    spaceId: string;
    messages: ChatMessage[];
    conversationId?: string;
  };
  // Mesmo teto das rotas públicas. Aqui o chamador é interno e autenticado,
  // mas o custo de tokens é o mesmo e o histórico vem do cliente.
  const messages = limitarHistorico(messagesBrutas);

  if (!await hasAiKey()) {
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

  // Assistente do admin: mesma persona que o leitor vê, para o que se testa
  // aqui corresponder ao que o público recebe.
  const { data: espaco } = await supabase
    .from("spaces")
    .select("chat_prompt")
    .eq("id", spaceId)
    .maybeSingle();
  const systemPrompt = buildSystemPrompt({ promptDoEspaco: espaco?.chat_prompt ?? null });

  // Garante a conversa (para persistir histórico). Isola por base de cliente:
  // uma conversationId de OUTRO espaço é descartada — nunca cruza espaços.
  let convId = conversationId;
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
    JSON.stringify(sources.map((s) => ({ n: s.n, title: s.title, url: s.url, image: s.image, heading_path: s.heading_path }))),
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
    // Sem isto a falha do provedor (chave inválida, crédito esgotado, timeout)
    // vira um stream VAZIO: o usuário vê as fontes e nenhuma resposta, sem
    // pista do motivo. O cliente também trata resposta vazia como erro.
    onError: ({ error }) => {
      console.error("[chat] falha ao gerar resposta:", error);
    },
    model: await chatModel(),
    system: withContext(systemPrompt, buildContextBlock(sources)),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    onFinish: async ({ text, usage }) => {
      await supabase.from("messages").insert({
        conversation_id: convId!,
        role: "assistant",
        content: text,
        citations: sources.map((s) => ({ n: s.n, title: s.title, url: s.url, image: s.image, heading_path: s.heading_path })) as never,
        latency_ms: Date.now() - started,
        tokens: usage?.totalTokens ?? null,
      });
    },
  });

  return result.toTextStreamResponse({ headers: baseHeaders });
}
