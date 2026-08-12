/**
 * OAuth delegado (`authorization_code`) — o token que age COMO O USUÁRIO.
 *
 * Convive com [oauth.ts](./oauth.ts), que faz `client_credentials` e continua
 * atendendo o que é institucional. A diferença não é de estilo: um token de
 * aplicativo nunca consegue responder "os e-mails do Fulano" no Graph, porque
 * `/me/*` é resolvido pela identidade que autenticou, não por parâmetro.
 *
 * Puro no que dá e com `fetch` injetável no resto — mesmo padrão do oauth.ts —
 * para os testes rodarem sem rede e sem servidor de autorização.
 *
 * O que este módulo NÃO faz, de propósito: ler ou gravar no banco. Quem
 * persiste é a rota, que tem o service-role. Assim a lógica de montar URL,
 * trocar código e decidir renovação fica testável isolada.
 */

export type ProviderConnect = "microsoft" | "google";

/** Config do fluxo, lida do JSON cifrado da credencial. */
export type ConfigDelegada = {
  client_id: string;
  client_secret: string;
  /**
   * Só Microsoft. GUID do locatário = registro single-tenant (só entram
   * usuários daquele tenant); `common` = multi-tenant. É configuração e não
   * constante porque, se as empresas clientes tiverem tenants próprios, o
   * valor precisa mudar sem deploy.
   */
  tenant?: string;
  /** Sobrescreve o padrão do provedor. Raro; existe para nuvens soberanas. */
  authorize_url?: string;
  token_url?: string;
  scopes?: string;
  /**
   * "1" = a conta conectada TEM de ser a do e-mail funcional do cadastro
   * (`meus_dados`). Desligado por padrão: nem todo cliente tem SSO com o
   * provedor, e nesses o e-mail do RH não corresponde a conta nenhuma —
   * exigir travaria quem não tem como cumprir. Quem liga é o administrador,
   * na tela de credenciais.
   */
  exigir_email_funcional?: string;
};

/** A checagem do e-mail está ligada nesta credencial? */
export const exigeEmailFuncional = (cfg: ConfigDelegada): boolean =>
  String(cfg.exigir_email_funcional ?? "").trim() === "1";

/**
 * A conta que autorizar tem de ser a do e-mail funcional do cadastro?
 *
 * Sim, sempre, quando a credencial é a CADASTRADA NA BASE: credencial própria
 * significa app do provedor dentro do diretório do cliente, onde a conta do SSO
 * e o e-mail funcional do RH são a mesma coisa. Aceitar outra caixa ali seria
 * aceitar um remetente que o RH não reconhece — e o parâmetro do administrador
 * não deveria poder afrouxar isso (decisão do Igor, 12/08/2026).
 *
 * Com a credencial GLOBAL — um app servindo vários clientes, inclusive os sem
 * SSO — a igualdade não é dada, e aí vale o que o administrador declarou.
 */
export const deveConferirEmailFuncional = (input: {
  propriaDaBase: boolean;
  cfg: ConfigDelegada;
}): boolean => input.propriaDaBase || exigeEmailFuncional(input.cfg);

const PADRAO: Record<ProviderConnect, { authorize: (t: string) => string; token: (t: string) => string; scopes: string }> = {
  microsoft: {
    authorize: (t) => `https://login.microsoftonline.com/${t}/oauth2/v2.0/authorize`,
    token: (t) => `https://login.microsoftonline.com/${t}/oauth2/v2.0/token`,
    // Piloto SÓ LEITURA. `offline_access` é o que faz a Microsoft devolver
    // refresh_token — sem ele a conexão morre em uma hora e o usuário teria de
    // reconsentir a cada pergunta.
    scopes: "offline_access openid email profile User.Read Mail.Read Calendars.Read Files.Read",
  },
  google: {
    authorize: () => "https://accounts.google.com/o/oauth2/v2/auth",
    token: () => "https://oauth2.googleapis.com/token",
    scopes:
      "openid email profile https://www.googleapis.com/auth/gmail.readonly " +
      "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.readonly",
  },
};

const tenantDe = (cfg: ConfigDelegada): string =>
  cfg.tenant && cfg.tenant.trim() ? cfg.tenant.trim() : "common";

export const escoposDe = (provider: ProviderConnect, cfg: ConfigDelegada): string =>
  cfg.scopes && cfg.scopes.trim() ? cfg.scopes.trim() : PADRAO[provider].scopes;

export const urlDeToken = (provider: ProviderConnect, cfg: ConfigDelegada): string =>
  cfg.token_url?.trim() || PADRAO[provider].token(tenantDe(cfg));

/**
 * URL de consentimento.
 *
 * `prompt=consent` no Google é necessário para receber `refresh_token` numa
 * reconexão: sem ele, a segunda autorização devolve só o access_token e a
 * conexão fica quebrada uma hora depois — falha que só aparece em produção,
 * quando alguém reconecta.
 */
