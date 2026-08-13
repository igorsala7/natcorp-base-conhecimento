import type { AuthType } from "./credentials";
import type { LoopConfig, ToolParam } from "./tools";
import type { PanelScopeMap } from "./panel-scope";
import { resolveParams, type Identity, type ResolvedBuckets } from "./params";
import { getOAuthToken, invalidateOAuthToken } from "./oauth";
import { montarCorpo } from "./body-template";
import { ehPaginaOrds, juntarPaginas, proximaPagina, temMais, type PaginaOrds } from "./paginacao";
import { sanitizarUrl, sanitizarBody, nomeSensivel } from "./run-log-sanitize";
import { chavePessoal } from "./user-key";

/** A tool como o motor precisa dela (subconjunto de ai_tools). */
export type RuntimeTool = {
  key: string;
  name: string;
  description?: string;
  method: string;
  path_template: string;
  auth_type: AuthType;
  params: ToolParam[];
  response_hint?: string | null;
  /** Sinônimos e exemplos de frase do usuário (`ai_tools.search_terms`). Alimentam o
   *  embedding E o resgate LEXICAL — sem eles, uma tool cujo NOME não compartilha
   *  palavra com a pergunta depende 100% do vetor para sobreviver ao recorte. */
  search_terms?: string | null;
  /** Envelope do corpo: null/'object'={...}; 'array'=[{...}]; 'wrap:<chave>'={<chave>:[{...}]}. */
  body_mode?: string | null;
  /** Nome de um guard no servidor rodado ANTES da chamada (ver guards.ts). */
  guard?: string | null;
  /** Segundos de cache em memória do resultado (dados quase-estáticos). NULL = sem cache. */
  cache_ttl?: number | null;
  /** Escopo da chave do cache: 'user' (padrão) | 'empresa' | 'global' (ver tool-cache). */
  cache_scope?: string | null;
  /** Expansão de período (mês a mês): o servidor itera e agrega. NULL = sem loop. */
  loop?: LoopConfig | null;
  /** Instrução própria da tool, concatenada ao prompt quando a tool está ativa. */
  system_prompt?: string | null;
  /** Escopo de dados por painel (PO/PG/PC). NULL/ausente = "todos" (sem recorte extra). */
  panel_scope?: PanelScopeMap | null;
  /** Nunca traz/mira os PRÓPRIOS dados do usuário (ex.: requisição de desligamento). */
  exclude_self?: boolean | null;
  /** Formato do corpo para APIs aninhadas (ver body-template.ts). NULL = plano. */
  body_template?: unknown;
  /** 'user' = exige o token PESSOAL de quem perguntou (Graph /me/*, Gmail). Sem
   *  conexão, a tool recusa em vez de responder com a conta de serviço. */
  identity_mode?: string | null;
  /** Declara que os ITENS devolvidos aceitam uma ação (ver acao-lista.ts). */
  acao_em_lista?: unknown;
};

/** Aplica o envelope de corpo exigido pela API (ver `RuntimeTool.body_mode`). */
export function envelopeBody(mode: string | null | undefined, obj: Record<string, unknown>): unknown {
  const m = (mode ?? "").trim();
  if (!m || m === "object") return obj;
  if (m === "array") return [obj];
  if (m.startsWith("wrap:")) return { [m.slice(5)]: [obj] };
  return obj;
}

/** Credencial já DECIFRADA (o motor recebe o blob em claro; nunca a tela). */
export type RuntimeCredential = {
  id: string;
  auth_type: AuthType;
  secret: Record<string, string>;
};

export type ExecInput = {
  tool: RuntimeTool;
  baseUrl: string;
  credential: RuntimeCredential | null;
  /** Valores que a IA extraiu (só os params origem='modelo'). */
  modelArgs: Record<string, unknown>;
  /** Identidade confiável, decifrada do token. */
  identity: Identity;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Prazo enquanto SEGUE páginas (são N requisições de propósito). Padrão 120s. */
  timeoutMsPaginado?: number;
};

export type ExecResult = {
  ok: boolean;
  status: number;
  data: unknown;
  /** Requisição montada (para o log). `url`/`body` contêm segredos crus — sanitize antes de
   *  gravar. `curl` e `urlSafe` já vêm com TODOS os segredos redigidos, inclusive os que
   *  estão no CAMINHO (que a sanitização por nome de query param não alcança). */
  request?: { method: string; url: string; urlSafe?: string; body?: string; curl?: string };
};

