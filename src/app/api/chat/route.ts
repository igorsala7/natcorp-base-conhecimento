import { streamText, stepCountIs } from "ai";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { chatModel, hasAiKey } from "@/lib/ai/config";
import { comContextoDeConsumo } from "@/lib/ai/usage-context";
import {
  retrieveContext,
  buildContextBlock,
} from "@/lib/ai/rag";
import { resolvePersona, resolveRegras } from "@/lib/ai/prompt-cascade";
import { composeSystemPrompt } from "@/lib/ai/system-prompt";
import { buildIntegrationTools, type IntegrationBundle } from "@/lib/integrations/tool-builder";
import { buildReportTool } from "@/lib/chat/report-tools";
import { datasetsDirective, visualsCore } from "@/lib/chat/visuals-directive";
import { newRegistry } from "@/lib/chat/datasets";
import { buildQueryTool } from "@/lib/chat/query-tools";
import { renderReport } from "@/lib/reports/exporters";
import type { ReportSpec } from "@/lib/reports/report-spec";
import type { Identity } from "@/lib/integrations/params";
import type { OutFile } from "@/lib/integrations/documents";
import { resolveCategory } from "@/lib/ai/prompts";
import { limitarHistorico } from "@/lib/ai/history";
import { interpretarConsulta } from "@/lib/ai/query-understanding";
import { ehConversaSocial } from "@/lib/ai/social";
import { analyzeAmbiguity, analyzeConfidence, resolveTheme, type ClarifyScope } from "@/lib/ai/disambiguation";
import { webSourcesParaLeitor } from "@/lib/ai/web-sources";
import { marcarCacheDeTools, withPrefixCache } from "@/lib/ai/anthropic-cache";
import { notaDataAtual } from "@/lib/ai/current-date";

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Marcador que separa o TEXTO do modelo dos ARQUIVOS (base64) no fim do stream.
 * O cliente (ChatPanel) corta aqui e transforma o JSON em links de download.
 * Usa o caractere de controle RS (\u001e), que não aparece em texto do modelo.
 * DEVE ser idêntico ao do ChatPanel.
 */
const META_MARK = "\n\u001e__META__\u001e";

/** Uso INTERNO da equipe: marcado como `admin`, fora de qualquer fatura de
 *  cliente, mas separado de `sistema` para dar para medir quanto a operação
 *  consome por conta própria. */
export async function POST(req: NextRequest) {
  return comContextoDeConsumo({ origem: "admin" }, () => handlePost(req));
}

