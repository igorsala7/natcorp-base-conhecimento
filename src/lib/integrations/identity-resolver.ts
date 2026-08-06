/**
 * Resolução de identidade no SERVIDOR ("login" do ORDS/APEX) — o paralelo do
 * fluxo de login do n8n, feito uma vez por usuário (cacheado) antes das tools.
 *
 * Quando a credencial da base tem `session_key`, o sistema:
 *   1. VALIDA o usuário em `login/v1/autenticacao` (só segue se `status = OK`);
 *   2. ENRIQUECE a identidade com os dados de `login/v1/dados_colab_usuario`
 *      (CPF, cod_candidato, nome, cargo, e se é gestor de equipe).
 *
 * O PERFIL do usuário NÃO é derivado daqui. O campo `gestor` do cadastro diz que
 * a pessoa responde por um centro de custo — é um fato do cadastro, não o perfil
 * de acesso dela. O perfil é o que o portal manda no token (`p_perfil`: MASTER,
 * OPERADOR…) e é ele que vale, sempre. Antes o login sobrescrevia MASTER por
 * "gestor" e o usuário mudava de perfil no meio do turno.
 * Assim o CPF entra como IDENTIDADE (injetado no servidor, nunca pelo modelo) e
 * o `docs_user` (assinatura) funciona sem passar o CPF pela IA.
 *
 * Puro/injeta `fetch` para ser testável. Nunca lança: em erro/negativa devolve
 * `ok:false` (falha fechada — sem tools de dados, mas o RAG segue).
 */
import type { Identity } from "./params";
import type { RuntimeCredential } from "./executor";
import { getOAuthToken } from "./oauth";

export type ResolvedProfile = {
  nome?: string;
  cargo?: string;
  /** Perfil do TOKEN (p_perfil) — repetido aqui só para exibição/diagnóstico. */
  perfil?: string;
  /** Responde por um centro de custo (campo `gestor` do cadastro). NÃO é o perfil. */
  gestorDeEquipe?: boolean;
  email?: string;
};
export type ResolveResult = {
  ok: boolean;
  identity: Identity;
  profile?: ResolvedProfile;
  /** Por que a validação falhou (diagnóstico p/ o trace). Ausente quando ok. */
  motivo?: string;
};

const AUTH_PATH = "/chatbot/login/v1/autenticacao";
const PROFILE_PATH = "/chatbot/login/v1/dados_colab_usuario";

type Cached = { exp: number; result: ResolveResult };
const cache = new Map<string, Cached>();
const OK_TTL = 5 * 60_000; // 5 min para positivo
const ERR_TTL = 30_000; // 30 s para negativo (permite retry logo)

function firstItem(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return (data[0] as Record<string, unknown>) ?? null;
  if (data && typeof data === "object") {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) return (items[0] as Record<string, unknown>) ?? null;
    return data as Record<string, unknown>;
  }
  return null;
}

async function postJson(url: string, token: string, body: unknown, fetchImpl: typeof fetch, signal: AbortSignal) {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  return res.ok ? ((await res.json().catch(() => null)) as unknown) : null;
}

/**
 * Valida e enriquece a identidade de um colaborador. Sem `session_key`, ou sem
 * empresa+matrícula, é um no-op (`ok:true`, identidade intacta) — a base não usa
 * este login e as tools seguem com a identidade do token.
 */
export async function resolveIdentity(input: {
  baseUrl: string;
  credential: RuntimeCredential;
  identity: Identity;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ResolveResult> {
  const { identity } = input;
  const sessionKey = input.credential.secret.session_key;
  const empresa = identity.cod_empresa;
  const matricula = identity.matricula;
  // Base não usa o login ORDS, ou não há identidade para validar → passa reto.
  if (!sessionKey || !empresa || !matricula) return { ok: true, identity };

  const cacheKey = `${input.credential.id}:${empresa}:${matricula}:${identity.usuario ?? ""}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.exp > Date.now()) return hit.result;

  const fetchImpl = input.fetchImpl ?? fetch;
  const base = input.baseUrl.replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 15_000);

  const store = (result: ResolveResult) => {
    cache.set(cacheKey, { exp: Date.now() + (result.ok ? OK_TTL : ERR_TTL), result });
    return result;
  };

  try {
    const token = await getOAuthToken(input.credential.id, input.credential.secret, fetchImpl);

    // 1) Validação — só segue com status OK.
    const auth = firstItem(
      await postJson(
        base + AUTH_PATH,
        token,
        [{ key: sessionKey, usuario: identity.usuario ?? "", cod_empresa: empresa, matricula }],
        fetchImpl,
        controller.signal,
      ),
    );
    if (!auth) return store({ ok: false, identity, motivo: "sem_resposta_login" });
    if (String(auth.status).toUpperCase() !== "OK") {
      return store({ ok: false, identity, motivo: `login_recusado${auth.status ? `:${String(auth.status).slice(0, 40)}` : ""}` });
    }

    // 2) Enriquecimento — CPF, perfil, nome, cargo.
    const q = new URLSearchParams({ key: sessionKey, empresa, matricula });
    if (identity.usuario) q.set("usuario", identity.usuario);
    const res = await fetchImpl(`${base}${PROFILE_PATH}?${q.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const prof = res.ok ? firstItem(await res.json().catch(() => null)) : null;
    if (!prof) return store({ ok: true, identity }); // validado, mas sem cadastro extra

    const cpf = typeof prof.cpf === "string" ? prof.cpf : undefined;
    // `cod_candidato` do login → identidade da sessão: fixa o "só o próprio dado"
    // nas tools com o param P_COD_CANDIDATO (origem=identidade). Pode vir número.
    const codCandidato =
      prof.cod_candidato != null && String(prof.cod_candidato).trim() !== "" ? String(prof.cod_candidato).trim() : undefined;
    // `gestor` = responde por um centro de custo. NÃO vira perfil: o perfil é o do
    // token e permanece intocado (MASTER continua MASTER depois do login).
    const gestorDeEquipe = String(prof.gestor ?? "").toUpperCase() === "SIM";
    const enriched: Identity = { ...identity, ...(cpf ? { cpf } : {}), ...(codCandidato ? { cod_candidato: codCandidato } : {}) };
    const email =
      (typeof prof.email_pessoal === "string" && prof.email_pessoal) ||
      (typeof prof.email_funcional === "string" && prof.email_funcional) ||
      undefined;
    const profile: ResolvedProfile = {
      nome: typeof prof.nome === "string" ? prof.nome : undefined,
      cargo: typeof prof.nome_cargo === "string" ? prof.nome_cargo : undefined,
      perfil: identity.perfil,
      gestorDeEquipe,
      email: email || undefined,
    };
    return store({ ok: true, identity: enriched, profile });
  } catch {
    // Falha de rede/parse: falha fechada (sem tools de dados), mas não quebra o chat.
    return store({ ok: false, identity, motivo: controller.signal.aborted ? "timeout" : "erro_rede" });
  } finally {
    clearTimeout(timer);
  }
}
