import "server-only";
import { generateText, stepCountIs } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatModel } from "@/lib/ai/config";
import { retrievePublicContext, buildContextBlock } from "@/lib/ai/rag";
import { resolvePersona, resolveRegras } from "@/lib/ai/prompt-cascade";
import { composeSystemPrompt } from "@/lib/ai/system-prompt";
import { resolveCategory } from "@/lib/ai/prompts";
import { glossarioCasado } from "@/lib/ai/ontology";
import { buildIntegrationTools, identityFromTrack } from "@/lib/integrations/tool-builder";
import { withImageParts, type ImagePart } from "@/lib/chat/attachment-store";
import type { OutFile } from "@/lib/integrations/documents";
import type { TrackFields } from "@/lib/tracking/resolve";
import type { WhatsappRuntime } from "./config";
import { identifyByPhone } from "./identify";
import { sendWhatsappText, sendWhatsappDocument } from "./send";
import { alreadyProcessed } from "./dedupe";
import { rateLimitOk, maskPhone } from "./util";
import { extractContent, type WaMessage } from "./media";

type Msg = { role: "user" | "assistant"; content: string };

/** Gera a resposta do chatbot (documentação + APIs + mídia) para uma mensagem. */
async function answerWhatsapp(input: {
  baseCode: string;
  track: TrackFields;
  chatSpaceIds: string[];
  question: string;
  history: Msg[];
  imageParts?: ImagePart[];
  dataContext?: string;
  /** Arquivos (base64) que as APIs retornarem são coletados aqui para envio. */
  files: OutFile[];
}): Promise<string> {
  const integ = await buildIntegrationTools(input.baseCode, identityFromTrack(input.track), input.files);
  const temTools = Object.keys(integ.tools).length > 0;
  // RAG em TODAS as documentações vinculadas à base.
  const sources = await retrievePublicContext(input.chatSpaceIds, input.question, 6);
  const temImagem = !!input.imageParts?.length;
  // Ontologia: glossário do domínio para o modelo acertar tools/parâmetros.
  const glossario = await glossarioCasado(createAdminClient(), input.chatSpaceIds, input.question).catch(() => "");

  // Sem documentação, sem ferramentas, sem imagem e sem dado anexo → não responde
  // por conhecimento geral.
  if (sources.length === 0 && !temTools && !input.dataContext && !temImagem) {
    return "Não encontrei isso na documentação e não há dados para consultar por aqui. Tente reformular ou fale com o suporte.";
  }

  const aP = await resolveCategory("assistente");
  const persona = resolvePersona({ personaPadrao: aP.persona_padrao });

  const base: Msg[] = [...input.history, { role: "user", content: input.question }];
  const messages = withImageParts(base, input.imageParts ?? []);
  const { text } = await generateText({
    model: await chatModel({ kind: "user", ...input.track }, input.track?.p_base ?? ""),
    system: composeSystemPrompt(
      {
        persona,
        especializacao: integ.agentPrompt,
        usoFerramentas: integ.capabilities,
        linguagem:
          "FORMATAÇÃO (canal WhatsApp): respostas curtas; use *asteriscos* para negrito (nunca **); " +
          "listas com hífen ou números; emojis com parcimônia; sem títulos markdown (#).",
        regras: resolveRegras(aP.regras_absolutas),
        comTools: temTools,
      },
      [
        buildContextBlock(sources),
        input.dataContext,
        glossario
          ? `GLOSSÁRIO do domínio (termos canônicos e sinônimos — use-os para entender o pedido e escolher ferramentas/parâmetros): ${glossario}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
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
    .select("id, active")
    .eq("base_code", id.baseCode)
    .maybeSingle();
  if (!base || !base.active) return void (await sendWhatsappText(rt, from, rt.unidentifiedMessage));

  // Documentações do chatbot desta base (RAG usa todas; a 1ª loga a conversa).
  const { data: bs } = await db
    .from("ai_base_spaces")
    .select("space_id, position")
    .eq("base_id", base.id)
    .order("position");
  const spaceIds = (bs ?? []).map((x) => x.space_id);
  if (spaceIds.length === 0) {
    return void (await sendWhatsappText(rt, from, "Seu atendimento por aqui ainda não está configurado. Fale com o suporte."));
  }
  const spaceId = spaceIds[0]!;

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
  const files: OutFile[] = [];
  const answer = await answerWhatsapp({
    baseCode: id.baseCode,
    track: id.track,
    chatSpaceIds: spaceIds,
    question: content.question,
    history,
    imageParts: content.imageParts,
    dataContext: content.dataContext,
    files,
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
  // Entrega os arquivos que as APIs retornaram (holerite, recibo…).
  for (const f of files) await sendWhatsappDocument(rt, from, f);
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
