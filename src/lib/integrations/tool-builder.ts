import "server-only";
import { tool, type ToolSet } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBaseContext, loadCredentialSecret } from "./resolve";
import { buildModelSchema, identityFromTrack, type Identity } from "./params";
import { executeTool, type ExecResult } from "./executor";
import { extractDocumentsFromResult, type OutFile } from "./documents";
import { resolveIdentity } from "./identity-resolver";
import { perfilAtende, acessoFerramenta } from "./gating";
import { analisarPedido, toolNoRecorte, type ModuleTag } from "./module-select";
import { injetarDataset, type DatasetRegistry } from "@/lib/chat/datasets";
import { runGuard } from "./guards";
import { escopoDoPainel, aplicarEscopoParams, loopSobEscopo, filtrarProprioDosResultados } from "./panel-scope";
import { selecionarTopK } from "./tool-narrow";
import { buildConfirmDeps } from "./confirmations";

/** Teto de ferramentas expostas ao modelo por turno (2º estágio do roteamento). Mantém
 *  o payload enxuto e a escolha precisa mesmo com módulos gordos. Ver tool-narrow.ts. */
const MAX_TOOLS_MODELO = 12;
import { getCachedExecMeta, cacheArgsKey, filtrarPorTermo, dedupItems } from "./tool-cache";
import { expandirMeses } from "./loop";
import { logToolRun } from "./run-log";
import { sanitizarBody } from "./run-log-sanitize";
import { ANTHROPIC_CACHE } from "@/lib/ai/anthropic-cache";

export { identityFromTrack };

export type IntegrationBundle = {
  tools: ToolSet;
  /** Nota de uso das ferramentas + especialidades (seção "Uso das Ferramentas"). */
  capabilities: string;
  /** Prompt do agente ativo (ex.: Nati) — vira a seção "Especialização". */
  agentPrompt: string;
  /** Nome do agente que virou persona (para diagnóstico/log). `null` se nenhum. */
  agentName?: string | null;
};

/**
 * Monta as tools do AI SDK para uma base: as APIs HABILITADAS que pertencem a um
 * AGENTE ATIVO (curadoria). Sem nenhum agente ativo, expõe todas as habilitadas
 * (para funcionar antes de configurar agentes).
 *
 * A IA só enxerga os parâmetros `origem=modelo` (buildModelSchema). Identidade e
 * segredos entram no `execute`, no servidor — o modelo nunca os fornece.
 */