export function urlDeConsentimento(input: {
  provider: ProviderConnect;
  cfg: ConfigDelegada;
  redirectUri: string;
  nonce: string;
  /** E-mail FUNCIONAL da pessoa (cadastro do RH), quando conhecido. */
  loginHint?: string | null;
  /**
   * SILENCIOSO (`prompt=none`): aproveita a sessão que o navegador já tem com o
   * provedor — a pessoa acabou de entrar no sistema anfitrião por SSO — e volta
   * sem desenhar nada. Falha (`login_required` / `interaction_required`) quando
   * não há sessão ou quando os escopos ainda não foram consentidos; aí o fluxo
   * normal, com a janela visível, é a reserva.
   */
  silencioso?: boolean;
}): string {
  const { provider, cfg, redirectUri, nonce } = input;
  const base = cfg.authorize_url?.trim() || PADRAO[provider].authorize(tenantDe(cfg));
  const q = new URLSearchParams({
    client_id: cfg.client_id,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: escoposDe(provider, cfg),
    state: nonce,
  });
  if (provider === "google") {
    q.set("access_type", "offline");
    // `prompt=consent` e `prompt=none` são mutuamente exclusivos. No silencioso
    // manda `none`: se o Google não devolver refresh_token, a gravação recusa a
    // conexão (ver o callback) e a pessoa cai no fluxo visível, que pede
    // consentimento e traz o refresh.
    if (!input.silencioso) q.set("prompt", "consent");
  }
  if (input.silencioso) q.set("prompt", "none");
  // `login_hint` abre a tela do provedor JÁ na conta corporativa da pessoa (o
  // e-mail funcional do cadastro do RH). Num navegador com o e-mail pessoal
  // logado — o caso comum — sem isto a tela oferece a conta errada, e conectar a
  // caixa errada é um erro silencioso: tudo funciona, só que o e-mail sai do
  // lugar errado. É DICA, não trava: quem precisa trocar de conta ainda troca.
  // Os dois provedores usam o mesmo nome de parâmetro.
  const hint = input.loginHint?.trim();
  if (hint) q.set("login_hint", hint);
  return `${base}?${q.toString()}`;
}

export type Tokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  /** Escopos EFETIVAMENTE concedidos — podem ser menos que os pedidos. */
  scopes: string[];
};

/** `expires_in` ausente → 1h, o padrão dos dois provedores. Margem de 60s. */
function expiraEm(json: { expires_in?: number }, agora: number): number {
  return agora + ((json.expires_in ?? 3600) - 60) * 1000;
}

type RespostaToken = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function pedirToken(
  provider: ProviderConnect,
  cfg: ConfigDelegada,
  body: URLSearchParams,
  fetchImpl: typeof fetch,
  agora: number,
): Promise<Tokens> {
  body.set("client_id", cfg.client_id);
  body.set("client_secret", cfg.client_secret);
  const res = await fetchImpl(urlDeToken(provider, cfg), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as RespostaToken;
  if (!res.ok || !json.access_token) {
    // A mensagem do provedor é a única pista útil quando o registro está mal
    // configurado (redirect_uri divergente, escopo sem consentimento de admin).
    // Sem ela o suporte vira adivinhação.
    const detalhe = json.error_description || json.error || `HTTP ${res.status}`;
    throw new Error(`Falha ao obter token (${provider}): ${detalhe}`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: expiraEm(json, agora),
    scopes: (json.scope ?? "").split(/\s+/).filter(Boolean),
  };
}

/** Troca o `code` do consentimento pelo par de tokens. */
export function trocarCodigo(input: {
  provider: ProviderConnect;
  cfg: ConfigDelegada;
  code: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
  agora?: number;
}): Promise<Tokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
  });
  return pedirToken(input.provider, input.cfg, body, input.fetchImpl ?? fetch, input.agora ?? Date.now());
}

/**
 * Renova pelo refresh_token.
 *
 * A Microsoft costuma devolver um refresh_token NOVO a cada renovação e
 * invalidar o anterior (rotação). Por isso `refreshToken` volta no retorno e o
 * chamador precisa gravar quando vier preenchido — guardar o antigo quebra a
 * conexão na renovação seguinte. Quando vier `null`, o antigo continua válido.
 */
export function renovar(input: {
  provider: ProviderConnect;
  cfg: ConfigDelegada;
  refreshToken: string;
  fetchImpl?: typeof fetch;
  agora?: number;
}): Promise<Tokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
  });
  // A Microsoft exige `scope` também na renovação; o Google ignora.
  body.set("scope", escoposDe(input.provider, input.cfg));
  return pedirToken(input.provider, input.cfg, body, input.fetchImpl ?? fetch, input.agora ?? Date.now());
}

/**
 * O access_token em cache ainda serve?
 *
 * Puro, e separado da renovação, porque é a decisão que mais se erra: usar um
 * token que expira em 3 segundos faz a chamada falhar no meio do turno, e o
 * usuário vê um erro que some sozinho no retry — o pior tipo de bug de suporte.
 */
export function precisaRenovar(expiresAt: number | null | undefined, agora = Date.now()): boolean {
  if (!expiresAt) return true;
  return expiresAt <= agora;
}

/** Quem é a pessoa, para a trilha de auditoria do vínculo. */
export type Perfil = { email: string | null; nome: string | null };

const URL_PERFIL: Record<ProviderConnect, string> = {
  microsoft: "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
  google: "https://openidconnect.googleapis.com/v1/userinfo",
};

/**
 * Lê o perfil da conta que consentiu.
 *
 * Nunca lança: o vínculo é pelo `p_usuario` do anfitrião (decisão do produto),
 * então o e-mail é trilha, não critério. Derrubar a conexão porque a leitura do
 * perfil falhou seria trocar uma auditoria melhor por uma conexão que não
 * acontece.
 */
export async function lerPerfil(
  provider: ProviderConnect,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Perfil> {
  try {
    const res = await fetchImpl(URL_PERFIL[provider], {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { email: null, nome: null };
    const j = (await res.json()) as Record<string, unknown>;
    const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return provider === "microsoft"
      ? { email: txt(j.mail) ?? txt(j.userPrincipalName), nome: txt(j.displayName) }
      : { email: txt(j.email), nome: txt(j.name) };
  } catch {
    return { email: null, nome: null };
  }
}
