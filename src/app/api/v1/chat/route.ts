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
import { parseFields, fieldsContextBlock, formAssistDirective, continuationNote, buildFormTools, type UiAction } from "@/lib/chat/form-fields";
import { buildChartTool, buildReportTool, visualsDirective, pedeVisualizacao } from "@/lib/chat/report-tools";
import { newRegistry } from "@/lib/chat/datasets";
import type { ChartSpec } from "@/lib/chat/chart-spec";
import type { ReportSpec } from "@/lib/reports/report-spec";
import { renderReportPdf, type BrandInfo } from "@/lib/reports/pdf";
import { buildIntegrationTools, identityFromTrack } from "@/lib/integrations/tool-builder";
import { glossarioCasado } from "@/lib/ai/ontology";
import { withPrefixCache } from "@/lib/ai/anthropic-cache";
import { notaDataAtual } from "@/lib/ai/current-date";
import { pedeCompletude, notaCompletude, pedeEnumeracao, notaEnumeracao, pedeTutorial } from "@/lib/ai/answer-style";
import { tenantKey, checkQuota, acquireSlot, releaseSlot } from "@/lib/ai/tenant-guard";
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
    continuation?: unknown;
    executedActions?: unknown;
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
  // Pedido de passo a passo/guia → busca MAIS trechos (conteúdo completo) e reforça
  // a completude no prompt; perguntas comuns seguem enxutas. Enumeração ("todos os
  // X") também amplia (limite/tokens) e traz a lista inteira dos arquivos.
  const enumera = pedeEnumeracao(question);
  const compl = pedeCompletude(question);
  // Tutorial ("como uso essa tela") também amplia o teto de saída, para o guiado
  // listar TODOS os campos sem truncar — mas SEM a nota de passo a passo (as
  // explicações vão nos passos da ferramenta, não num texto longo).
  const completo = compl || enumera || pedeTutorial(question);
  // Escopo do chatbot: TODAS as documentações vinculadas à chave (um `scope`
  // por botão só NARROW dentro delas — nunca escapa da chave).
  const ragSources = social
    ? []
    : await retrievePublicContext(
        key.space_ids,
        await interpretarConsulta(key.space_ids, question, messages, pageContextHint(page)),
        completo ? 18 : 8,
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
  // Assistente de formulário (por chave): a IA lê os campos da tela e pode PROPOR
  // preencher/operar. Declarado ANTES das tools porque habilita o gate "precisa de
  // dados?" (interação de tela não carrega as ferramentas de dados).
  const formAssist = key.config?.formAssist === true;
  // Datasets do turno: as ferramentas registram as listas completas aqui e o
  // relatório referencia por id — o PDF sai com TODAS as linhas (#4).
  const datasets = newRegistry();
  const integ = track.p_base
    ? await buildIntegrationTools(track.p_base, identityFromTrack(track), outFiles, runMeta, question, formAssist, datasets)
    : { tools: {}, capabilities: "", agentPrompt: "" };
  // Ler DADOS/VALORES da tela (varredura de campos, textos, tabelas, modais) só
  // acontece com o "Assistente de formulário" LIGADO. Desligado, o servidor
  // IGNORA payload.pageContent — o bot não recebe nem retorna valores da tela
  // (só a localização, que é metadado). Gate autoritativo (não confia no cliente).
  const scanBlock = formAssist ? pageContentBlock(payload.pageContent) : "";
  const screenFields = formAssist ? parseFields(payload.fields) : [];
  // Loop autônomo do assistente de tela: o widget executou uma ação, re-varreu a
  // tela e pede que a IA CONTINUE (não é nova pergunta do usuário).
  const continuation = formAssist && payload.continuation === true;
  const executedActions = continuation && Array.isArray(payload.executedActions)
    ? payload.executedActions.slice(0, 40).map((x) => String(x).slice(0, 100))
    : [];
  const uiActions: UiAction[] = [];
  const formTools = formAssist && screenFields.length > 0 ? buildFormTools(screenFields, uiActions) : {};
  // Visualização (gráfico/relatório): habilitada onde há ferramentas de dados
  // (para plotar valores reais) OU quando o usuário PEDE um PDF/relatório/gráfico
  // — aí o conteúdo pode vir da DOCUMENTAÇÃO (ex.: um passo a passo em PDF).
  const temIntegTools = Object.keys(integ.tools).length > 0;
  const temVisual = temIntegTools || pedeVisualizacao(question);
  const chartSpecs: ChartSpec[] = [];
  const reportSpecs: ReportSpec[] = [];
  const visualTools = temVisual
    ? { ...buildChartTool(chartSpecs), ...buildReportTool(reportSpecs, datasets) }
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
  // desambiguação re-envia a mesma pergunta e não deve duplicá-la. A continuação do
  // loop autônomo também não é nova pergunta — não reinsere.
  if (!payload.scope && !continuation) {
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

  // Multi-tenant (B): teto de uso diário + semáforo de concorrência POR BASE
  // (fair-share entre os clientes; protege o provedor e a fatura). Distribuído.
  const tenant = tenantKey(track.p_base, key.space_id);
  const avisoStream = (msg: string) =>
    new ReadableStream({
      start(c) {
        c.enqueue(sse({ type: "citations", citations: [] }));
        c.enqueue(sse({ type: "token", value: msg }));
        c.enqueue(sse({ type: "done", conversationId: convId }));
        c.close();
      },
    });
  const quota = await checkQuota(tenant);
  if (!quota.ok)
    return sseResponse(avisoStream("O limite de uso da IA desta base para hoje foi atingido. Tente novamente mais tarde ou fale com o suporte."), cors);
  const lease = await acquireSlot(tenant);
  if (lease === null)
    return sseResponse(avisoStream("Estamos com muitas solicitações simultâneas agora. Tente novamente em instantes."), cors);

  const result = streamText({
    // Sem isto a falha do provedor (chave inválida, crédito esgotado, timeout)
    // vira um stream VAZIO: o usuário vê as fontes e nenhuma resposta, sem
    // pista do motivo. O cliente também trata resposta vazia como erro.
    onError: ({ error }) => {
      console.error("[chat] falha ao gerar resposta:", error);
    },
    model: await chatModel({ kind: "user", ...track }),
    // Teto de saída generoso: passo a passo/guia pode ser longo — não deixar o
    // padrão conservador do provedor cortar a resposta pela metade.
    maxOutputTokens: completo ? 8192 : 4096,
    system: composeSystemPrompt(
      {
        persona,
        especializacao: integ.agentPrompt,
        usoFerramentas: [
          integ.capabilities,
          screenFields.length > 0 ? formAssistDirective() : "",
          temVisual ? visualsDirective() : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        regras: resolveRegras(aP.regras_absolutas),
        comTools: temTools,
      },
      [
        notaDataAtual(),
        enumera ? notaEnumeracao() : compl ? notaCompletude() : "",
        buildContextBlock(sources),
        attach.contextBlock,
        pageChangeNote(prevPage, page),
        pageContextNote(page),
        scanBlock,
        continuation ? continuationNote(executedActions) : "",
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
    messages: withPrefixCache(withImageParts(messages, attach.imageParts, attach.fileParts), temTools),
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
        if (a.tipo === "fill") controller.enqueue(sse({ type: "fill", ref: a.ref, label: a.label, valor: a.valor, ...(a.valores ? { valores: a.valores } : {}) }));
        else if (a.tipo === "check") controller.enqueue(sse({ type: "check", ref: a.ref, label: a.label, marcar: a.marcar }));
        else if (a.tipo === "click") controller.enqueue(sse({ type: "click", ref: a.ref, label: a.label }));
        else if (a.tipo === "tutorial") controller.enqueue(sse({ type: "tutorial", passos: a.passos }));
      }
      // Persiste a MÍDIA na mensagem para reexibir no histórico: gráfico = spec
      // inline (leve); arquivo = upload no bucket privado `chat-media` (o caminho
      // fica na mensagem; a URL assinada é emitida ao ler o histórico).
      const media: Array<Record<string, unknown>> = [];
      for (const c of chartSpecs) media.push({ kind: "chart", spec: c });
      for (const f of outFiles) {
        try {
          const nome = (f.filename || "arquivo").replace(/[^\w.\-]+/g, "_").slice(0, 120);
          const path = `${convId}/${crypto.randomUUID()}-${nome}`;
          const { error } = await supabase.storage
            .from("chat-media")
            .upload(path, Buffer.from(f.base64, "base64"), { contentType: f.mimeType, upsert: false });
          if (!error) media.push({ kind: "file", path, filename: f.filename, mimeType: f.mimeType });
        } catch (e) {
          console.error("[chat] falha ao persistir mídia:", e);
        }
      }
      const usage = await Promise.resolve(result.usage).catch(() => null);
      await supabase.from("messages").insert({
        conversation_id: convId!,
        role: "assistant",
        content: full,
        citations: citations as never,
        media: (media.length ? media : null) as never,
        latency_ms: Date.now() - started,
        tokens: usage?.totalTokens ?? null,
        input_tokens: usage?.inputTokens ?? null,
        output_tokens: usage?.outputTokens ?? null,
      });
      controller.enqueue(sse({ type: "done", conversationId: convId }));
      controller.close();
      await releaseSlot(lease); // libera o slot da base ao encerrar o stream
    },
    cancel() {
      void releaseSlot(lease); // cliente desconectou → libera o slot
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
