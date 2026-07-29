import "server-only";
import { tool, type ToolSet } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBaseContext, loadCredentialSecret } from "./resolve";
import { buildModelSchema, identityFromTrack, type Identity } from "./params";
import { executeTool, type ExecResult } from "./executor";
import { extractDocumentsFromResult, type OutFile } from "./documents";
import { resolveIdentity } from "./identity-resolver";
import { perfilAtende } from "./gating";
import { runGuard } from "./guards";
import { buildConfirmDeps } from "./confirmations";
import { getCachedExecMeta, cacheArgsKey, filtrarPorTermo, dedupItems } from "./tool-cache";
import { expandirMeses } from "./loop";
import { logToolRun } from "./run-log";
import { ANTHROPIC_CACHE } from "@/lib/ai/anthropic-cache";

export { identityFromTrack };

export type IntegrationBundle = {
  tools: ToolSet;
  /** Nota de uso das ferramentas + especialidades (seção "Uso das Ferramentas"). */
  capabilities: string;
  /** Prompt do agente ativo (ex.: Nati) — vira a seção "Especialização". */
  agentPrompt: string;
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
): Promise<IntegrationBundle> {
  const ctx = await loadBaseContext(baseCode);
  if (!ctx || ctx.tools.length === 0) return { tools: {}, capabilities: "", agentPrompt: "" };

  // "Login" no servidor: se a credencial da base tem session_key, valida o
  // usuário e enriquece a identidade (CPF, perfil) antes de montar as tools.
  // Falha na validação = sem tools de dados (mas o RAG segue).
  let ident = identity;
  let profileNote = "";
  let profileEmail: string | null = null;
  const primary = ctx.tools.find((t) => t.credentialId && t.baseUrl);
  if (primary && identity.cod_empresa && identity.matricula) {
    const cred = await loadCredentialSecret(primary.credentialId!);
    if (cred?.secret.session_key) {
      const res = await resolveIdentity({ baseUrl: primary.baseUrl!, credential: cred, identity });
      if (!res.ok) {
        return {
          tools: {},
          capabilities:
            "Não foi possível validar este usuário no sistema agora. Responda apenas com a " +
            "documentação e oriente-o a procurar o RH para dados pessoais.",
          agentPrompt: "",
        };
      }
      ident = res.identity;
      profileEmail = res.profile?.email ?? null;
      if (res.profile?.nome) {
        profileNote =
          `Usuário identificado: ${res.profile.nome}` +
          (res.profile.cargo ? ` — ${res.profile.cargo}` : "") +
          (res.profile.perfil ? ` (${res.profile.perfil})` : "") +
          ". ";
      }
    }
  }

  const db = createAdminClient();
  const [{ data: agents }, { data: links }] = await Promise.all([
    db.from("ai_agents").select("id, key, name, description, system_prompt, priority, requires_perfil").eq("active", true),
    db.from("ai_agent_tools").select("agent_id, tool_id"),
  ]);
  // Trava por PERFIL: um agente que exige um perfil (ex.: "gestor") só entra
  // quando o perfil resolvido no login confere — nunca vem do modelo.
  const elegiveis = (agents ?? []).filter((a) => perfilAtende(a.requires_perfil, ident.perfil));
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
  for (const bt of ctx.tools) {
    if (temAgentes && !curated.has(bt.toolId)) continue; // fora de todo agente ativo
    if (bt.tool.system_prompt?.trim()) promptsFerramentas.push(bt.tool.system_prompt.trim());
    tools[bt.tool.key] = tool({
      description: [bt.tool.description, bt.tool.response_hint].filter(Boolean).join(" "),
      inputSchema: buildModelSchema(bt.tool.params, bt.tool.loop),
      execute: async (args) => {
        try {
          if (!bt.baseUrl) return { erro: "Endpoint não configurado para esta base." };
          const credential = bt.credentialId ? await loadCredentialSecret(bt.credentialId) : null;
          const modelArgs = (args ?? {}) as Record<string, unknown>;
          // Guard no servidor (ex.: gestor só consulta a própria equipe). Recusa
          // ANTES de chamar a API — a matrícula-alvo nunca é confiada cega. Roda
          // UMA vez (independe do mês, no caso de período).
          if (bt.tool.guard) {
            const g = await runGuard(bt.tool.guard, {
              baseUrl: bt.baseUrl,
              baseCode,
              credential,
              identity: ident,
              modelArgs,
              confirm: buildConfirmDeps(baseCode, profileEmail),
            });
            if (!g.ok) return { erro: g.erro };
          }
          // UMA chamada à API, com o pipeline de cache/dedup/termo/arquivos.
          // Cada chamada é REGISTRADA (entrada → requisição → saída, tempo, erro)
          // em ai_tool_runs — o log passo a passo (segredos redigidos no run-log).
          const runOnce = async (callArgs: Record<string, unknown>, stepIndex: number) => {
            const t0 = Date.now();
            const doExec = () =>
              executeTool({ tool: bt.tool, baseUrl: bt.baseUrl!, credential, modelArgs: callArgs, identity: ident });
            // Cache em memória p/ dados quase-estáticos (estrutura, equipe, cadastro):
            // evita rebater na API a cada mensagem. Só guarda resultados OK.
            let result: ExecResult | null = null;
            let threw: string | null = null;
            let cachedHit = false;
            try {
              if (bt.tool.cache_ttl) {
                const m = await getCachedExecMeta(`${baseCode}:${bt.tool.key}:${cacheArgsKey(callArgs, ident)}`, bt.tool.cache_ttl, doExec);
                result = m.result;
                cachedHit = m.cached;
              } else {
                result = await doExec();
              }
            } catch (e) {
              threw = e instanceof Error ? e.message : String(e);
            }
            const durationMs = Date.now() - t0;
            const registrar = (saida: unknown, ok: boolean, status: number | null, files: number, error: string | null) =>
              logToolRun({
                baseCode,
                conversationId: runMeta?.conversationId ?? null,
                toolKey: bt.tool.key,
                agentKey: agentKeyByTool.get(bt.toolId) ?? null,
                stepIndex,
                input: callArgs,
                request: result?.request ?? null,
                params: bt.tool.params,
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
            // Arquivos em base64 são extraídos (para o canal entregar) e o base64
            // é removido do que volta ao modelo.
            const { cleaned, files } = extractDocumentsFromResult(dados);
            if (sink && files.length) sink.push(...files);
            await registrar(cleaned, true, result.status, files.length, null);
            return cleaned;
          };
          // Período (loop mês a mês): o usuário pediu um intervalo → o servidor
          // itera e AGREGA num só resultado. O modelo faz UMA chamada em vez de N
          // (menos steps, menos tokens).
          const loop = bt.tool.loop;
          if (loop) {
            const inicio = typeof modelArgs[loop.from] === "string" ? (modelArgs[loop.from] as string) : "";
            const fim = typeof modelArgs[loop.to] === "string" ? (modelArgs[loop.to] as string) : null;
            const { lista, excedeu } = expandirMeses(inicio, fim, loop.max ?? 24);
            if (lista.length === 0) {
              return { erro: `Preciso do mês de referência (ou período) em ${loop.from}, no formato ISO AAAA-MM.` };
            }
            const semPeriodo = (a: Record<string, unknown>, iso: string) => {
              const c = { ...a, [loop.param]: iso };
              delete c[loop.from];
              delete c[loop.to];
              return c;
            };
            // Um único mês: resultado direto (sem embrulho), mais enxuto.
            if (lista.length === 1) return await runOnce(semPeriodo(modelArgs, lista[0]!.iso), 0);
            const meses: Array<Record<string, unknown>> = [];
            for (const [i, mes] of lista.entries())
              meses.push({ competencia: mes.br, dados: await runOnce(semPeriodo(modelArgs, mes.iso), i) });
            return {
              periodo: `${lista[0]!.br} a ${lista[lista.length - 1]!.br}`,
              meses,
              ...(excedeu
                ? { aviso: `Período longo: limitei aos primeiros ${lista.length} meses. Peça o restante em outra consulta.` }
                : {}),
            };
          }
          return await runOnce(modelArgs, 0);
        } catch (e) {
          return { erro: e instanceof Error ? e.message : String(e) };
        }
      },
    });
  }

  if (Object.keys(tools).length === 0) return { tools: {}, capabilities: "", agentPrompt: "" };

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
    "Você tem FERRAMENTAS para consultar dados reais do sistema do usuário. Use-as quando ele pedir " +
    "dados/registros específicos — nunca invente valores. Para dúvidas de uso ou como-fazer, use a documentação." +
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

  return { tools, capabilities, agentPrompt };
}