/** Monta a requisição HTTP a partir dos buckets resolvidos (função pura). */
export function buildHttpRequest(
  tool: RuntimeTool,
  baseUrl: string,
  buckets: ResolvedBuckets,
): { url: string; method: string; headers: Record<string, string>; body?: string } {
  // Substitui {param} no caminho. Um param `rawPath` pode conter barras (um
  // segmento composto, ex.: "empresa/filial/cargo" que escolhe o endpoint de
  // agrupamento): encoda cada segmento, mas preserva as barras.
  let path = tool.path_template;
  for (const [k, v] of Object.entries(buckets.path)) {
    const raw = tool.params.some((p) => p.nome === k && p.rawPath);
    const encoded = raw ? v.split("/").map(encodeURIComponent).join("/") : encodeURIComponent(v);
    path = path.replaceAll(`{${k}}`, encoded);
  }
  const base = baseUrl.replace(/\/+$/, "");
  const rel = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  const url = new URL(base + rel);
  for (const [k, v] of Object.entries(buckets.query)) url.searchParams.set(k, v);

  const headers: Record<string, string> = { ...buckets.header };
  const method = tool.method.toUpperCase();
  let body: string | undefined;
  if (method !== "GET" && method !== "DELETE") {
    // Com template, o corpo é o FORMATO declarado pela ferramenta, preenchido
    // com TODOS os valores resolvidos — não só os marcados como `local: body`.
    // Um mesmo parâmetro costuma ir ao caminho e ao corpo (o id do evento, por
    // exemplo), e obrigar a duplicá-lo no cadastro só produziria divergência.
    const corpo = tool.body_template
      ? montarCorpo(tool.body_template, { ...buckets.query, ...buckets.path, ...buckets.body })
      : Object.keys(buckets.body).length > 0
        ? envelopeBody(tool.body_mode, buckets.body)
        : null;
    if (corpo !== null) {
      body = JSON.stringify(corpo);
      headers["Content-Type"] = "application/json";
    }
  }
  return { url: url.toString(), method, headers, body };
}

/** Cabeçalho de autenticação por tipo. OAuth busca/renova o token (cacheado). */
export async function authHeaders(
  cred: RuntimeCredential | null,
  fetchImpl: typeof fetch,
): Promise<Record<string, string>> {
  if (!cred || cred.auth_type === "none") return {};
  const s = cred.secret;
  switch (cred.auth_type) {
    case "basic":
      return {
        Authorization: "Basic " + Buffer.from(`${s.username ?? ""}:${s.password ?? ""}`).toString("base64"),
      };
    case "bearer":
      return { Authorization: `Bearer ${s.token ?? ""}` };
    case "api_key":
      return { [s.header_name?.trim() || "Authorization"]: s.api_key ?? "" };
    case "oauth2": {
      const token = await getOAuthToken(cred.id, s, fetchImpl);
      return { Authorization: `Bearer ${token}` };
    }
    default:
      return {};
  }
}

/**
 * Valores CRUS dos parâmetros sensíveis, para redação por valor na URL.
 *
 * A busca por nome não alcança o caminho: `/ords/{key}/rh/v1/...` embute o
 * segredo no pathname, sem par `chave=valor` para casar. Aqui a redação passa a
 * ser pelo próprio valor, onde quer que ele apareça.
 */
export function valoresSensiveis(params: ToolParam[], buckets: ResolvedBuckets): string[] {
  const out: string[] = [];
  const varrer = (mapa: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(mapa)) {
      if (typeof v === "string" && v && nomeSensivel(k, params)) out.push(v);
    }
  };
  varrer(buckets.path);
  varrer(buckets.query);
  varrer(buckets.header);
  varrer(buckets.body);
  return out;
}

/**
 * Monta o `curl` equivalente à chamada, com valores de segredo REDIGIDOS.
 *
 * A redação é por PROCEDÊNCIA, não por adivinhação de nome: todo cabeçalho que
 * veio do bloco de autenticação (`nomesDeAuth`) e todo param declarado como
 * credencial são mascarados, aconteça o que acontecer com a grafia. A regex
 * continua como reforço para cabeçalhos avulsos.
 *
 * Só a regex não bastava: `auth_type='api_key'` aceita nome de cabeçalho livre,
 * e `Ocp-Apim-Subscription-Key`, `X-Access-Key` ou `X-Auth` não casavam nenhum
 * dos termos — a chave saía em claro para o console, o banco e a tela.
 */
