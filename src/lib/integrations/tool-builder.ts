import "server-only";
import { tool, type ToolSet } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBaseContext, loadCredentialSecret } from "./resolve";
import { buildModelSchema, identityFromTrack, type Identity } from "./params";
import { executeTool } from "./executor";
import { extractDocumentsFromResult, type OutFile } from "./documents";
import { resolveIdentity } from "./identity-resolver";
import { perfilAtende } from "./gating";
import { runGuard } from "./guards";
import { buildConfirmDeps } from "./confirmations";

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
    db.from("ai_agents").select("id, name, description, system_prompt, priority, requires_perfil").eq("active", true),
    db.from("ai_agent_tools").select("agent_id, tool_id"),
  ]);
  // Trava por PERFIL: um agente que exige um perfil (ex.: "gestor") só entra
  // quando o perfil resolvido no login confere — nunca vem do modelo.
  const elegiveis = (agents ?? []).filter((a) => perfilAtende(a.requires_perfil, ident.perfil));
  const elegiveisIds = new Set(elegiveis.map((a) => a.id));
  const curated = new Set((links ?? []).filter((l) => elegiveisIds.has(l.agent_id)).map((l) => l.tool_id));
  // O fallback "expõe todas as habilitadas" só vale quando NÃO há NENHUM agente
  // ativo (setup inicial). Com agentes ativos, quem não tem agente elegível
  // fica sem tools — não com todas (senão a trava de perfil vazaria).
  const temAgentes = (agents ?? []).length > 0;

  const tools: ToolSet = {};
  for (const bt of ctx.tools) {
    if (temAgentes && !curated.has(bt.toolId)) continue; // fora de todo agente ativo
    tools[bt.tool.key] = tool({
      description: [bt.tool.description, bt.tool.response_hint].filter(Boolean).join(" "),
      inputSchema: buildModelSchema(bt.tool.params),
      execute: async (args) => {
        try {
          if (!bt.baseUrl) return { erro: "Endpoint não configurado para esta base." };
          const credential = bt.credentialId ? await loadCredentialSecret(bt.credentialId) : null;
          const modelArgs = (args ?? {}) as Record<string, unknown>;
          // Guard no servidor (ex.: gestor só consulta a própria equipe). Recusa
          // ANTES de chamar a API — a matrícula-alvo nunca é confiada cega.
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
          const r = await executeTool({
            tool: bt.tool,
            baseUrl: bt.baseUrl,
            credential,
            modelArgs,
            identity: ident,
          });
          if (!r.ok) return { erro: `A API retornou HTTP ${r.status}.`, dados: r.data };
          // Arquivos em base64 são extraídos (para o canal entregar) e o base64
          // é removido do que volta ao modelo.
          const { cleaned, files } = extractDocumentsFromResult(r.data);
          if (sink && files.length) sink.push(...files);
          return cleaned;
        } catch (e) {
          return { erro: e instanceof Error ? e.message : String(e) };
        }
      },
    });
  }

  if (Object.keys(tools).length === 0) return { tools: {}, capabilities: "", agentPrompt: "" };

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
    (especialidades ? `\nEspecialidades disponíveis:\n${especialidades}` : "");

  // Persona especializada: o agente ELEGÍVEL de maior prioridade COM prompt e
  // ≥1 tool habilitada. Vira a seção "Especialização". Agentes só de tools
  // (prompt vazio, ex.: o agente de gestor) não sobrescrevem a persona.
  const agentePersona = elegiveis
    .filter((a) => a.system_prompt?.trim() && (links ?? []).some((l) => l.agent_id === a.id && curated.has(l.tool_id)))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  const agentPrompt = agentePersona?.system_prompt?.trim() || "";

  return { tools, capabilities, agentPrompt };
}
