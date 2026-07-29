import "server-only";
import { generateText, stepCountIs } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatModel } from "@/lib/ai/config";
import { retrievePublicContext, buildContextBlock } from "@/lib/ai/rag";
import { buildSystemPrompt, withContext } from "@/lib/ai/prompt-cascade";
import { resolveCategory } from "@/lib/ai/prompts";
import { buildIntegrationTools, identityFromTrack } from "@/lib/integrations/tool-builder";
import { withImageParts, type ImagePart } from "@/lib/chat/attachment-store";
import type { TrackFields } from "@/lib/tracking/resolve";
import type { WhatsappRuntime } from "./config";
import { identifyByPhone } from "./identify";
import { sendWhatsappText } from "./send";
import { alreadyProcessed } from "./dedupe";
import { rateLimitOk, maskPhone } from "./util";
import { extractContent, type WaMessage } from "./media";

type Msg = { role: "user" | "assistant"; content: string };

/** Gera a resposta do chatbot (documentação + APIs + mídia) para uma mensagem. */
async function answerWhatsapp(input: {
  baseCode: string;
  track: TrackFields;
  chatSpaceId: string;
  question: string;
  history: Msg[];
  imageParts?: ImagePart[];
  dataContext?: string;
}): Promise<string> {
  const integ = await buildIntegrationTools(input.baseCode, identityFromTrack(input.track));
  const temTools = Object.keys(integ.tools).length > 0;
  const sources = await retrievePublicContext(input.chatSpaceId, input.question, 6);
  const temImagem = !!input.imageParts?.length;

  // Sem documentação, sem ferramentas, sem imagem e sem dado anexo → não responde
  // por conhecimento geral.
  if (sources.length === 0 && !temTools && !input.dataContext && !temImagem) {
    return "Não encontrei isso na documentação e não há dados para consultar por aqui. Tente reformular ou fale com o suporte.";
  }

  const aP = await resolveCategory("assistente");
  const systemPrompt = buildSystemPrompt({
    promptDaChave: null,
    promptDoEspaco: null,
    personaPadrao: aP.persona_padrao,
    regrasAbsolutas: aP.regras_absolutas,
  });

  const base: Msg[] = [...input.history, { role: "user", content: input.question }];
  const messages = withImageParts(base, input.imageParts ?? []);
  const { text } = await generateText({
    model: await chatModel({ kind: "user", ...input.track }),
    system: withContext(
      systemPrompt,
      [buildContextBlock(sources), integ.capabilities, input.dataContext].filter(Boolean).join("\n\n"),
    ),
    messages,
    ...(temTools ? { tools: integ.tools, stopWhen: stepCountIs(5) } : {}),
  });
  return text?.trim() || "Desculpe, não consegui gerar uma resposta agora.";
}

async function handleMessage(rt: WhatsappRuntime, msg: WaMessage): Promise<void> {
  const from = msg.from;
  if (!from) return;

  // Normaliza a mídia (texto/áudio/imagem/vídeo/arquivo/localização).
  const content = await extractContent(rt, msg);
  if ("note" in content) return void (await sendWhatsappText(rt, from, content.note));
  if (!content.question.trim() && !content.imageParts?.length && !content.dataContext) return;

  const id = await identifyByPhone(rt, from);
  if (!id) return void (await sendWhatsappText(rt, from, rt.unidentifiedMessage));

  const db = createAdminClient();
  const { data: base } = await db
    .from("ai_bases")
    .select("id, chat_space_id, active")
    .eq("base_code", id.baseCode)
    .maybeSingle();
  if (!base || !base.active) return void (await sendWhatsappText(rt, from, rt.unidentifiedMessage));
  if (!base.chat_space_id) {
    return void (await sendWhatsappText(rt, from, "Seu atendimento por aqui ainda não está configurado. Fale com o suporte."));
  }
  const spaceId = base.chat_space_id;

  // Conversa contínua por (documentação, telefone).
  const existing = (
    await db
      .from("conversations")
      .select("id")
      .eq("space_id", spaceId)
      .eq("session_id", from)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ).data;
  let convId = existing?.id;
  if (!convId) {
    const { data: conv } = await db
      .from("conversations")
      .insert({ space_id: spaceId, session_id: from, user_ref: from, ...id.track })
      .select("id")
      .single();
    convId = conv?.id;
  }

  const hist =
    (
      await db
        .from("messages")
        .select("role, content")
        .eq("conversation_id", convId!)
        .order("created_at", { ascending: false })
        .limit(10)
    ).data ?? [];
  const history: Msg[] = hist
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  if (convId) await db.from("messages").insert({ conversation_id: convId, role: "user", content: content.question });

  const started = Date.now();
  const answer = await answerWhatsapp({
    baseCode: id.baseCode,
    track: id.track,
    chatSpaceId: spaceId,
    question: content.question,
    history,
    imageParts: content.imageParts,
    dataContext: content.dataContext,
  });

  if (convId) {
    await db.from("messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: answer,
      latency_ms: Date.now() - started,
    });
  }
  await sendWhatsappText(rt, from, answer);
}

type WaPayload = { entry?: Array<{ changes?: Array<{ value?: { messages?: WaMessage[] } }> }> };

/** Percorre o payload do webhook e responde cada mensagem. */
export async function processWebhook(rt: WhatsappRuntime, payload: unknown): Promise<void> {
  const p = payload as WaPayload;
  for (const entry of p.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        const from = msg.from;
        if (!from) continue;
        // Dedupe: a Meta reenvia eventos — não responde duas vezes.
        if (msg.id && (await alreadyProcessed(msg.id))) continue;
        // Rate-limit por remetente (barra loops/abuso).
        if (!rateLimitOk(from)) {
          console.warn("[whatsapp] rate-limit:", maskPhone(from));
          continue;
        }
        await handleMessage(rt, msg).catch((e) => console.error("[whatsapp] mensagem:", maskPhone(from), e));
      }
    }
  }
}
