import "server-only";
import { tool, type ToolSet } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBaseContext, loadCredentialSecret } from "./resolve";
import { credenciaisConectadas } from "./connect-store";
import { buildModelSchema, identityFromTrack, type Identity } from "./params";
import { executeTool, type ExecResult } from "./executor";
import { extractDocumentsFromResult, type OutFile } from "./documents";
import { limparMarcacaoHtml } from "./html-values";
import { redigirCredenciais } from "./redact-fields";
import { resolveIdentity } from "./identity-resolver";
import { logChamadaInterna } from "./run-log";
import { perfilAtende, acessoFerramenta } from "./gating";
import { analisarPedido, toolNoRecorte, type ModuleTag } from "./module-select";
import { recorteTemCobertura } from "./module-match";
import { achatarLoop, rotuloDoLoop } from "./loop-flatten";
import { injetarDatasetComRelato, type DatasetRegistry } from "@/lib/chat/datasets";
import { runGuard } from "./guards";
import { escopoDoPainel, aplicarEscopoParams, loopSobEscopo, filtrarProprioDosResultados } from "./panel-scope";
import { type InfoSelecao, selecionarTopK, dependenciasCitadas, forcaLexical, type CorteDesempate } from "./tool-narrow";
import { buildConfirmDeps } from "./confirmations";
import { recortarMeusDados, type MeusDados } from "@/lib/chat/meus-dados";

/** Teto de ferramentas expostas ao modelo por turno (2º estágio do roteamento). Mantém
 *  o payload enxuto e a escolha precisa mesmo com módulos gordos. Ver tool-narrow.ts. */
const MAX_TOOLS_MODELO = 12;
const MAX_TOOLS_COMPOSTO = 18; // COMPOSTO (multi-intenção): teto maior p/ caber as co-intenções
/** Ferramenta que devolve a lotação/vínculo do próprio usuário. */
const TOOL_MEUS_DADOS = "meus_dados";
/** 15 min: dado cadastral muda raramente, e o custo de errar para menos é uma
 *  chamada de 50ms. Independe do `cache_ttl` da ferramenta, que serve ao modelo. */
