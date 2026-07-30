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
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  clientIp,
  extractKey,
  rateLimitOk,
} from "@/lib/widget/auth";
import { interpretarConsulta } from "@/lib/ai/query-understanding";
import { ehConversaSocial } from "@/lib/ai/social";
import { analyzeAmbiguity, analyzeConfidence, resolveTheme, type ClarifyScope } from "@/lib/ai/disambiguation";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import { resolveCategory } from "@/lib/ai/prompts";
import { webSourcesParaLeitor } from "@/lib/ai/web-sources";
import { loadAttachmentsForTurn, linkAttachments, withImageParts } from "@/lib/chat/attachment-store";
import { pageContextFields, pageContextHint, pageContextNote, pageContentBlock, pageChangeNote, mesmaPagina, type PageContext } from "@/lib/chat/page-context";
import { parseFields, fieldsContextBlock, formAssistDirective, buildFormTools, type UiAction } from "@/lib/chat/form-fields";
import { buildChartTool, buildReportTool, visualsDirective } from "@/lib/chat/report-tools";
import type { ChartSpec } from "@/lib/chat/chart-spec";
import type { ReportSpec } from "@/lib/reports/report-spec";
import { renderReportPdf, type BrandInfo } from "@/lib/reports/pdf";
import { buildIntegrationTools, identityFromTrack } from "@/lib/integrations/tool-builder";
import { glossarioCasado } from "@/lib/ai/ontology";
import { withPrefixCache } from "@/lib/ai/anthropic-cache";
import { notaDataAtual } from "@/lib/ai/current-date";
import type { OutFile } from "@/lib/integrations/documents";

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
    scope?: ClarifyScope;
    contextScope?: ClarifyScope;
    track?: unknown;
    attachmentIds?: unknown;
    page?: unknown;
    pageContent?: unknown;
    fields?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  // Tela atual do usuário (Fase 4) — DADO de contexto, nunca instrução. É só a
  // LOCALIZAÇÃO (título/caminho), não valores — segue permitida para desambiguar.
  const page = pageContextFields(payload.page);

  const key = await resolveWidgetKey(extractKey(req, payload.key));
  if (!key) return json({ error: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) {
    return json({ error: "Origem não autorizada." }, 403);
  }
  if (!await hasAiKey()) return json({ error: "IA não configurada no servidor." }, 503);
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) {
    return json({ error: "Muitas requisições. Tente em instantes." }, 429);
  }

  const messages = limitarHistorico(payload.messages);
  const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!question.trim()) return json({ error: "Mensagem vazia." }, 400);

  const supabase = createAdminClient();
  const started = Date.now();

  // Persona: a da chave vence a da documentação dona. As regras absolutas são
  // reanexadas dentro de `buildSystemPrompt` e não dependem desta leitura.
  const { data: espacoDono } = await supabase
    .from("spaces")
    .select("chat_prompt")
    .eq("id", key.space_id)
    .maybeSingle();
  const aP = await resolveCategory("assistente");
  const persona = resolvePersona({
    promptDaChave: key.system_prompt,
    promptDoEspaco: espacoDono?.chat_prompt ?? null,
    personaPadrao: aP.persona_padrao,
  });
  // Turno social (saudação, agradecimento, "tudo bem?") não passa pelo RAG:
  // responde na simpatia, sem contexto nem "não encontrei".
  const social = ehConversaSocial(question);
  // Escopo do chatbot: TODAS as documentações vinculadas à chave (um `scope`
  // por botão só NARROW dentro delas — nunca escapa da chave).
  const ragSources = social
    ? []
    : await retrievePublicContext(
        key.space_ids,
        await interpretarConsulta(key.space_ids, question, messages, pageContextHint(page)),
        8,
        payload.scope,
      );
  // Fontes da web (leitor citou uma URL permitida): numeradas após a documentação.
  const webSources = social ? [] : await webSourcesParaLeitor(question, ragSources.length + 1);
  const sources = [...ragSources, ...webSources];
  // Anexos deste turno (documentos): texto extraído, injetado como DADO.
  const attach = await loadAttachmentsForTurn(key.space_id, payload.attachmentIds);

  // Garante a conversa (persiste histórico com session_id anônimo). Isola por
  // base de cliente: uma conversationId de outro espaço/chave é descartada.
  let convId = payload.conversationId;
  let prevPage: PageContext | null = null;
  if (convId) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id, page")
      .eq("id", convId)
      .eq("space_id", key.space_id)
      .maybeSingle();
    if (!existing) convId = undefined;
    else prevPage = pageContextFields(existing.page);
  }
  // Identidade de rastreio (decodificada do token) — usada na conversa E para
  // atribuir o CONSUMO de IA a este usuário (não ao sistema).
  const track = await decodeTrackForSpace(key.space_id, payload.track);
  // Integrações (Fase F): se o token traz `p_base`, o modelo ganha ferramentas
  // para consultar as APIs daquela base. A identidade é injetada no servidor
  // (identityFromTrack) — o modelo só preenche os parâmetros de consulta.
  const outFiles: OutFile[] = [];
  // Holder lido pelo log de execução no momento da chamada (após a conversa existir).
  const runMeta: { conversationId: string | null } = { conversationId: convId ?? null };
  const integ = track.p_base
    ? await buildIntegrationTools(track.p_base, identityFromTrack(track), outFiles, runMeta)
    : { tools: {}, capabilities: "", agentPrompt: "" };
  // Assistente de formulário (por chave): a IA lê os campos da tela e pode PROPOR
  // preencher um deles. `preencher_campo` só coleta a intenção; o widget executa
  // com confirmação. As ações vão ao cliente por SSE `fill` no fim do stream.
  const formAssist = key.config?.formAssist === true;
  // Ler DADOS/VALORES da tela (varredura de campos, textos, tabelas, modais) só
  // acontece com o "Assistente de formulário" LIGADO. Desligado, o servidor
  // IGNORA payload.pageContent — o bot não recebe nem retorna valores da tela
  // (só a localização, que é metadado). Gate autoritativo (não confia no cliente).
  const scanBlock = formAssist ? pageContentBlock(payload.pageContent) : "";
  const screenFields = formAssist ? parseFields(payload.fields) : [];
  const uiActions: UiAction[] = [];
  const formTools = formAssist && screenFields.length > 0 ? buildFormTools(screenFields, uiActions) : {};
  // Visualização (gráfico/relatório): habilitada onde já há ferramentas de dados
  // (senão não há o que plotar). A IA monta o gráfico com os valores reais.
  const temIntegTools = Object.keys(integ.tools).length > 0;
  const chartSpecs: ChartSpec[] = [];
  const reportSpecs: ReportSpec[] = [];
  const visualTools = temIntegTools
    ? { ...buildChartTool(chartSpecs), ...buildReportTool(reportSpecs) }
    : {};
  const allTools = { ...integ.tools, ...formTools, ...visualTools };
  const temTools = Object.keys(allTools).length > 0;
  // Ontologia: glossário do domínio (termos canônicos + sinônimos) para o modelo
  // entender o vocabulário do usuário e acertar as ferramentas/parâmetros.
  const glossario = social ? "" : await glossarioCasado(supabase, key.space_ids, question).catch(() => "");
  if (!convId) {
    const { data: conv } = await supabase
      .from("conversations")
      .insert({
        space_id: key.space_id,
        session_id: payload.sessionId ?? null,
        ...track,
        ...(page ? { page } : {}),
      })
      .select("id")
      .single();
    convId = conv?.id;
  } else if (convId && page && !mesmaPagina(prevPage, page)) {
    // Conversa existente e a TELA mudou → atualiza a página guardada (o próximo
    // turno compara contra esta); o modelo recebe a nota de mudança de tela abaixo.
    await supabase.from("conversations").update({ page }).eq("id", convId);
  }
  runMeta.conversationId = convId ?? null; // o log de execução usa este id
  // Pergunta persistida só na 1ª chamada (sem `scope`); o clique num botão de
  // desambiguação re-envia a mesma pergunta e não deve duplicá-la.
  if (!payload.scope) {
    await supabase.from("messages").insert({
      conversation_id: convId!,
      role: "user",
      content: question,
      attachments: attach.metas as never,
    });
    // Vincula os anexos à conversa (auditoria + cascade de exclusão).
    await linkAttachments(attach.ids, convId!, key.space_id);
  }

  const citations = sources.map((s) => ({
    n: s.n,
    title: s.title,
    url: s.url,
    image: s.image,
    heading_path: s.heading_path,
  }));
  const encoder = new TextEncoder();
  const sse = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  // Contexto fraco → recusa (proibido responder por conhecimento geral).
  // Com anexo, NÃO recusa: o usuário trouxe o próprio conteúdo para a resposta.
  // Com TOOLS de integração, também não recusa: o modelo pode buscar dados na API.
  if (sources.length === 0 && !social && attach.ids.length === 0 && !scanBlock && !temTools) {
    const refusal =
      "Não encontrei exatamente isso na documentação. " +
      "Pode reformular com mais detalhes (o nome da tela ou do assunto ajuda), ou, se preferir, falar com um atendente humano.";
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

  // Desambiguação por botões (sem escolha explícita e fora do contexto atual).
  // Pulada em turnos sociais — não se "desambigua" um "oi".
  if (!payload.scope && !social && webSources.length === 0 && attach.ids.length === 0 && !scanBlock && !temTools) {
    const dis =
      analyzeAmbiguity(ragSources, payload.contextScope ?? null) ??
      analyzeConfidence(ragSources, payload.contextScope ?? null);
    if (dis) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(sse({ type: "clarify", question: dis.question, options: dis.options }));
          controller.enqueue(sse({ type: "done", conversationId: convId }));
          controller.close();
        },
      });
      return sseResponse(stream, cors);
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
        usoFerramentas: [
          integ.capabilities,
          screenFields.length > 0 ? formAssistDirective() : "",
          temIntegTools ? visualsDirective() : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        regras: resolveRegras(aP.regras_absolutas),
        comTools: temTools,
      },
      [
        notaDataAtual(),
        buildContextBlock(sources),
        attach.contextBlock,
        pageChangeNote(prevPage, page),
        pageContextNote(page),
        scanBlock,
        fieldsContextBlock(screenFields),
        glossario
          ? `GLOSSÁRIO do domínio (termos canônicos e sinônimos — use-os para entender o pedido e escolher ferramentas/parâmetros): ${glossario}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    ),
    // Cache de prompt (Anthropic): com ferramentas, cacheia system + histórico
    // na última mensagem — re-chamadas do loop agêntico ~10× mais baratas.
    messages: withPrefixCache(withImageParts(messages, attach.imageParts), temTools),
    // Loop agêntico: o modelo pode chamar uma API (ou preencher_campo), ler o
    // resultado e responder. `stopWhen` trava o loop.
    ...(temTools ? { tools: allTools, stopWhen: stepCountIs(5) } : {}),
  });

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(sse({ type: "citations", citations }));
      const tema = resolveTheme(ragSources);
      if (tema) controller.enqueue(sse({ type: "theme", scope: tema.scope, label: tema.label }));
      let full = "";
      try {
        for await (const delta of result.textStream) {
          full += delta;
          controller.enqueue(sse({ type: "token", value: delta }));
        }
      } catch {
        controller.enqueue(sse({ type: "error", message: "Falha ao gerar a resposta." }));
      }
      // Relatórios: gera o PDF (layout de marca) a partir da spec da IA e o
      // adiciona aos arquivos entregues abaixo.
      if (reportSpecs.length) {
        const brand: BrandInfo = {
          marca: key.config?.title || "Relatório",
          primariaHex: key.config?.primaryColor || "#511C76",
          dataHoje: "Gerado em " + new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        };
        for (const spec of reportSpecs) {
          try {
            outFiles.push(await renderReportPdf(spec, brand));
          } catch (e) {
            console.error("[chat] falha ao gerar PDF do relatório:", e);
          }
        }
      }
      // Arquivos retornados pelas APIs (base64) → link de download no chat.
      for (const f of outFiles) {
        controller.enqueue(
          sse({ type: "file", filename: f.filename, mimeType: f.mimeType, dataUrl: `data:${f.mimeType};base64,${f.base64}` }),
        );
      }
      // Gráficos montados pela IA → o widget renderiza um card interativo
      // (troca de tipo + exportar CSV/PNG).
      for (const c of chartSpecs) {
        controller.enqueue(sse({ type: "chart", chart: c }));
      }
      // Assistente de tela: a IA propôs operar a tela (preencher, marcar, clicar) →
      // o widget executa em ordem, confirmando só o que grava/navega.
      for (const a of uiActions) {
        if (a.tipo === "fill") controller.enqueue(sse({ type: "fill", ref: a.ref, label: a.label, valor: a.valor }));
        else if (a.tipo === "check") controller.enqueue(sse({ type: "check", ref: a.ref, label: a.label, marcar: a.marcar }));
        else controller.enqueue(sse({ type: "click", ref: a.ref, label: a.label }));
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
