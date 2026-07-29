import { streamText, stepCountIs } from "ai";
import { limitarHistorico } from "@/lib/ai/history";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatModel, hasAiKey } from "@/lib/ai/config";
import {
  retrievePublicContext,
  buildContextBlock,
} from "@/lib/ai/rag";
import { resolvePersona, resolveRegras } from "@/lib/ai/prompt-cascade";
import { composeSystemPrompt } from "@/lib/ai/system-prompt";
import { getPortalAccess } from "@/lib/portal/data";
import { interpretarConsulta } from "@/lib/ai/query-understanding";
import { ehConversaSocial } from "@/lib/ai/social";
import { analyzeAmbiguity, analyzeConfidence, resolveTheme, type ClarifyScope } from "@/lib/ai/disambiguation";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import { resolveCategory } from "@/lib/ai/prompts";
import { webSourcesParaLeitor } from "@/lib/ai/web-sources";
import { loadAttachmentsForTurn, linkAttachments, withImageParts } from "@/lib/chat/attachment-store";
import { pageContextFields, pageContextHint, pageContextNote } from "@/lib/chat/page-context";
import { buildIntegrationTools, identityFromTrack } from "@/lib/integrations/tool-builder";
import { glossarioCasado } from "@/lib/ai/ontology";
import type { OutFile } from "@/lib/integrations/documents";

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
    scope?: ClarifyScope;
    contextScope?: ClarifyScope;
    track?: unknown;
    attachmentIds?: unknown;
    page?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  // Tela atual do leitor (Fase 4) — o artigo/página que ele está vendo.
  const page = pageContextFields(payload.page);

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

  const messages = limitarHistorico(payload.messages);
  const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!question.trim()) return json({ error: "Pergunta vazia." }, 400);

  const spaceId = access.space.id;
  const started = Date.now();
  // Turno social (saudação, agradecimento, "tudo bem?") não passa pelo RAG:
  // responde na simpatia, sem contexto nem "não encontrei".
  const social = ehConversaSocial(question);
  const ragSources = social
    ? []
    : await retrievePublicContext(
        spaceId,
        await interpretarConsulta(spaceId, question, messages, pageContextHint(page)),
        8,
        payload.scope,
      );
  // Fontes da web (se o leitor citou uma URL permitida): numeradas após as da
  // documentação e tratadas como qualquer outra fonte (contexto + citação).
  const webSources = social ? [] : await webSourcesParaLeitor(question, ragSources.length + 1);
  const sources = [...ragSources, ...webSources];
  // Anexos deste turno (documentos): texto extraído, injetado como DADO.
  const attach = await loadAttachmentsForTurn(spaceId, payload.attachmentIds);

  // Ask-AI do portal usa a persona da própria documentação.
  const { data: espaco } = await supabase
    .from("spaces")
    .select("chat_prompt")
    .eq("id", spaceId)
    .maybeSingle();
  const aP = await resolveCategory("assistente");
  const persona = resolvePersona({
    promptDoEspaco: espaco?.chat_prompt ?? null,
    personaPadrao: aP.persona_padrao,
  });

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
  // Identidade de rastreio — usada na conversa E para atribuir o CONSUMO de IA
  // a este usuário (não ao sistema).
  const track = await decodeTrackForSpace(spaceId, payload.track);
  // Integrações: se o token traz `p_base`, o modelo ganha as ferramentas de API
  // daquela base (identidade injetada no servidor). Arquivos base64 são coletados.
  const outFiles: OutFile[] = [];
  const integ = track.p_base
    ? await buildIntegrationTools(track.p_base, identityFromTrack(track), outFiles)
    : { tools: {}, capabilities: "", agentPrompt: "" };
  const temTools = Object.keys(integ.tools).length > 0;
  // Ontologia: glossário do domínio para acertar tools/parâmetros.
  const glossario = social ? "" : await glossarioCasado(supabase, [spaceId], question).catch(() => "");
  if (!convId) {
    const { data: conv } = await supabase
      .from("conversations")
      .insert({
        space_id: spaceId,
        session_id: payload.sessionId ?? null,
        ...track,
        ...(page ? { page } : {}),
      })
      .select("id")
      .single();
    convId = conv?.id;
  }
  // Pergunta persistida só na 1ª chamada (sem `scope`); o clique num botão de
  // desambiguação re-envia a mesma pergunta e não deve duplicá-la.
  if (!payload.scope) {
    await supabase.from("messages").insert({
      conversation_id: convId!,
      role: "user",
      content: question,
      attachments: attach.metas as never,
    });
    await linkAttachments(attach.ids, convId!, spaceId);
  }

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

  if (sources.length === 0 && !social && attach.ids.length === 0 && !temTools) {
    const refusal =
      "Não encontrei exatamente isso aqui na documentação. " +
      "Pode reformular com mais detalhes (o nome da tela ou do assunto ajuda bastante), ou, se preferir, falar com um atendente humano.";
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

  // Desambiguação por botões (sem escolha explícita e fora do contexto atual).
  // Pulada em turnos sociais e quando o leitor deu uma URL (intenção já é clara).
  if (!payload.scope && !social && webSources.length === 0 && attach.ids.length === 0 && !temTools) {
    const dis =
      analyzeAmbiguity(ragSources, payload.contextScope ?? null) ??
      analyzeConfidence(ragSources, payload.contextScope ?? null);
    if (dis) {
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(sse({ type: "clarify", question: dis.question, options: dis.options }));
          c.enqueue(sse({ type: "done", conversationId: convId }));
          c.close();
        },
      });
      return new Response(stream, { headers });
    }
  }

  const result = streamText({
    // Sem isto a falha do provedor (chave inválida, crédito esgotado, timeout)
    // vira um stream VAZIO: o usuário vê as fontes e nenhuma resposta, sem
    // pista do motivo. O cliente também trata resposta vazia como erro.
    onError: ({ error }) => {
      console.error("[chat] falha ao gerar resposta:", error);
    },
    model: await chatModel({ kind: "user", ...track }),
    system: composeSystemPrompt(
      {
        persona,
        especializacao: integ.agentPrompt,
        usoFerramentas: integ.capabilities,
        regras: resolveRegras(aP.regras_absolutas),
        comTools: temTools,
      },
      [
        buildContextBlock(sources),
        attach.contextBlock,
        pageContextNote(page),
        glossario
          ? `GLOSSÁRIO do domínio (termos canônicos e sinônimos — use-os para entender o pedido e escolher ferramentas/parâmetros): ${glossario}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    ),
    messages: withImageParts(messages, attach.imageParts),
    ...(temTools ? { tools: integ.tools, stopWhen: stepCountIs(5) } : {}),
  });

  const stream = new ReadableStream({
    async start(c) {
      c.enqueue(sse({ type: "citations", citations }));
      const tema = resolveTheme(ragSources);
      if (tema) c.enqueue(sse({ type: "theme", scope: tema.scope, label: tema.label }));
      let full = "";
      try {
        for await (const delta of result.textStream) {
          full += delta;
          c.enqueue(sse({ type: "token", value: delta }));
        }
      } catch {
        c.enqueue(sse({ type: "error", message: "Falha ao gerar a resposta." }));
      }
      // Arquivos retornados pelas APIs (base64) → link de download no chat.
      for (const f of outFiles) {
        c.enqueue(
          sse({ type: "file", filename: f.filename, mimeType: f.mimeType, dataUrl: `data:${f.mimeType};base64,${f.base64}` }),
        );
      }
      const usage = await Promise.resolve(result.usage).catch(() => null);
      await supabase.from("messages").insert({
        conversation_id: convId!,
        role: "assistant",
        content: full,
        citations: citations as never,
        latency_ms: Date.now() - started,
        tokens: usage?.totalTokens ?? null,
        input_tokens: usage?.inputTokens ?? null,
        output_tokens: usage?.outputTokens ?? null,
      });
      c.enqueue(sse({ type: "done", conversationId: convId }));
      c.close();
    },
  });

  return new Response(stream, { headers });
}
