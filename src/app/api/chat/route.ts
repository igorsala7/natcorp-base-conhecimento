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
import { interpretarConsulta } from "@/lib/ai/query-understanding";
import { ehConversaSocial } from "@/lib/ai/social";
import { analyzeAmbiguity, analyzeConfidence, resolveTheme, type ClarifyScope } from "@/lib/ai/disambiguation";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const { spaceId, messages: messagesBrutas, conversationId, promptOverride, scope, contextScope } = (await req.json()) as {
    spaceId: string;
    messages: ChatMessage[];
    conversationId?: string;
    /** Persona de RASCUNHO (não salva) — a página Assistente testa antes de salvar. */
    promptOverride?: string;
    /** Filtro escolhido num botão de desambiguação (re-consulta já direcionada). */
    scope?: ClarifyScope;
    /** Tema em foco na conversa (eco do servidor) — evita perguntar no mesmo assunto. */
    contextScope?: ClarifyScope;
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
  // Turno social (saudação/agradecimento) não passa pelo RAG: responde na simpatia.
  const social = ehConversaSocial(question);
  // Entende o que o usuário QUIS dizer (gíria/erro/vago) antes de buscar; a
  // pergunta original segue para a persistência e para a resposta.
  const sources = social
    ? []
    : await retrieveContext(spaceId, await interpretarConsulta(spaceId, question, messages), 8, scope);

  // Assistente do admin: mesma persona que o leitor vê, para o que se testa
  // aqui corresponder ao que o público recebe.
  // Se o body TROUXE `promptOverride` (página Assistente testando antes de
  // salvar), ele vence o banco — SEM persistir e SEM pular as REGRAS_ABSOLUTAS
  // (a cascata segue acrescentando citar fonte / não inventar). Rascunho vazio =
  // testar o padrão do produto. Sem o campo → lê a persona salva do espaço.
  let systemPrompt: string;
  if (promptOverride !== undefined) {
    systemPrompt = buildSystemPrompt({ promptDoEspaco: promptOverride.trim() || null });
  } else {
    const { data: espaco } = await supabase
      .from("spaces")
      .select("chat_prompt")
      .eq("id", spaceId)
      .maybeSingle();
    systemPrompt = buildSystemPrompt({ promptDoEspaco: espaco?.chat_prompt ?? null });
  }

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
  // A pergunta do usuário é persistida UMA vez: na 1ª chamada (sem `scope`). O
  // clique num botão de desambiguação re-envia a MESMA pergunta com `scope` —
  // aí não persiste de novo (evita duplicar a mensagem do usuário).
  if (!scope) {
    await supabase.from("messages").insert({
      conversation_id: convId!,
      role: "user",
      content: question,
    });
  }

  const citationsB64 = Buffer.from(
    JSON.stringify(sources.map((s) => ({ n: s.n, title: s.title, url: s.url, image: s.image, heading_path: s.heading_path }))),
  ).toString("base64");
  const baseHeaders: Record<string, string> = {
    "X-Citations": citationsB64,
    "X-Conversation-Id": convId ?? "",
  };
  // Eco do tema resolvido: o cliente devolve como `contextScope` na próxima
  // pergunta, mantendo a conversa "no contexto".
  const tema = resolveTheme(sources);
  if (tema) baseHeaders["X-Theme"] = Buffer.from(JSON.stringify(tema)).toString("base64");

  // Contexto fraco → recusa (proibido responder por conhecimento geral).
  if (sources.length === 0 && !social) {
    const refusal =
      "Não encontrei exatamente isso na documentação deste espaço. " +
      "Pode reformular com mais detalhes (o nome da tela ou do assunto ajuda), ou, se preferir, falar com um atendente humano.";
    await supabase.from("messages").insert({
      conversation_id: convId!,
      role: "assistant",
      content: refusal,
      latency_ms: Date.now() - started,
    });
    return new Response(refusal, { headers: { ...baseHeaders, "Content-Type": "text/plain; charset=utf-8" } });
  }

  // Desambiguação: sem escolha explícita (`scope`), se os trechos disputam entre
  // temas e o assunto está fora do contexto atual, pergunta com botões em vez de
  // responder. NÃO persiste turno de assistente (é UI transitória). Pulada em
  // turnos sociais — não se "desambigua" um "oi".
  if (!scope && !social) {
    const dis =
      analyzeAmbiguity(sources, contextScope ?? null) ??
      analyzeConfidence(sources, contextScope ?? null);
    if (dis) return Response.json({ type: "clarify", ...dis }, { headers: baseHeaders });
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