export function curlDeChamada(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string,
  opts?: { nomesDeAuth?: string[]; params?: ToolParam[] },
): string {
  const daAuth = new Set((opts?.nomesDeAuth ?? []).map((n) => n.toLowerCase()));
  const segredo = (k: string) =>
    daAuth.has(k.toLowerCase()) ||
    nomeSensivel(k, opts?.params ?? []) ||
    /authorization|api[-_ ]?key|token|secret|cookie|senha|password|bearer|auth|chave|credential|subscription|session/i.test(k);
  const linhas = [`curl -X ${method} '${url}'`];
  for (const [k, v] of Object.entries(headers)) linhas.push(`  -H '${k}: ${segredo(k) ? "***REDIGIDO***" : v}'`);
  if (body) linhas.push(`  --data '${body.length > 2000 ? body.slice(0, 2000) + "…(truncado)" : body}'`);
  return linhas.join(" \\\n");
}

/**
 * Executa uma tool: resolve params (identidade + máscara), monta a requisição,
 * autentica e chama a API. No 401 de OAuth, invalida o token e tenta 1×.
 */
export async function executeTool(input: ExecInput): Promise<ExecResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const buckets = resolveParams(input.tool.params, input.modelArgs, input.identity, input.credential?.secret);
  const req = buildHttpRequest(input.tool, input.baseUrl, buckets);

  // Tool que fala em nome da PESSOA (Graph /me/*, Gmail): o token da base não
  // serve. Ele responderia — com a caixa da conta de serviço, apresentada como
  // se fosse a do usuário. Errar aqui em silêncio é pior que recusar.
  let auth: Record<string, string>;
  if (input.tool.identity_mode === "user") {
    if (!input.credential) {
      return {
        ok: false,
        status: 0,
        data: { erro: "Esta ação exige uma conta conectada, e nenhuma integração está configurada." },
      };
    }
    // Import DINÂMICO: `user-token` alcança o cliente admin do Supabase, que
    // valida env na carga do módulo. No topo do arquivo, ele derrubaria os
    // testes do executor inteiros — que nem exercitam este ramo — com um
    // ZodError de variável ausente. Aqui, só carrega quando a tool é pessoal.
    const { tokenDoUsuario } = await import("./user-token");
    const r = await tokenDoUsuario({
      credentialId: input.credential.id,
      // A pessoa, não o usuário da aplicação: no Painel do Colaborador o
      // `p_usuario` é 'PORTAL' para todo mundo (ver `user-key.ts`).
      pessoa: chavePessoal({ base: input.identity.base, empresa: input.identity.cod_empresa, matricula: input.identity.matricula }),
    });
    if (!r.ok) {
      // `status: 0` distingue "nem chegou a sair" de um erro do provedor, e a
      // mensagem vai inteira para o modelo — é ela que vira o pedido de conexão
      // na resposta ao usuário.
      return { ok: false, status: 0, data: { erro: r.mensagem, motivo: r.motivo } };
    }
    auth = { Authorization: `Bearer ${r.token}` };
  } else {
    auth = await authHeaders(input.credential, fetchImpl);
  }
  // cURL com TODOS os segredos redigidos — headers de auth E credenciais na query, no
  // CORPO e no CAMINHO (ex.: `key`=session_key pode ir em qualquer um dos três). Vai
  // para o trace do admin/logs: reproduzível para depurar a chamada da tool, sem nunca
  // vazar token/senha/session_key. `valoresSensiveis` cobre o path, que não tem nome de
  // query para a sanitização por nome morder.
  const urlRedigida = sanitizarUrl(req.url, input.tool.params, valoresSensiveis(input.tool.params, buckets));
  const corpoRedigido = req.body ? JSON.stringify(sanitizarBody(req.body, input.tool.params)) : undefined;
  const curl = curlDeChamada(req.method, urlRedigida, { ...req.headers, ...auth }, corpoRedigido, {
    nomesDeAuth: Object.keys(auth),
    params: input.tool.params,
  });
  // O stdout vai para o agregador da hospedagem — fora de RLS, sem prazo de guarda e
  // acessível a mais gente que o /admin/logs. O destino pretendido do cURL é o trace.
  if (process.env.TOOL_CURL_LOG === "1" || process.env.NODE_ENV !== "production") {
    console.log(`[tool-curl] ${input.tool.key}\n${curl}`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 15_000);
  try {
    let res = await fetchImpl(req.url, {
      method: req.method,
      headers: { ...req.headers, ...auth },
      body: req.body,
      signal: controller.signal,
    });

    if (res.status === 401 && input.credential?.auth_type === "oauth2") {
      invalidateOAuthToken(input.credential.id);
      const auth2 = await authHeaders(input.credential, fetchImpl);
      res = await fetchImpl(req.url, {
        method: req.method,
        headers: { ...req.headers, ...auth2 },
        body: req.body,
        signal: controller.signal,
      });
    }

    const text = await res.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* resposta não-JSON: devolve o texto cru */
    }

    // PAGINAÇÃO do ORDS: `{ items, hasMore }`. Sem seguir as páginas, a consulta
    // devolvia os 25 primeiros registros e nada dizia que havia mais — e a IA
    // contava, somava e concluía sobre um pedaço, com cara de resposta completa.
    // Vale para QUALQUER método: um endpoint de consulta pode ser POST (corpo com
    // filtros) e paginar do mesmo jeito. Restringir a GET deixava justamente
    // esses de fora — que são os que mais devolvem lista longa.
    if (res.ok && temMais(data)) {
      const url0 = new URL(req.url);
      let proxima = proximaPagina(data);
      // PRAZO MAIOR enquanto pagina. Os 15s são o certo para UMA requisição; aqui
      // são N de propósito, e manter o relógio de uma faria o teto voltar pela
      // porta dos fundos — com o agravante de virar "às vezes completo".
      clearTimeout(timer);
      const timerPag = setTimeout(() => controller.abort(), input.timeoutMsPaginado ?? 120_000);
      const junto = await juntarPaginas(data as PaginaOrds, async (offset) => {
        // 1º: o `links.next` que o PRÓPRIO ORDS publicou — acerta paginação por
        // cursor, nome de parâmetro diferente e filtros já embutidos.
        // 2º: `offset` montado na mão, para endpoint que não publica links.
        let alvo: string;
        if (proxima) {
          alvo = new URL(proxima, url0).toString();
        } else {
          const u = new URL(url0.toString());
          u.searchParams.set("offset", String(offset));
          // PÁGINA GRANDE: o ORDS aceita `limit` e reduz o vaivém em ~20×. Ele
          // mesmo corta no máximo do módulo, então pedir demais não quebra nada —
          // e a alternativa é 200 idas de 25 para trazer 5 mil registros.
          u.searchParams.set("limit", "500");
          alvo = u.toString();
        }
        const r = await fetchImpl(alvo, {
          method: req.method,
          headers: req.headers,
          // Consulta por POST leva os filtros no CORPO: sem reenviá-lo, a página
          // seguinte viria de outra consulta.
          ...(req.method !== "GET" && req.method !== "DELETE" && req.body ? { body: req.body } : {}),
          signal: controller.signal,
        });
        if (!r.ok) return null;
        try {
          const j = JSON.parse(await r.text());
          if (!ehPaginaOrds(j)) return null;
          proxima = proximaPagina(j);
          return j as PaginaOrds;
        } catch {
          return null;
        }
      });
      clearTimeout(timerPag);
      data = {
        ...(data as PaginaOrds),
        items: junto.items,
        hasMore: false,
        count: junto.items.length,
        // O aviso é DADO para a IA, não enfeite: sem ele, "faltam registros"
        // vira invisível de novo, só que num número maior.
        ...(junto.truncado
          ? { _truncado: `A consulta não conseguiu trazer TODOS os registros (${junto.items.length} obtidos) — o servidor falhou ou demorou demais no meio da leitura. Diga que a lista está incompleta e sugira filtrar para reduzir o volume. NÃO apresente totais como se fossem definitivos.` }
          : {}),
      };
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
      request: { method: req.method, url: req.url, urlSafe: urlRedigida, body: req.body, curl },
    };
  } finally {
    clearTimeout(timer);
  }
}