const TTL_MEUS_DADOS = 900;
import { getCachedExecMeta, cacheArgsKey, filtrarPorTermo, dedupItems } from "./tool-cache";
import { expandirMeses } from "./loop";
import { logToolRun } from "./run-log";
import { consolidarChamadas, type ChamadaHttp } from "./curl-step";
import { idDaChamada } from "@/lib/chat/tool-trace";
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
  /** Chaves marcadas como ESSENCIAIS (`always_include`) — sobrevivem até ao modo
   *  relatório, onde o resto das integrações é cortado. São a origem canônica de
   *  cadastro (colaborador, empresa, filial): sem elas, "quem são essas pessoas?"
   *  vira uma pergunta sem resposta possível. */
  essenciais?: string[];
  /** NENHUMA ferramenta do turno casou bem com o pedido (topo abaixo do piso absoluto).
   *  O assunto pode simplesmente não ter ferramenta — o modelo precisa saber disso em
   *  vez de apresentar o resultado de uma tool fraca como se fosse a resposta. */
  selecaoFraca?: { topSim: number; keys: string[] } | null;
  /** Assuntos que o classificador reconheceu na pergunta ("FÉRIAS", "PAGAMENTO"…).
   *  Dois ou mais = pedido com mais de uma parte — ver `pedidoComposto`. */
  modulos?: string[];
  /** Lotação/vínculo do PRÓPRIO usuário, já consultados (ver `meus-dados.ts`).
   *  Poupa um passo do laço agêntico nas perguntas sobre ele mesmo. */
  meusDados?: MeusDados;
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
  /** C — similaridade SEMÂNTICA da consulta com cada tool (key→sim) neste turno. Quando
   *  presente, o TOP-K seleciona por similaridade (piso relativo) em vez de só léxico. */
  sim?: Map<string, number> | null,
  /** COMPOSTO (chavinha TOOL_COMPOSITE_RELAX + pergunta composta): afrouxa a seleção
   *  semântica (piso menor, teto maior) para não perder co-intenções no multi-tool. */
  relaxComposto?: boolean,
  /** MULTI-FACETA: uma similaridade por INTENÇÃO da pergunta (ver facets.ts). Com 2+,
   *  cada intenção garante as suas ferramentas em vez de sumir no ranking único. */
  simFacetas?: { faceta: string; sim: Map<string, number> }[] | null,
  /** Registra no turno um arquivo baixado da nuvem, como se tivesse sido anexado
   *  à mão. Ausente = a ferramenta de anexar não é oferecida.
   *
   *  Vai no FIM da lista de propósito: os parâmetros aqui são POSICIONAIS, e
   *  inserir no meio desloca todos os seguintes — os chamadores passariam
   *  `sim` onde se espera `anexarArquivo` e o compilador só reclamaria por
   *  sorte de os tipos não baterem. */
  anexarArquivo?: (arq: { filename: string; mimeType: string; bytes: Buffer }) => Promise<string>,
): Promise<IntegrationBundle> {
  const ctx = await loadBaseContext(baseCode);
  if (!ctx || ctx.tools.length === 0) {
    onPasso?.("integracoes", { resultado: "sem tools", motivo: "base sem contexto ou sem ferramentas" });
    return { tools: {}, capabilities: "", agentPrompt: "" };
  }

  // DISPONIBILIDADE DE CONTA PESSOAL (Microsoft/Google).
  //
  // Ferramenta com `identity_mode: 'user'` só existe para quem CONECTOU a
  // conta. Sem o corte aqui, ela seria oferecida ao modelo, escolhida pelo
  // roteamento e só falharia na execução — ensinando o agente a prometer o que
  // não entrega, e fazendo o usuário ler "não consegui agora" como defeito em
  // vez de "falta conectar".
  //
  // O corte NÃO cabe no `loadBaseContext`: ele é cacheado por base, e conexão é
  // por pessoa — filtrar lá vazaria a disponibilidade de um usuário para outro.
  let precisaConectar: string[] = [];
  let credencialPessoal: string | null = null;
  if (ctx.tools.some((t) => t.tool.identity_mode === "user")) {
    const conectadas = await credenciaisConectadas(ctx.baseId, String(identity.usuario ?? ""));
    // Guardada para as ferramentas de ARQUIVO (bytes), que não passam pelo
    // executor genérico e precisam resolver o token por conta própria.
    credencialPessoal = ctx.tools.find(
      (t) => t.tool.identity_mode === "user" && t.credentialId && conectadas.has(t.credentialId),
    )?.credentialId ?? null;
    const antes = ctx.tools.length;
    const semConexao = new Set<string>();
    ctx.tools = ctx.tools.filter((t) => {
      if (t.tool.identity_mode !== "user") return true;
      const ok = !!t.credentialId && conectadas.has(t.credentialId);
      if (!ok) semConexao.add(t.tool.name);
      return ok;
    });
    if (semConexao.size > 0) {
      precisaConectar = [...semConexao];
      onPasso?.("integracoes:conta_nao_conectada", {
        removidas: precisaConectar.length,
        de: antes,
      });
    }
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
    if (!analise.precisaDados && !sempreIncluir?.length) {
      onPasso?.("integracoes", { resultado: "sem tools", motivo: "classificador: pedido não precisa de dados (how-to/documentação)" });
      return { tools: {}, capabilities: "", agentPrompt: "" };
    }
    // "sem dados" MAS há tool(s) FORÇADA(s) (ex.: confirmação in-chat pendente) → não
    // corta tudo: segue sem narrowing (recorte=[]) para a forçada aparecer.
    recorte = analise.precisaDados ? analise.modulos : [];
  } else if (skipAnalise) {
    // Operação de tela: sem narrowing (recorte=[] → todas as curadas) e sem LLM. A
    // PERSONA/capacidades ainda são montadas abaixo; as tools são cortadas na rota.
    onPasso?.("integracoes:analise", { pulado: true, motivo: "operação de tela (persona sem análise-LLM)" });
  }
  // RECORTE ÓRFÃO: o vocabulário do classificador vem só das tags de tools ATIVAS, então
  // quando um módulo fica sem nenhuma tool ativa ele SOME do vocabulário e o classificador
  // escolhe o vizinho plausível — cujo recorte corta justamente a ferramenta certa. Se
  // NENHUMA tool do catálogo cobre o recorte escolhido, ele não tem o que estreitar:
  // ignorar é estritamente melhor que cortar por um assunto que não existe mais.
  let routingAtivo = recorte.length > 0;
  if (routingAtivo && !recorteTemCobertura(ctx.tools.map((t) => t.modules), recorte)) {
    onPasso?.("integracoes:recorte_orfao", {
      recorte: recorte.map((m) => m.modulo),
      acao: "ignorado (nenhuma ferramenta ativa neste assunto)",
    });
    routingAtivo = false;
  }
  /** Ferramentas que o recorte cortaria e o nome na pergunta trouxe de volta (trace). */
  const resgatadasDoRecorte: string[] = [];

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
  const primary = ctx.tools.find((t) => t.credentialId && t.baseUrl);
  if (primary && identity.cod_empresa && identity.matricula) {
    const cred = await loadCredentialSecret(primary.credentialId!);
    if (cred?.secret.session_key) {
      const res = await resolveIdentity({ baseUrl: primary.baseUrl!, credential: cred, identity });
      // PERSISTE as chamadas do resolvedor (token, autenticação, perfil) na aba
      // Execuções. O trace do turno morre quando a aba fecha; uma falha relatada
      // horas depois precisa estar em algum lugar. Não bloqueia o turno: gravar
      // log nunca pode ser motivo de a resposta demorar.
      for (const ch of res.chamadas ?? []) {
        void logChamadaInterna({
          baseCode,
          conversationId: runMeta?.conversationId ?? null,
          etapa: ch.etapa,
          chamada: ch,
          ok: ch.status >= 200 && ch.status < 300,
        });
      }
      if (!res.ok) {
        // Falha do login do colaborador — antes invisível no trace. Agora registra o
        // MOTIVO (login_recusado / sem_resposta / timeout / erro_rede) para diagnóstico.
        // A CHAMADA vai junto: cURL colável e o corpo da resposta resumido
        // (o ORA-/PLS- quando é erro de banco do lado do cliente). Sem isso, o
        // trace dizia só o motivo e reproduzir exigia decifrar a credencial do
        // banco à mão — foi o que custou a investigação da Stefanini.
        onPasso?.("identidade", {
          validado: false,
          motivo: res.motivo ?? "falha",
          operador,
          empresa: identity.cod_empresa,
          ...(res.chamada
            ? { http: res.chamada.status, ms: res.chamada.ms, resposta: res.chamada.resposta, curl: res.chamada.curl }
            : {}),
        });
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
        if (res.profile?.nome) {
          profileNote =
            `Usuário identificado: ${res.profile.nome}` +
            (res.profile.cargo ? ` — ${res.profile.cargo}` : "") +
            (res.profile.perfil ? ` (perfil ${res.profile.perfil})` : "") +
            (res.profile.gestorDeEquipe ? ", gestor de centro de custo" : "") +
            ". ";
        }
        onPasso?.("identidade", {
          validado: true,
          nome: res.profile?.nome ?? null,
          // Perfil do TOKEN — o login não o altera mais. `gestor_equipe` é o campo
          // `gestor` do cadastro (responde por um centro de custo), que é outra coisa.
          perfil: res.identity.perfil ?? null,
          gestor_equipe: res.profile?.gestorDeEquipe ?? false,
        });
      }
    }
  }

  const db = createAdminClient();
  const [{ data: agents }, { data: links }] = await Promise.all([
    db.from("ai_agents").select("id, key, name, description, system_prompt, priority, requires_perfil, is_default").eq("active", true),
    db.from("ai_agent_tools").select("agent_id, tool_id"),
  ]);
  // Trava por PERFIL: um agente que exige um perfil só entra quando o perfil do
  // TOKEN (p_perfil, mandado pelo portal) confere — nunca vem do modelo, e o login
  // não o altera. Ser gestor de um centro de custo NÃO muda o perfil da pessoa.
  // O OPERADOR (portal PO) é elegível a TODOS os agentes (acesso full).
  const elegiveis = operador
    ? (agents ?? [])
    : (agents ?? []).filter((a) => perfilAtende(a.requires_perfil, ident.perfil));
  const elegiveisIds = new Set(elegiveis.map((a) => a.id));
  const curated = new Set((links ?? []).filter((l) => elegiveisIds.has(l.agent_id)).map((l) => l.tool_id));
  // CLAIMED = tools curadas sob ALGUM agente ativo (elegível OU não p/ este usuário). É a
  // distinção que conserta as ÓRFÃS: uma tool CLAIMED mas por agente NÃO-elegível fica
  // EXCLUÍDA (respeita a trava de perfil do agente). Uma tool de LEITURA sem agente algum
  // (órfã da importação ORDS) é reclamada pelo(s) agente(s) PADRÃO (is_default): se houver
  // um default elegível, ela aparece — controlada por panel_scope + allowlists. (Órfã de
  // ESCRITA segue excluída — abaixo.) Sem isto, ~61 tools ativas sem vínculo (requisições,
  // candidatos, seleção…) nunca apareciam.
  const idsAgentesAtivos = new Set((agents ?? []).map((a) => a.id));
  const claimed = new Set((links ?? []).filter((l) => idsAgentesAtivos.has(l.agent_id)).map((l) => l.tool_id));
  // Há um agente PADRÃO elegível para este usuário? (reclama as órfãs de leitura)
  const temDefaultElegivel = elegiveis.some((a) => a.is_default);
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
    // Exclui quando NÃO curada e: (a) CLAIMED por agente não-elegível (trava de perfil); OU
    // (b) órfã de ESCRITA — write sem curadoria não tem confirmação (guard), então NÃO é
    // exposta solta (o modelo poderia gravar sem confirmação); OU (c) órfã de LEITURA mas
    // SEM agente PADRÃO elegível — sem um default, a órfã não tem "dono" e não aparece.
    const ehEscrita = String(bt.tool.method ?? "GET").toUpperCase() !== "GET";
    if (temAgentes && !curated.has(bt.toolId) && (claimed.has(bt.toolId) || ehEscrita || !temDefaultElegivel)) continue;
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
    // RECORTE por assunto — com RESGATE LEXICAL. O classificador escolhe UM recorte e
    // uma pergunta com dois assuntos perde o outro: "candidatos … da requisição de
    // pessoal 57695" virou só GESTÃO DE CANDIDATOS, e requisicoes_req_pessoal (tag
    // REQUISIÇÕES) sumiu do turno — enquanto o roteador de fonte, que olha o catálogo
    // inteiro, a apontava como a MELHOR (0.74). Quem é citada pelo nome na pergunta
    // (2+ termos, para o recorte não virar letra morta) sobrevive ao corte.
    if (
      routingAtivo &&
      !bt.alwaysInclude &&
      !sempreIncluir?.includes(bt.tool.key) &&
      bt.modules.length > 0 &&
      !toolNoRecorte(bt.modules, recorte)
    ) {
      if (forcaLexical(bt.tool.name, bt.tool.key, question ?? "", bt.tool.search_terms) < 2) continue;
      resgatadasDoRecorte.push(bt.tool.key);
    }
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

  if (resgatadasDoRecorte.length) {
    onPasso?.("integracoes:resgate_recorte", { tools: resgatadasDoRecorte, recorte: recorte.map((m) => (m.submodulo ? `${m.modulo}/${m.submodulo}` : m.modulo)) });
  }

  // ── 2) TOP-K por relevância LEXICAL (menos tokens + escolha mais precisa) ──────
  // O classificador já estreitou para um assunto; aqui, nos módulos gordos (ex.: 26
  // tools), ficamos só com as MAX_TOOLS_MODELO mais relevantes à pergunta. Essenciais/
  // forçadas sempre entram; sem sinal lexical → mantém TODAS (não arrisca a assertividade).
  // Custo ZERO — sem chamada de embedding (ver tool-narrow.ts).
  // MULTI-FACETA: pergunta com várias intenções precisa de mais vagas — cada intenção
  // traz as suas. Teto do composto (18) mesmo sem a chavinha de relax.
  const facetasSim = (simFacetas ?? []).filter((f) => f.sim?.size);
  const multiFaceta = facetasSim.length > 1;
  const maxTools = relaxComposto || multiFaceta ? MAX_TOOLS_COMPOSTO : MAX_TOOLS_MODELO;
  // DESEMPATE de ambiguidade: quando duas tools quase sinônimas disputam o topo, a
  // perdedora sai do turno (regra pareada ou prioridade no grupo) — senão as duas
  // chegam ao modelo e o erro de escolha vira dele. Vai para o trace.
  const cortesDesempate: CorteDesempate[] = [];
  // QUALIDADE da seleção: sem isto o modelo recebia ferramentas a 0.5x sem nenhum
  // sinal de que eram fracas — e respondia como se fossem as certas.
  const diag: { selecao: InfoSelecao | null } = { selecao: null };
  const manter = selecionarTopK(
    elegiveisTools.map((e) => ({
      key: e.bt.tool.key,
      name: e.bt.tool.name,
      description: e.bt.tool.description ?? "",
      searchTerms: e.bt.tool.search_terms ?? null,
      alwaysInclude: e.bt.alwaysInclude,
      prioridade: e.bt.prioridade,
      grupo: e.bt.grupoAmbiguidade,
    })),
    question ?? "",
    maxTools,
    sempreIncluir?.length ? new Set(sempreIncluir) : undefined,
    sim,
    relaxComposto,
    { regras: ctx.regrasDesempate, onCorte: (cs) => cortesDesempate.push(...cs), onSelecao: (i) => { diag.selecao = i; } },
    multiFaceta ? facetasSim.map((f) => f.sim) : null,
  );
  if (cortesDesempate.length) {
    onPasso?.("integracoes:desempate", {
      cortes: cortesDesempate.map((c) => `${c.perdedora} ⟵ ${c.vencedora} (${c.via}${c.modo ? `/${c.modo}` : ""})`),
    });
  }
  // DEPENDÊNCIAS: descrição que manda chamar outra ferramenta ANTES (ex.: linha_tempo
  // exige linha_tempo_fato) traz a citada junto. Sem isto o modelo recebia a ferramenta
  // sem a chave dela — e a própria descrição o proíbe de inventar o parâmetro.
  const liteDe = (e: (typeof elegiveisTools)[number]) => ({
    key: e.bt.tool.key,
    name: e.bt.tool.name,
    description: e.bt.tool.description ?? "",
    alwaysInclude: e.bt.alwaysInclude,
  });
  const deps = dependenciasCitadas(
    elegiveisTools.filter((e) => manter.has(e.bt.tool.key)).map(liteDe),
    elegiveisTools.map(liteDe),
  );
  if (deps.length) {
    for (const d of deps) manter.add(d.key);
    onPasso?.("integracoes:dependencias", { puxadas: deps.map((d) => `${d.key} (por ${d.porCausaDe})`) });
  }
  const selecionadas = elegiveisTools.filter((e) => manter.has(e.bt.tool.key));

  // ── DADOS DO PRÓPRIO USUÁRIO, buscados sem o modelo ────────────────────────
  // `meus_dados` não tem um único parâmetro de origem `modelo` — tudo vem da
  // identidade e da credencial. Então o servidor a resolve sozinho, e o modelo
  // começa o turno já sabendo a lotação de quem está falando. O que se ganha não
  // é o tempo da chamada (~50ms): é um PASSO do laço agêntico, que tem teto de 3
  // a 6 por turno. Passa pelo mesmo cache das demais (escopo por usuário), então
  // depois da primeira vez custa zero.
  let meusDados: MeusDados | undefined;
  const btMeus = elegiveisTools.find((e) => e.bt.tool.key === TOOL_MEUS_DADOS)?.bt;
  if (btMeus?.baseUrl && ident.matricula) {
    try {
      const credMeus = btMeus.credentialId ? await loadCredentialSecret(btMeus.credentialId) : null;
      const r = await getCachedExecMeta(
        `${baseCode}:${TOOL_MEUS_DADOS}:${cacheArgsKey({}, ident, "user")}`,
        TTL_MEUS_DADOS,
        () => executeTool({ tool: btMeus.tool, baseUrl: btMeus.baseUrl!, credential: credMeus, modelArgs: {}, identity: ident }),
      );
      if (r.result.ok) {
        const recorte = recortarMeusDados(r.result.data);
        if (recorte.length) meusDados = recorte;
        onPasso?.("integracoes:meus_dados", { campos: recorte.length, cache: r.cached });
      }
    } catch (e) {
      // Best-effort: sem os dados o turno segue igual a antes (o modelo chama a
      // ferramenta). Falhar aqui não pode derrubar a montagem do toolset.
      onPasso?.("integracoes:meus_dados", { erro: e instanceof Error ? e.message.slice(0, 120) : "falhou" });
    }
  }
  // Rastreio das facetas: o que CADA intenção da pergunta trouxe. Sem isto, uma
  // intenção sem ferramenta some sem deixar pista (foi assim que o caso apareceu).
  if (multiFaceta) {
    onPasso?.("integracoes:facetas", {
      total: facetasSim.length,
      teto: maxTools,
      facetas: facetasSim.map((f) => {
        const top = [...f.sim.entries()]
          .filter(([k]) => manter.has(k))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([k, s]) => `${k} ${s.toFixed(2)}`);
        return `${f.faceta.slice(0, 60)} → ${top.join(", ") || "(nada)"}`;
      }),
    });
  }
  if (selecionadas.length < elegiveisTools.length) {
    onPasso?.("integracoes:top_k", {
      de: elegiveisTools.length,
      para: selecionadas.length,
      modo: multiFaceta ? `multifaceta(${facetasSim.length})` : sim?.size ? "semantico" : "lexico",
      relax: !!relaxComposto,
      // Mostra a similaridade de cada tool mantida — visibilidade da precisão no trace.
      mantidas: selecionadas.map((e) => (sim?.size ? `${e.bt.tool.key} ${(sim.get(e.bt.tool.key) ?? 0).toFixed(2)}` : e.bt.tool.key)),
    });
  }

  // ── 3) BUILD: monta o toolset do AI SDK só das ferramentas selecionadas ────────
  const essenciais: string[] = [];
  for (const { bt, escopo, paramsEscopo, loopEscopo } of selecionadas) {
    if (bt.alwaysInclude) essenciais.push(bt.tool.key);
    if (bt.tool.system_prompt?.trim()) promptsFerramentas.push(bt.tool.system_prompt.trim());
    tools[bt.tool.key] = tool({
      description: [bt.tool.description, bt.tool.response_hint].filter(Boolean).join(" "),
      inputSchema: buildModelSchema(paramsEscopo, loopEscopo),
      // Envelopa o retorno: se for uma LISTA, registra o dataset completo e injeta
      // `_dataset` (o relatório usa isso p/ incluir todas as linhas — ver #4).
      execute: async (args, options) => {
        // Id da chamada (dado pelo SDK): carimba todos os passos desta execução para
        // que a tela consiga correlacioná-los mesmo com várias tools em paralelo.
        const idChamada = idDaChamada(options);
        const marca = idChamada ? { id: idChamada } : {};
        // Repetição IDÊNTICA no mesmo turno (loop do modelo) → devolve o já obtido, sem
        // rebater na API. Só leituras (GET); escrita nunca é deduplicada.
        const chaveDedup = String(bt.tool.method ?? "GET").toUpperCase() === "GET" ? `${bt.tool.key}:${chaveDeArgs(args)}` : null;
        if (chaveDedup && dedupTurno.has(chaveDedup)) {
          // Sem este passo, dedup e cache ficam indistinguíveis na tela — e o modelo
          // repetindo a mesma chamada em rajada é justamente a patologia que o log
          // existe para diagnosticar.
          onPasso?.("integracoes:dedup", { ...marca, tool: bt.tool.key });
          return dedupTurno.get(chaveDedup);
        }
        if (chamadasIntegracao >= MAX_CHAMADAS_INTEGRACAO)
          return { erro: `Já foram feitas ${MAX_CHAMADAS_INTEGRACAO} consultas nesta rodada (provável repetição em loop). Responda com o que já foi coletado; se faltar informação, peça ao usuário para refinar — menos itens por vez ou uma pergunta de cada vez.` };
        chamadasIntegracao++;
        // Requisições HTTP desta chamada do modelo (o loop faz várias). Viram UM passo
        // `integracoes:curl` consolidado quando a chamada termina.
        const chamadasHttp: ChamadaHttp[] = [];
        // Instrumentação: registra o que o MODELO recebeu de fato (amostra × total,
        // poda de emergência, id do dataset). Nenhum passo do trace media isso — sem
        // esse número não dá para saber qual perda de contexto é a real.
        const _promessa = (async () => {
          const _bruto = await (async () => {
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
              if (!gp.ok) {
                // Dentro de um LOOP, a recusa de uma iteração era engolida pela agregação
                // e a chamada inteira saía verde no log. O motivo real só existia num
                // console.warn do servidor — invisível para quem opera em produção.
                onPasso?.("integracoes:guard", {
                  ...marca, tool: bt.tool.key, guard: "escopo_painel", ok: false, erro: gp.erro,
                });
                return { erro: gp.erro };
              }
            }
            if (bt.tool.guard) {
              const g = await runGuard(bt.tool.guard, {
                baseUrl: bt.baseUrl!,
                baseCode,
                credential,
                identity: ident,
                modelArgs: callArgs,
                confirm: buildConfirmDeps(baseCode),
                toolKey: bt.tool.key,
                actionLabel: bt.tool.name,
              });
              if (!g.ok) {
                onPasso?.("integracoes:guard", {
                  ...marca, tool: bt.tool.key, guard: bt.tool.guard, ok: false, erro: g.erro,
                });
                return { erro: g.erro };
              }
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
            // redigidos) para o trace do admin/logs. ACUMULA em vez de emitir: uma tool com
            // loop faz até 24 requisições por chamada do modelo, e um passo por requisição
            // estourava o teto do trace — o passo sai consolidado no fim (consolidarChamadas).
            chamadasHttp.push({
              params: sanitizarBody(JSON.stringify(callArgs), paramsEscopo),
              status: result?.status ?? null,
              ms: durationMs,
              cache: cachedHit,
              curl: result?.request?.curl,
            });
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
            // Endpoint montado sobre tela APEX às vezes devolve o valor já renderizado
            // ('<span class="fa fa-check-circle"></span> Concluida'). O modelo precisa
            // de "Concluida" — a marcação gasta token e vira palavra no contexto. Depois
            // da extração de arquivos, para não tocar em documento HTML de verdade.
            // Credencial que a API devolve sem ninguém pedir (certificado + senha em
            // /documents/v1/emps) sai ANTES do log e antes do modelo.
            const seguro = redigirCredenciais(limparMarcacaoHtml(cleaned));
            await registrar(seguro, true, result.status, files.length, null);
            return seguro;
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
            const periodo = `${lista[0]!.br} a ${lista[lista.length - 1]!.br}`;
            const avisoMes = excedeu ? { aviso: `Período longo: limitei aos primeiros ${lista.length} meses. Peça o restante em outra consulta.` } : {};
            // Achata numa lista só, com a competência como coluna: assim o resultado vira
            // um dataset consultável de verdade, em vez de `dados` virar JSON truncado.
            const planoMes = achatarLoop(meses.map((m) => ({ rotulo: String(m.competencia), dados: m.dados })), "Competência");
            if (planoMes.achatou) {
              return {
                periodo,
                itens: planoMes.itens,
                ...(planoMes.falhas.length ? { _falhas: planoMes.falhas } : {}),
                ...avisoMes,
              };
            }
            return { periodo, meses, ...avisoMes };
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
            const brutos: Array<Record<string, unknown>> = [];
            for (const [i, v] of usados.entries()) brutos.push({ valor: v, dados: await runOnce({ ...modelArgs, [loop.param]: v }, i) });
            const avisoVal = valores.length > max ? { aviso: `Muitos valores: consultei os primeiros ${max}.` } : {};
            const plano = achatarLoop(brutos.map((b) => ({ rotulo: String(b.valor), dados: b.dados })), rotuloDoLoop(loop.param));
            if (plano.achatou) return { itens: plano.itens, ...(plano.falhas.length ? { _falhas: plano.falhas } : {}), ...avisoVal };
            return { itens: brutos, ...avisoVal };
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
            const brutosB: Array<Record<string, unknown>> = [];
            for (const [i, lote] of usados.entries()) brutosB.push({ valor: lote, dados: await runOnce({ ...modelArgs, [loop.param]: lote }, i) });
            const avisoLote = lotes.length > MAX_LOTES ? { aviso: `Muitos itens: enviei os primeiros ${MAX_LOTES * size}. Peça o restante em outra consulta.` } : {};
            // No batch o rótulo é o lote inteiro (lista por vírgula) — não vira coluna útil;
            // achata sem rótulo para o dataset ficar com as colunas REAIS da API.
            const planoB = achatarLoop(brutosB.map((b) => ({ rotulo: "", dados: b.dados })), "");
            if (planoB.achatou) {
              return { itens: planoB.itens.map((l) => { const { "": _x, ...resto } = l as Record<string, unknown>; void _x; return resto; }), ...(planoB.falhas.length ? { _falhas: planoB.falhas } : {}), ...avisoLote };
            }
            return { itens: brutosB, ...avisoLote };
          }
          return await runOnce(modelArgs, 0);
        } catch (e) {
          return { erro: e instanceof Error ? e.message : String(e) };
        }
        })();
          // Um passo por CHAMADA DO MODELO, não por requisição: o loop mês a mês vira
          // `{ requisicoes: 12, valores: [...] }` em vez de 12 linhas iguais no log.
          const infoCurl = consolidarChamadas(bt.tool.key, chamadasHttp);
          if (infoCurl) onPasso?.("integracoes:curl", { ...marca, ...infoCurl });
          const { saida, relato } = injetarDatasetComRelato(datasets, _bruto);
          if (relato) onPasso?.("tool_result", { ...marca, tool: bt.tool.key, ...relato });
          return saida;
        })();
        // Guarda a PROMESSA (não o resultado) já aqui, ANTES do await: chamadas IDÊNTICAS
        // em PARALELO no mesmo passo (Gemini 3 re-emitindo function calls em rajada)
        // compartilham este resultado em vez de baterem N× na API. O set é síncrono logo
        // após criar a promessa, então a 2ª chamada do mesmo passo já a encontra.
        if (chaveDedup) dedupTurno.set(chaveDedup, _promessa);
        return await _promessa;
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

  // ── ARQUIVOS (bytes) ────────────────────────────────────────────────────
  // Salvar no OneDrive e trazer arquivo da nuvem para o anexo do chat. Não
  // passam pelo executor genérico: um manda corpo CRU e o outro RECEBE bytes,
  // e o executor só fala JSON nos dois sentidos. Só entram com conta conectada.
  if (credencialPessoal) {
    try {
      const { tokenDoUsuario } = await import("./user-token");
      const r = await tokenDoUsuario({
        credentialId: credencialPessoal,
        pUsuario: String(identity.usuario ?? ""),
      });
      if (r.ok) {
        const { graphFileTools } = await import("./graph-file-tools");
        const extras = graphFileTools({
          gerados: sink ?? [], token: r.token, anexar: anexarArquivo,
          identity, baseCode,
        });
        for (const [k, v] of Object.entries(extras)) tools[k] = v;
        if (Object.keys(extras).length) onPasso?.("integracoes:arquivos_ms", { tools: Object.keys(extras) });
      }
    } catch (e) {
      // Nunca derruba o turno: sem estas duas o chat continua inteiro.
      onPasso?.("integracoes:arquivos_ms", { erro: e instanceof Error ? e.message : String(e) });
    }
  }

  onPasso?.("integracoes", { resultado: "tools montadas", tools: Object.keys(tools), recorte: recorte.map((m) => m.modulo) });
  const _sel = diag.selecao;
  if (_sel?.fraco) onPasso?.("integracoes:selecao_fraca", { top_sim: Number(_sel.topSim.toFixed(3)), piso: Number(_sel.piso.toFixed(3)), tools: _sel.keys });
  return {
    tools,
    capabilities,
    agentPrompt,
    agentName: agentePersona?.name ?? null,
    essenciais,
    selecaoFraca: _sel?.fraco ? { topSim: _sel.topSim, keys: _sel.keys } : null,
    // Assuntos que o classificador reconheceu. Dois módulos = pedido com duas
    // partes — o sinal que impede o gate de "qual delas?" de obrigar o usuário a
    // escolher entre metades do próprio pedido.
    modulos: recorte.map((m) => (m.submodulo ? `${m.modulo}/${m.submodulo}` : m.modulo)),
    meusDados,
  };
}