async function handlePost(req: NextRequest) {
  const { spaceId, messages: messagesBrutas, conversationId, promptOverride, scope, contextScope, sim } = (await req.json()) as {
    spaceId: string;
    messages: ChatMessage[];
    conversationId?: string;
    /** Persona de RASCUNHO (não salva) — a página Assistente testa antes de salvar. */
    promptOverride?: string;
    /** Filtro escolhido num botão de desambiguação (re-consulta já direcionada). */
    scope?: ClarifyScope;
    /** Tema em foco na conversa (eco do servidor) — evita perguntar no mesmo assunto. */
    contextScope?: ClarifyScope;
    /** Identidade SIMULADA (página Assistente testando como usuário de uma base). */
    sim?: { base_code?: string; usuario?: string; empresa?: string; matricula?: string; perfil?: string; portal?: string };
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
  const ragSources = social
    ? []
    : await retrieveContext(spaceId, await interpretarConsulta(spaceId, question, messages), 8, scope);
  // Fontes da web (leitor citou uma URL permitida): numeradas após a documentação.
  const webSources = social ? [] : await webSourcesParaLeitor(question, ragSources.length + 1);
  const sources = [...ragSources, ...webSources];

  // Assistente do admin: mesma persona que o leitor vê, para o que se testa
  // aqui corresponder ao que o público recebe.
  // Se o body TROUXE `promptOverride` (página Assistente testando antes de
  // salvar), ele vence o banco — SEM persistir e SEM pular as REGRAS_ABSOLUTAS
  // (a cascata segue acrescentando citar fonte / não inventar). Rascunho vazio =
  // testar o padrão do produto. Sem o campo → lê a persona salva do espaço.
  const aP = await resolveCategory("assistente");
  let persona: string;
  if (promptOverride !== undefined) {
    persona = resolvePersona({ promptDoEspaco: promptOverride.trim() || null, personaPadrao: aP.persona_padrao });
  } else {
    const { data: espaco } = await supabase
      .from("spaces")
      .select("chat_prompt")
      .eq("id", spaceId)
      .maybeSingle();
    persona = resolvePersona({ promptDoEspaco: espaco?.chat_prompt ?? null, personaPadrao: aP.persona_padrao });
  }

  // Identidade SIMULADA (página Assistente): monta as ferramentas da base (Nati)
  // e resolve o login, como um usuário real do widget. Só quem administra
  // integrações pode simular — o restante ignora `sim` (chat de documentação normal).
  const outFiles: OutFile[] = [];
  // Registro de datasets do turno (ids `dsN` que as ferramentas visuais expandem).
  const datasets = newRegistry();
  // Holder lido pelo log de execução no momento da chamada (após a conversa existir).
  const runMeta: { conversationId: string | null } = { conversationId: null };
  let integ: IntegrationBundle = { tools: {}, capabilities: "", agentPrompt: "" };
  if (sim?.base_code && (await hasPermission("integrations.manage", null))) {
    const identity: Identity = {
      usuario: sim.usuario || undefined,
      cod_empresa: sim.empresa || undefined,
      matricula: sim.matricula || undefined,
      perfil: sim.perfil || undefined,
      portal: sim.portal || undefined,
    };
    integ = await buildIntegrationTools(sim.base_code, identity, outFiles, runMeta, question, undefined, datasets);
  }
  // Este chat é o SIMULADOR do agente: sem as ferramentas visuais, um admin testando
  // "gera um excel" via uma recusa que a produção não daria — falso negativo caro.
  // Só `gerar_relatorio`: o arquivo aparece como download aqui. `montar_grafico` fica
  // de FORA porque este painel não renderiza o card de gráfico — dar a ferramenta seria
  // criar um buraco silencioso (o modelo chamaria e nada apareceria).
  const reportSpecs: ReportSpec[] = [];
  const temIntegTools = Object.keys(integ.tools).length > 0;
  const visualTools = buildReportTool(
    reportSpecs,
    datasets,
    (spec) => renderReport(spec, { marca: "Relatório", primariaHex: "#511C76", dataHoje: "Gerado em " + new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) }),
    outFiles,
  );
  // Breakpoint de cache no FIM da lista (ver marcarCacheDeTools).
  const allTools = marcarCacheDeTools({ ...integ.tools, ...visualTools, ...(temIntegTools ? buildQueryTool(datasets) : {}) });
  const temTools = Object.keys(allTools).length > 0;

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
  runMeta.conversationId = convId ?? null; // o log de execução usa este id
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
  const tema = resolveTheme(ragSources);
  if (tema) baseHeaders["X-Theme"] = Buffer.from(JSON.stringify(tema)).toString("base64");

  // Contexto fraco → recusa (proibido responder por conhecimento geral). Quando
  // há FERRAMENTAS (simulação de base), não recusa: a IA pode consultar as APIs.
  if (sources.length === 0 && !social && !temTools) {
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
  if (!scope && !social && webSources.length === 0 && !temTools) {
    const dis =
      analyzeAmbiguity(ragSources, contextScope ?? null) ??
      analyzeConfidence(ragSources, contextScope ?? null);
    if (dis) return Response.json({ type: "clarify", ...dis }, { headers: baseHeaders });
  }

  const result = streamText({
    // Sem isto a falha do provedor (chave inválida, crédito esgotado, timeout)
    // vira um stream VAZIO: o usuário vê as fontes e nenhuma resposta, sem
    // pista do motivo. O cliente também trata resposta vazia como erro.
    onError: ({ error }) => {
      console.error("[chat] falha ao gerar resposta:", error);
    },
    model: await chatModel({ origem: "admin" }),
    system: composeSystemPrompt(
      {
        persona,
        especializacao: integ.agentPrompt,
        usoFerramentas: [integ.capabilities, visualsCore({ comGrafico: false }), temIntegTools ? datasetsDirective() : ""].filter(Boolean).join("\n\n"),
        regras: resolveRegras(aP.regras_absolutas),
        comTools: temTools,
      },
      [notaDataAtual(), buildContextBlock(sources)].filter(Boolean).join("\n\n"),
    ),
    // Cache de prompt: com ferramentas, marca a ÚLTIMA mensagem para a Anthropic
    // reaproveitar system + histórico entre os steps do loop agêntico.
    messages: withPrefixCache(
      messages.map((m) => ({ role: m.role, content: m.content })),
      temTools,
    ),
    // Loop agêntico só quando a simulação trouxe ferramentas de uma base.
    ...(temTools ? { tools: allTools, stopWhen: stepCountIs(8) } : {}),
    onFinish: async ({ text, usage }) => {
      await supabase.from("messages").insert({
        conversation_id: convId!,
        role: "assistant",
        content: text,
        citations: sources.map((s) => ({ n: s.n, title: s.title, url: s.url, image: s.image, heading_path: s.heading_path })) as never,
        latency_ms: Date.now() - started,
        tokens: usage?.totalTokens ?? null,
        input_tokens: usage?.inputTokens ?? null,
        output_tokens: usage?.outputTokens ?? null,
      });
    },
  });

  // Stream de texto do modelo; no fim, após o marcador, vai um bloco de METADADOS
  // (JSON): os ARQUIVOS (base64 → download) e o CONSUMO de tokens deste turno.
  // O cliente corta o marcador, mostra os arquivos e a contagem de tokens.
  // (`onFinish` acima persiste só o texto e os tokens — sem os bytes.)
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of result.textStream) controller.enqueue(enc.encode(delta));
      } catch {
        /* stream vazio/erro do provedor: o cliente exibe a mensagem de falha */
      }
      const meta: {
        files?: { filename: string; mimeType: string; dataUrl: string }[];
        usage?: { total: number | null; input: number | null; output: number | null };
      } = {};
      if (outFiles.length) {
        meta.files = outFiles.map((f) => ({
          filename: f.filename,
          mimeType: f.mimeType,
          dataUrl: `data:${f.mimeType};base64,${f.base64}`,
        }));
      }
      // totalUsage = soma de TODOS os passos do turno (não só o último) — o consumo
      // exibido tem que refletir o turno inteiro, incluindo tools/coleta.
      const u = await Promise.resolve(result.totalUsage).catch(() => null);
      if (u) meta.usage = { total: u.totalTokens ?? null, input: u.inputTokens ?? null, output: u.outputTokens ?? null };
      if (Object.keys(meta).length) controller.enqueue(enc.encode(META_MARK + JSON.stringify(meta)));
      controller.close();
    },
  });

  return new Response(body, { headers: { ...baseHeaders, "Content-Type": "text/plain; charset=utf-8" } });
}