export async function buildIntegrationTools(
  baseCode: string,
  identity: Identity,
  /** Coletor de ARQUIVOS retornados pelas APIs (base64) — o canal os entrega. */
  sink?: OutFile[],
  /** Metadados do turno para o log de execução (ex.: a conversa). */
  runMeta?: { conversationId?: string | null },
  /** Pergunta do usuário (Opção A) — habilita a análise do pedido. */
  question?: string,
  /** Assistente de tela (formAssist) ligado — habilita o gate "precisa de dados?". */
  screenAssist?: boolean,
  /** Registro de datasets do turno — para o relatório usar os dados COMPLETOS (#4). */
  datasets?: DatasetRegistry,
  /** Trace do fluxo (rastreio) — registra as decisões desta etapa passo a passo. */
  onPasso?: (passo: string, info?: Record<string, unknown>) => void,
  /** Pula a análise-LLM do pedido (`analisarPedido`) — usado em turnos de OPERAÇÃO DE
   *  TELA (coleta/sugestão de filtro) onde as tools de integração são cortadas de
   *  qualquer forma. Mantém a PERSONA e as capacidades; só evita a ida ao modelo (~1s). */
  skipAnalise?: boolean,
  /** Keys que NUNCA podem ser cortadas pelo top-K (ex.: a tool forçada pelo escopo do widget). */
  sempreIncluir?: string[],
): Promise<IntegrationBundle> {
  const ctx = await loadBaseContext(baseCode);
  if (!ctx || ctx.tools.length === 0) {
    onPasso?.("integracoes", { resultado: "sem tools", motivo: "base sem contexto ou sem ferramentas" });
    return { tools: {}, capabilities: "", agentPrompt: "" };
  }

  // ANÁLISE DO PEDIDO (Opção A + gate de dados) — ANTES do login/agentes, para
  // sair cedo quando é só INTERAÇÃO DE TELA / how-to (não precisa de nada disso →
  // menos tokens e resposta mais rápida). Só classifica quando faz sentido: a base
  // usa roteamento por assunto OU o assistente de tela está ligado.
  let recorte: ModuleTag[] = [];
  if (!skipAnalise && question?.trim() && (ctx.toolRouting || screenAssist)) {
    const tags = ctx.tools.flatMap((t) => t.modules);
    const analise = await analisarPedido(question, tags);
    onPasso?.("integracoes:analise", {
      precisaDados: analise.precisaDados,
      modulos: analise.modulos.map((m) => (m.submodulo ? `${m.modulo}/${m.submodulo}` : m.modulo)),
    });
    if (!analise.precisaDados) {
      onPasso?.("integracoes", { resultado: "sem tools", motivo: "classificador: pedido não precisa de dados (how-to/documentação)" });
      return { tools: {}, capabilities: "", agentPrompt: "" };
    }
    recorte = analise.modulos;
  } else if (skipAnalise) {
    // Operação de tela: sem narrowing (recorte=[] → todas as curadas) e sem LLM. A
    // PERSONA/capacidades ainda são montadas abaixo; as tools são cortadas na rota.
    onPasso?.("integracoes:analise", { pulado: true, motivo: "operação de tela (persona sem análise-LLM)" });
  }
  const routingAtivo = recorte.length > 0;

  // "Login" no servidor: se a credencial da base tem session_key, valida o
  // usuário e enriquece a identidade (CPF, perfil) antes de montar as tools.
  // Falha na validação = sem tools de dados (mas o RAG segue).
  // Eixos de permissão (#4): o PERFIL de acesso à ferramenta é o p_perfil CRU do
  // token (ex.: "MASTER") — não o gestor/colaborador do login (esse só escolhe o
  // AGENTE). O OPERADOR (portal PO) tem acesso full às tools, restrito apenas pela
  // allowlist de perfil. Capturado ANTES do login sobrescrever `ident.perfil`.
  const perfilAcesso = identity.perfil;
  const portalAcesso = identity.portal;
  const operador = (portalAcesso ?? "").trim().toUpperCase() === "PO";

  let ident = identity;
  let profileNote = "";
  let profileEmail: string | null = null;
  const primary = ctx.tools.find((t) => t.credentialId && t.baseUrl);
  if (primary && identity.cod_empresa && identity.matricula) {
    const cred = await loadCredentialSecret(primary.credentialId!);
    if (cred?.secret.session_key) {
      const res = await resolveIdentity({ baseUrl: primary.baseUrl!, credential: cred, identity });
      if (!res.ok) {
        // Falha do login do colaborador — antes invisível no trace. Agora registra o
        // MOTIVO (login_recusado / sem_resposta / timeout / erro_rede) para diagnóstico.
        onPasso?.("identidade", { validado: false, motivo: res.motivo ?? "falha", operador, empresa: identity.cod_empresa });
        // O OPERADOR (portal PO) tem acesso full que NÃO depende do login do colaborador:
        // segue com a identidade do token (sem enriquecer) em vez de perder todas as tools.
        // Os demais painéis falham FECHADO (sem tools de dados; só documentação).
        if (!operador) {
          return {
            tools: {},
            capabilities:
              "Não foi possível validar este usuário no sistema agora. Responda apenas com a " +
              "documentação e oriente-o a procurar o RH para dados pessoais.",
            agentPrompt: "",
          };
        }
      } else {
        ident = res.identity;
        profileEmail = res.profile?.email ?? null;
        if (res.profile?.nome) {
          profileNote =
            `Usuário identificado: ${res.profile.nome}` +
            (res.profile.cargo ? ` — ${res.profile.cargo}` : "") +
            (res.profile.perfil ? ` (${res.profile.perfil})` : "") +
            ". ";
        }
        onPasso?.("identidade", { validado: true, nome: res.profile?.nome ?? null, perfil: res.identity.perfil ?? null });
      }
    }
  }

  const db = createAdminClient();
  const [{ data: agents }, { data: links }] = await Promise.all([
    db.from("ai_agents").select("id, key, name, description, system_prompt, priority, requires_perfil").eq("active", true),
    db.from("ai_agent_tools").select("agent_id, tool_id"),
  ]);
  // Trava por PERFIL: um agente que exige um perfil (ex.: "gestor") só entra
  // quando o perfil resolvido no login confere — nunca vem do modelo. O OPERADOR
  // (portal PO) é elegível a TODOS os agentes (acesso full).
  const elegiveis = operador
    ? (agents ?? [])
    : (agents ?? []).filter((a) => perfilAtende(a.requires_perfil, ident.perfil));
  const elegiveisIds = new Set(elegiveis.map((a) => a.id));
  const curated = new Set((links ?? []).filter((l) => elegiveisIds.has(l.agent_id)).map((l) => l.tool_id));
  // Qual agente elegível "responde" por cada tool (para o log). O 1º vínculo vence.
  const agentKeyById = new Map(elegiveis.map((a) => [a.id, a.key]));
  const agentKeyByTool = new Map<string, string>();
  for (const l of links ?? []) {
    if (agentKeyById.has(l.agent_id) && curated.has(l.tool_id) && !agentKeyByTool.has(l.tool_id)) {
      agentKeyByTool.set(l.tool_id, agentKeyById.get(l.agent_id)!);
    }
  }
  // O fallback "expõe todas as habilitadas" só vale quando NÃO há NENHUM agente
  // ativo (setup inicial). Com agentes ativos, quem não tem agente elegível
  // fica sem tools — não com todas (senão a trava de perfil vazaria).
  const temAgentes = (agents ?? []).length > 0;

  const tools: ToolSet = {};
  // Instruções próprias das tools EXPOSTAS — concatenadas na nota de capacidades
  // (ex.: uma tool externa que precisa de um passo/formato específico).
  const promptsFerramentas: string[] = [];
  // Dedup POR TURNO + teto de chamadas: modelos às vezes re-chamam a MESMA consulta em
  // loop (ex.: Gemini 3 re-emitindo function calls sem thoughtSignature) e martelam a API
  // com a mesma matrícula dezenas de vezes. Dentro de um turno o resultado não muda: a 2ª
  // chamada idêntica (só GET/leitura) devolve o já obtido, sem rebater na API; e um teto
  // impede o loop de rodar sem fim.
  const dedupTurno = new Map<string, unknown>();
  const chaveDeArgs = (a: unknown): string => {
    if (!a || typeof a !== "object") return String(a);
    const o = a as Record<string, unknown>;
    return Object.keys(o).sort().map((k) => `${k}=${JSON.stringify(o[k])}`).join("&");
  };
  let chamadasIntegracao = 0;
  const MAX_CHAMADAS_INTEGRACAO = 40;
  // ── 1) ELEGÍVEIS: passam curadoria + acesso + recorte por assunto + escopo de painel ──
  const elegiveisTools: Array<{
    bt: (typeof ctx.tools)[number];
    escopo: ReturnType<typeof escopoDoPainel>;
    paramsEscopo: ReturnType<typeof aplicarEscopoParams>;
    loopEscopo: ReturnType<typeof loopSobEscopo>;
  }> = [];
  for (const bt of ctx.tools) {
    if (temAgentes && !curated.has(bt.toolId)) continue; // fora de todo agente ativo
    // Allowlist (#4): portal × empresa × perfil por (base, ferramenta). Vazio = liberado.
    if (
      !acessoFerramenta(
        { portais: bt.portais, empresas: bt.empresas, perfis: bt.perfis },
        { portal: portalAcesso, empresa: identity.cod_empresa, perfil: perfilAcesso, operador },
      )
    )
      continue;
    // Recorte por assunto (Opção A): só filtra tools QUE TÊM módulo/submódulo
    // parametrizado. Tool sem tag = sempre consultada (não há assunto para
    // excluir). Essenciais também passam sempre.
    if (routingAtivo && !bt.alwaysInclude && bt.modules.length > 0 && !toolNoRecorte(bt.modules, recorte)) continue;
    // ESCOPO POR PAINEL (PO/PG/PC): "nenhum" tira a tool do painel; "próprios"/"equipe"
    // reescrevem empresa/matrícula para a IDENTIDADE (a IA nem vê esses campos, então não
    // há como pedir os dados de outra pessoa). "próprios" sem matrícula do usuário FALHA
    // FECHADO — nunca cai para "todos".
    const escopo = escopoDoPainel(bt.tool.panel_scope, portalAcesso);
    if (escopo === "nenhum") {
      onPasso?.("integracoes:escopo", { tool: bt.tool.key, painel: portalAcesso ?? "?", resultado: "bloqueada" });
      continue;
    }
    if (escopo === "proprios" && !String(ident.matricula ?? "").trim()) {
      onPasso?.("integracoes:escopo", { tool: bt.tool.key, resultado: "bloqueada (sem matrícula para 'próprios')" });
      continue;
    }
    elegiveisTools.push({
      bt,
      escopo,
      paramsEscopo: aplicarEscopoParams(bt.tool.params, escopo),
      loopEscopo: loopSobEscopo(bt.tool.loop, bt.tool.params, escopo),
    });
  }

  // ── 2) TOP-K por relevância LEXICAL (menos tokens + escolha mais precisa) ──────
  // O classificador já estreitou para um assunto; aqui, nos módulos gordos (ex.: 26
  // tools), ficamos só com as MAX_TOOLS_MODELO mais relevantes à pergunta. Essenciais/
  // forçadas sempre entram; sem sinal lexical → mantém TODAS (não arrisca a assertividade).
  // Custo ZERO — sem chamada de embedding (ver tool-narrow.ts).
  const manter = selecionarTopK(
    elegiveisTools.map((e) => ({ key: e.bt.tool.key, name: e.bt.tool.name, description: e.bt.tool.description ?? "", alwaysInclude: e.bt.alwaysInclude })),
    question ?? "",
    MAX_TOOLS_MODELO,
    sempreIncluir?.length ? new Set(sempreIncluir) : undefined,
  );
  const selecionadas = elegiveisTools.filter((e) => manter.has(e.bt.tool.key));
  if (selecionadas.length < elegiveisTools.length) {
    onPasso?.("integracoes:top_k", { de: elegiveisTools.length, para: selecionadas.length, mantidas: selecionadas.map((e) => e.bt.tool.key) });
  }

  // ── 3) BUILD: monta o toolset do AI SDK só das ferramentas selecionadas ────────
  for (const { bt, escopo, paramsEscopo, loopEscopo } of selecionadas) {
    if (bt.tool.system_prompt?.trim()) promptsFerramentas.push(bt.tool.system_prompt.trim());
    tools[bt.tool.key] = tool({
      description: [bt.tool.description, bt.tool.response_hint].filter(Boolean).join(" "),
      inputSchema: buildModelSchema(paramsEscopo, loopEscopo),
      // Envelopa o retorno: se for uma LISTA, registra o dataset completo e injeta
      // `_dataset` (o relatório usa isso p/ incluir todas as linhas — ver #4).
      execute: async (args) => {
        // Repetição IDÊNTICA no mesmo turno (loop do modelo) → devolve o já obtido, sem
        // rebater na API. Só leituras (GET); escrita nunca é deduplicada.
        const chaveDedup = String(bt.tool.method ?? "GET").toUpperCase() === "GET" ? `${bt.tool.key}:${chaveDeArgs(args)}` : null;
        if (chaveDedup && dedupTurno.has(chaveDedup)) return dedupTurno.get(chaveDedup);
        if (chamadasIntegracao >= MAX_CHAMADAS_INTEGRACAO)
          return { erro: `Já foram feitas ${MAX_CHAMADAS_INTEGRACAO} consultas nesta rodada (provável repetição em loop). Responda com o que já foi coletado; se faltar informação, peça ao usuário para refinar — menos itens por vez ou uma pergunta de cada vez.` };
        chamadasIntegracao++;
        const _resultado = injetarDataset(datasets, await (async () => {
        try {
          if (!bt.baseUrl) return { erro: "Endpoint não configurado para esta base." };
          const credential = bt.credentialId ? await loadCredentialSecret(bt.credentialId) : null;
          const modelArgs = (args ?? {}) as Record<string, unknown>;
          // runOnce: UMA chamada à API (guard por chamada + exec + cache/dedup/
          // termo/arquivos + LOG em ai_tool_runs). O guard roda POR CHAMADA para
          // validar CADA valor de um loop (ex.: cada matrícula da equipe do gestor)
          // — a matrícula-alvo nunca é confiada cega.
          const runOnce = async (callArgs: Record<string, unknown>, stepIndex: number) => {
            // Escopo por painel + "nunca os próprios": roda por CHAMADA (valida cada
            // valor de um loop). "todos" sem exclude_self dispensa a checagem.
            if (escopo !== "todos" || bt.tool.exclude_self) {
              const gp = await runGuard("escopo_painel", {
                baseUrl: bt.baseUrl!,
                baseCode,
                credential,
                identity: ident,
                modelArgs: callArgs,
                panelScope: escopo,
                excludeSelf: bt.tool.exclude_self === true,
              });
              if (!gp.ok) return { erro: gp.erro };
            }
            if (bt.tool.guard) {
              const g = await runGuard(bt.tool.guard, {
                baseUrl: bt.baseUrl!,
                baseCode,
                credential,
                identity: ident,
                modelArgs: callArgs,
                confirm: buildConfirmDeps(baseCode, profileEmail),
              });
              if (!g.ok) return { erro: g.erro };
            }
            const t0 = Date.now();
            const doExec = () =>
              executeTool({ tool: { ...bt.tool, params: paramsEscopo }, baseUrl: bt.baseUrl!, credential, modelArgs: callArgs, identity: ident });
            // Cache em memória p/ dados quase-estáticos (estrutura, equipe, cadastro):
            // evita rebater na API a cada mensagem. Só guarda resultados OK.
            let result: ExecResult | null = null;
            let threw: string | null = null;
            let cachedHit = false;
            try {
              if (bt.tool.cache_ttl) {
                const m = await getCachedExecMeta(`${baseCode}:${bt.tool.key}:${cacheArgsKey(callArgs, ident, bt.tool.cache_scope ?? undefined)}`, bt.tool.cache_ttl, doExec);
                result = m.result;
                cachedHit = m.cached;
              } else {
                result = await doExec();
              }
            } catch (e) {
              threw = e instanceof Error ? e.message : String(e);
            }
            const durationMs = Date.now() - t0;
            // Tool ESCOLHIDA + PARÂMETROS do modelo (redigidos) + cURL da chamada (segredos
            // redigidos) no trace do admin/logs — permite ver qual tool foi usada, com quais
            // argumentos, o endpoint atingido, e reproduzir/depurar a chamada.
            if (result?.request?.curl) {
              onPasso?.("integracoes:curl", {
                tool: bt.tool.key,
                params: sanitizarBody(JSON.stringify(callArgs), paramsEscopo),
                status: result.status ?? null,
                ms: durationMs,
                ...(cachedHit ? { cache: true } : {}),
                curl: result.request.curl,
              });
            }
            const registrar = (saida: unknown, ok: boolean, status: number | null, files: number, error: string | null) =>
              logToolRun({
                baseCode,
                conversationId: runMeta?.conversationId ?? null,
                toolKey: bt.tool.key,
                agentKey: agentKeyByTool.get(bt.toolId) ?? null,
                stepIndex,
                input: callArgs,
                request: result?.request ?? null,
                params: paramsEscopo,
                status,
                ok,
                output: saida,
                files,
                cached: cachedHit,
                durationMs,
                error,
              });

            if (threw || !result) {
              await registrar(null, false, null, 0, threw ?? "Sem resposta da API.");
              return { erro: threw ?? "Falha na chamada à API." };
            }
            if (!result.ok) {
              await registrar(result.data, false, result.status, 0, `HTTP ${result.status}`);
              return { erro: `A API retornou HTTP ${result.status}.`, dados: result.data };
            }
            // Listas cacheáveis (estrutura, equipe): remove linhas duplicadas da API.
            // E se a IA passou `termo`, filtra por nome — devolve só os casamentos
            // (menos tokens). Sem termo, devolve a lista (já deduplicada).
            let dados = bt.tool.cache_ttl ? dedupItems(result.data) : result.data;
            const termo = typeof callArgs.termo === "string" ? callArgs.termo.trim() : "";
            if (termo) dados = filtrarPorTermo(dados, termo);
            // "Nunca os próprios dados" (ex.: desligamento): tira as linhas do usuário
            // que a API por acaso devolveu (backstop do guard, que barra pedir a si).
            if (bt.tool.exclude_self) dados = filtrarProprioDosResultados(dados, String(ident.matricula ?? ""));
            // Arquivos em base64 são extraídos (para o canal entregar) e o base64
            // é removido do que volta ao modelo.
            const { cleaned, files } = extractDocumentsFromResult(dados);
            if (sink && files.length) sink.push(...files);
            await registrar(cleaned, true, result.status, files.length, null);
            return cleaned;
          };
          // LOOP: o usuário pediu vários → o servidor itera e AGREGA num só
          // resultado (o modelo faz UMA chamada em vez de N). Sob "próprios" o loop
          // de matrícula/empresa é desligado (loopEscopo) — consulta é do próprio.
          const loop = loopEscopo;
          // (a) Período mês a mês: modelo informa from/to; itera cada mês.
          if (loop?.unit === "month") {
            const inicio = loop.from ? String(modelArgs[loop.from] ?? "") : "";
            const fim = loop.to ? String(modelArgs[loop.to] ?? "") : "";
            const { lista, excedeu } = expandirMeses(inicio, fim || null, loop.max ?? 24);
            if (lista.length === 0) return { erro: `Preciso do mês (ou período) em ${loop.from}, no formato ISO AAAA-MM.` };
            const build = (a: Record<string, unknown>, iso: string) => {
              const c = { ...a, [loop.param]: iso };
              if (loop.from) delete c[loop.from];
              if (loop.to) delete c[loop.to];
              return c;
            };
            if (lista.length === 1) return await runOnce(build(modelArgs, lista[0]!.iso), 0);
            const meses: Array<Record<string, unknown>> = [];
            for (const [i, mes] of lista.entries()) meses.push({ competencia: mes.br, dados: await runOnce(build(modelArgs, mes.iso), i) });
            return {
              periodo: `${lista[0]!.br} a ${lista[lista.length - 1]!.br}`,
              meses,
              ...(excedeu ? { aviso: `Período longo: limitei aos primeiros ${lista.length} meses. Peça o restante em outra consulta.` } : {}),
            };
          }
          // (b) Lista de valores: a API aceita 1 por chamada; o modelo passa vários
          // no `param` e o servidor consulta cada um (ex.: várias matrículas).
          if (loop?.unit === "values") {
            const raw = modelArgs[loop.param];
            let valores = (Array.isArray(raw) ? raw : raw != null && raw !== "" ? [raw] : [])
              .map((v) => String(v).trim())
              .filter(Boolean);
            // pessoa: lista vazia = o PRÓPRIO usuário (mantém a semântica de origem=pessoa —
            // Colaborador que não informa matrícula consulta a si). O guard valida cada valor.
            const pLoop = bt.tool.params.find((pp) => pp.nome === loop.param);
            if (valores.length === 0 && pLoop?.origem === "pessoa" && ident.matricula) valores = [String(ident.matricula)];
            if (valores.length === 0) {
              // O loop é otimização p/ MÚLTIPLOS valores (separados por vírgula), não obrigação.
              // Se o param do loop é OPCIONAL (não `obrigatorio`), uma chamada SEM ele é válida
              // (a API aceita o filtro em branco = todos) → faz uma chamada única e a API decide.
              // Só EXIGE valor quando o param é marcado obrigatório. Ex.: listar colaboradores por
              // cargo numa tool cujo loop é sobre matrícula (opcional).
              if (pLoop?.obrigatorio) return { erro: `Informe ao menos um valor em ${loop.param}.` };
              return await runOnce(modelArgs, 0);
            }
            const max = loop.max ?? 20;
            const usados = valores.slice(0, max);
            if (usados.length === 1) return await runOnce({ ...modelArgs, [loop.param]: usados[0]! }, 0);
            const itens: Array<Record<string, unknown>> = [];
            for (const [i, v] of usados.entries()) itens.push({ valor: v, dados: await runOnce({ ...modelArgs, [loop.param]: v }, i) });
            return { itens, ...(valores.length > max ? { aviso: `Muitos valores: consultei os primeiros ${max}.` } : {}) };
          }
          // (c) BATCH: a API aceita uma LISTA por vírgula, mas um request com MUITOS itens
          // estoura o limite de tamanho. O modelo passa todos; o servidor FATIA em lotes de
          // `max` (junta cada lote com vírgula) e faz UMA chamada por lote, agregando.
          if (loop?.unit === "batch") {
            const raw = modelArgs[loop.param];
            const valores = (Array.isArray(raw) ? raw : raw != null && raw !== "" ? [raw] : [])
              .flatMap((v) => String(v).split(","))
              .map((v) => v.trim())
              .filter(Boolean);
            if (valores.length === 0) {
              // Idem "values": só exige o param do loop quando ele é `obrigatorio`. Opcional e
              // sem valor → uma chamada única sem ele (a API decide); com valores → segue o batch.
              const pLoopB = bt.tool.params.find((pp) => pp.nome === loop.param);
              if (pLoopB?.obrigatorio) return { erro: `Informe ao menos um valor em ${loop.param}.` };
              return await runOnce(modelArgs, 0);
            }
            const size = Math.max(1, loop.max ?? 20);
            const MAX_LOTES = 20; // teto de chamadas do batch (protege o teto de 40/turno)
            const lotes: string[] = [];
            for (let i = 0; i < valores.length; i += size) lotes.push(valores.slice(i, i + size).join(","));
            const usados = lotes.slice(0, MAX_LOTES);
            if (usados.length === 1) return await runOnce({ ...modelArgs, [loop.param]: usados[0]! }, 0);
            const itens: Array<Record<string, unknown>> = [];
            for (const [i, lote] of usados.entries()) itens.push({ valor: lote, dados: await runOnce({ ...modelArgs, [loop.param]: lote }, i) });
            return { itens, ...(lotes.length > MAX_LOTES ? { aviso: `Muitos itens: enviei os primeiros ${MAX_LOTES * size}. Peça o restante em outra consulta.` } : {}) };
          }
          return await runOnce(modelArgs, 0);
        } catch (e) {
          return { erro: e instanceof Error ? e.message : String(e) };
        }
        })());
        if (chaveDedup) dedupTurno.set(chaveDedup, _resultado);
        return _resultado;
      },
    });
  }

  if (Object.keys(tools).length === 0) {
    onPasso?.("integracoes", { resultado: "sem tools", motivo: "nenhuma ferramenta sobrou após os filtros de acesso/recorte" });
    return { tools: {}, capabilities: "", agentPrompt: "" };
  }

  // Cache de prompt (Anthropic): um breakpoint na ÚLTIMA ferramenta cacheia todo
  // o bloco de ferramentas (idêntico entre turnos) — re-chamadas ~10× mais
  // baratas. Ignorado por OpenAI/Google.
  const chaves = Object.keys(tools);
  (tools[chaves[chaves.length - 1]!] as { providerOptions?: unknown }).providerOptions = ANTHROPIC_CACHE;

  // Nota de capacidades para o system prompt (ajuda a rotear documentação × API).
  const especialidades = elegiveis
    .filter((a) => (links ?? []).some((l) => l.agent_id === a.id && curated.has(l.tool_id)))
    .map((a) => `- ${a.name}: ${a.description}`)
    .join("\n");
  const capabilities =
    profileNote +
    "Você tem FERRAMENTAS para consultar dados reais do sistema do usuário. Decida sozinho a melhor fonte: " +
    "use as FERRAMENTAS para dados/registros específicos (nunca invente valores) e a DOCUMENTAÇÃO para " +
    "dúvidas de uso, conceitos e como-fazer. Você pode COMBINAR as duas quando ajudar — ex.: trazer o dado " +
    "real por uma ferramenta e explicar o procedimento pela documentação na mesma resposta. " +
    "Quando o usuário pede um DADO/registro e existe ferramenta para isso, CHAME a ferramenta — NÃO responda com o " +
    "caminho/menu do sistema nem mande extrair manualmente. O sistema já valida o acesso do usuário DENTRO da consulta: " +
    "NUNCA recuse por 'segurança', 'acesso' ou 'limitação'; se não puder, é o sistema que recusa na chamada, não você." +
    (sink
      ? " Quando uma ferramenta retornar um ARQUIVO, ele é entregue ao usuário automaticamente — apenas confirme na resposta, sem descrever bytes."
      : "") +
    (especialidades ? `\nEspecialidades disponíveis:\n${especialidades}` : "") +
    (promptsFerramentas.length ? `\n\n${promptsFerramentas.join("\n\n")}` : "");

  // Persona especializada: o agente ELEGÍVEL de maior prioridade COM prompt e
  // ≥1 tool habilitada. Vira a seção "Especialização". Agentes só de tools
  // (prompt vazio, ex.: o agente de gestor) não sobrescrevem a persona.
  const agentePersona = elegiveis
    .filter((a) => a.system_prompt?.trim() && (links ?? []).some((l) => l.agent_id === a.id && curated.has(l.tool_id)))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  const agentPrompt = agentePersona?.system_prompt?.trim() || "";

  onPasso?.("integracoes", { resultado: "tools montadas", tools: Object.keys(tools), recorte: recorte.map((m) => m.modulo) });
  return { tools, capabilities, agentPrompt, agentName: agentePersona?.name ?? null };
}
