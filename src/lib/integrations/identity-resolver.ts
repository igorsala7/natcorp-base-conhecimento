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
import { montarTrace, type ChamadaTrace } from "./http-trace";

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
  /**
   * A chamada HTTP como cURL + o que voltou, com segredos redigidos.
   *
   * Sem isto, uma falha aqui só dizia "sem_resposta_login" e reproduzir exigia
   * decifrar a credencial do banco à mão. A causa real da Stefanini
   * (`ORA-00942`, tabela ausente) vinha no corpo da resposta — que era jogado
   * fora antes de qualquer um poder ler.
   */
  chamada?: ChamadaTrace;
  /**
   * TODAS as chamadas do resolvedor, na ordem: token, autenticação e perfil.
   *
   * Uma falha aqui pode estar em qualquer uma das três, e as correções são
   * diferentes — segredo errado, handler quebrado, colaborador inexistente.
   * Guardar só a que falhou esconderia que as anteriores passaram, que é
   * metade do diagnóstico.
   */
  chamadas?: (ChamadaTrace & { etapa: string })[];
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

/**
 * POST que PRESERVA O STATUS.
 *
 * A versão anterior devolvia `null` para qualquer resposta não-ok, e o motivo
 * gravado no trace era sempre "sem_resposta_login" — o mesmo rótulo para 404
 * (endpoint inexistente), 401 (chave recusada) e 555 (erro do ORDS). Custou uma
 * investigação inteira descobrir que era 555 por PL/SQL que não compila: o
 * handler referencia uma tabela ausente no schema do cliente.
 *
 * Guardar o status transforma esse diagnóstico numa linha do log.
 */
async function postJson(
  url: string,
  token: string,
  body: unknown,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
  segredos: (string | undefined)[] = [],
): Promise<{ status: number; data: unknown; chamada: ChamadaTrace }> {
  const corpo = JSON.stringify(body);
  const inicio = Date.now();
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: corpo,
    signal,
  });

  // LÊ O CORPO SEMPRE — inclusive no erro. Era exatamente o que faltava: a
  // causa da falha da Stefanini estava no corpo de um HTTP 555 que a versão
  // anterior descartava sem olhar.
  const texto = await res.text().catch(() => "");
  const chamada = montarTrace(
    { method: "POST", url, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: corpo },
    { status: res.status, corpo: texto },
    Date.now() - inicio,
    [...segredos, token],
  );

  let data: unknown = null;
  if (res.ok) {
    try {
      data = JSON.parse(texto) as unknown;
    } catch {
      // 200 com corpo que não é JSON: `data` fica nulo e o motivo vira "vazio",
      // mas a `chamada` mostra o que veio de verdade.
    }
  }
  return { status: res.status, data, chamada };
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

  const chamadas: (ChamadaTrace & { etapa: string })[] = [];
  try {
    const token = await getOAuthToken(input.credential.id, input.credential.secret, fetchImpl, (t) =>
      chamadas.push(t),
    );

    // 1) Validação — só segue com status OK.
    const resp = await postJson(
      base + AUTH_PATH,
      token,
      [{ key: sessionKey, usuario: identity.usuario ?? "", cod_empresa: empresa, matricula }],
      fetchImpl,
      controller.signal,
      [sessionKey],
    );
    chamadas.push({ etapa: "login/autenticacao", ...resp.chamada });
    const auth = firstItem(resp.data);
    if (!auth) {
      // O STATUS distingue causas com correções completamente diferentes:
      // 404 = endpoint não existe nesta base; 401/403 = chave recusada;
      // 5xx = o handler do lado do cliente quebrou; 200 sem item = usuário não
      // encontrado, que é o único caso "normal" dos quatro.
      const detalhe = resp.status === 200 ? "vazio" : `http_${resp.status}`;
      return store({ ok: false, identity, motivo: `sem_resposta_login:${detalhe}`, chamada: resp.chamada, chamadas });
    }
    if (String(auth.status).toUpperCase() !== "OK") {
      return store({
        ok: false,
        identity,
        motivo: `login_recusado${auth.status ? `:${String(auth.status).slice(0, 40)}` : ""}`,
        chamada: resp.chamada,
        chamadas,
      });
    }

    // 2) Enriquecimento — CPF, perfil, nome, cargo.
    const q = new URLSearchParams({ key: sessionKey, empresa, matricula });
    if (identity.usuario) q.set("usuario", identity.usuario);
    const urlPerfil = `${base}${PROFILE_PATH}?${q.toString()}`;
    const inicioPerfil = Date.now();
    const res = await fetchImpl(urlPerfil, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const textoPerfil = await res.text().catch(() => "");
    chamadas.push({
      etapa: "login/dados_colab_usuario",
      ...montarTrace(
        { method: "GET", url: urlPerfil, headers: { Authorization: `Bearer ${token}` } },
        // No SUCESSO o corpo não vai para o log: são dados pessoais do
        // colaborador (CPF, cargo, e-mail) e o log é lido por quem administra,
        // não por quem tem direito a vê-los. No erro vai, porque aí o conteúdo
        // é a mensagem da falha.
        { status: res.status, corpo: res.ok ? "" : textoPerfil },
        Date.now() - inicioPerfil,
        [sessionKey, token],
      ),
    });

    let prof: Record<string, unknown> | null = null;
    if (res.ok) {
      try {
        prof = firstItem(JSON.parse(textoPerfil) as unknown);
      } catch {
        prof = null;
      }
    }
    // Validado, mas sem cadastro extra: as `chamadas` vão junto para o trace
    // mostrar que as três etapas correram, e onde o dado parou de vir.
    if (!prof) return store({ ok: true, identity, chamadas });

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
    return store({ ok: true, identity: enriched, profile, chamadas });
  } catch {
    // Falha de rede/parse: falha fechada (sem tools de dados), mas não quebra o chat.
    // As chamadas já coletadas vão junto: num timeout, saber que o token foi
    // obtido em 200 ms e que a autenticação é que travou aponta o culpado.
    return store({
      ok: false,
      identity,
      motivo: controller.signal.aborted ? "timeout" : "erro_rede",
      chamadas,
    });
  } finally {
    clearTimeout(timer);
  }
}
