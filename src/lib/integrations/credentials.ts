/**
 * Tipos de autenticação das APIs/Tools e os campos de credencial de cada um.
 *
 * Compartilhado entre a TELA (que renderiza os campos por tipo) e o MOTOR de
 * execução (Fase E, que decifra o blob e monta o cabeçalho de auth). O segredo
 * é guardado como um JSON `{ campo: valor }` cifrado em `ai_base_credential_secrets`
 * — só o servidor (service-role) lê; a tela nunca recebe o valor de volta.
 */

export type AuthType = "none" | "basic" | "api_key" | "bearer" | "oauth2" | "oauth2_user";

export const AUTH_TYPES: readonly { value: AuthType; label: string }[] = [
  { value: "oauth2", label: "OAuth 2.0 (client credentials)" },
  { value: "oauth2_user", label: "OAuth 2.0 delegado (conta do usuário)" },
  { value: "bearer", label: "Bearer token" },
  { value: "api_key", label: "API key" },
  { value: "basic", label: "Basic (usuário/senha)" },
  { value: "none", label: "Sem autenticação" },
] as const;

export type CredField = {
  key: string;
  label: string;
  required: boolean;
  /** Campo sensível (senha/segredo): renderizar como `type=password`. */
  secret: boolean;
  hint?: string;
  /**
   * Valores fixos → a tela desenha uma LISTA em vez de campo aberto. Digitar
   * `Microsoft` num campo livre onde o motor espera `microsoft` é um erro que
   * só aparece na hora de conectar.
   */
  options?: readonly { value: string; label: string }[];
  /**
   * O campo NÃO faz parte do blob cifrado: vai para uma coluna da credencial.
   * A ação de salvar o retira do blob e o valida à parte — sem esta marca, ele
   * seria cobrado como "segredo faltando" depois de já ter sido removido, que
   * é um erro impossível de entender pela mensagem.
   */
  meta?: boolean;
};

/** Campos de credencial por tipo de auth. token_url e endpoints ficam AQUI (por base). */
export const CREDENTIAL_FIELDS: Record<AuthType, readonly CredField[]> = {
  oauth2: [
    { key: "token_url", label: "URL do token", required: true, secret: false, hint: "Endpoint que emite o access_token desta base." },
    { key: "client_id", label: "Client ID", required: true, secret: false },
    { key: "client_secret", label: "Client Secret", required: true, secret: true },
    { key: "scope", label: "Scope", required: false, secret: false, hint: "Opcional." },
    {
      key: "session_key",
      label: "Chave de sessão (login ORDS)",
      required: false,
      secret: true,
      hint: "Opcional. Se preenchida, o sistema valida o usuário e busca o cadastro (CPF, perfil) via login/v1 antes de acionar as APIs.",
    },
  ],
  // OAuth DELEGADO: o agente age como a PESSOA, não como a aplicação. Cada
  // cliente cadastra o próprio registro (Entra/Google Cloud) — `ai_bases` é a
  // empresa 1:1, então a credencial já nasce isolada por cliente.
  //
  // `provider` não é segredo e vai para uma COLUNA de `ai_base_credentials` (a
  // tela precisa saber qual botão desenhar sem decifrar nada); a ação de salvar
  // o retira deste blob. Fica listado aqui só para o formulário renderizá-lo
  // junto, sem uma segunda tela.
  oauth2_user: [
    {
      key: "provider",
      label: "Provedor",
      required: true,
      secret: false,
      meta: true,
      options: [
        { value: "microsoft", label: "Microsoft 365 / Entra ID" },
        { value: "google", label: "Google Workspace" },
      ],
      hint: "Define os endpoints de consentimento e os escopos padrão.",
    },
    { key: "client_id", label: "Client ID (Application ID)", required: true, secret: false },
    {
      key: "client_secret",
      label: "Client Secret — o VALOR",
      required: true,
      secret: true,
      hint: "O Azure mostra duas colunas: Valor e ID do Segredo. É o VALOR. Se o que você tem parece um GUID (8-4-4-4-12), é o ID e não vai autenticar — gere um segredo novo e copie o Valor na hora, ele só aparece uma vez.",
    },
    {
      key: "tenant",
      label: "Locatário (só Microsoft)",
      required: false,
      secret: false,
      hint: "DEIXE VAZIO para multitenant (cada empresa consente no próprio Azure). Preencher o GUID trava o acesso a um único locatário.",
    },
    {
      key: "scopes",
      label: "Escopos",
      required: false,
      secret: false,
      hint: "Vazio usa o padrão SÓ LEITURA do provedor. Acrescentar escopo de escrita aqui dá ao agente poder de agir em nome da pessoa — faça de propósito.",
    },
    // Os dois campos abaixo NÃO são a URL de callback. O callback se cadastra no
    // portal do provedor (Azure → Redirect URI), nunca aqui — confundir os dois
    // faz a troca do código ser enviada para a nossa própria aplicação em vez
    // do provedor, e o erro só aparece no fim do consentimento.
    {
      // Um app no provedor serve o sistema inteiro porque a URL de callback é
      // uma só (sai de NEXT_PUBLIC_SITE_URL, não varia por cliente). Marcar
      // aqui evita recadastrar o mesmo client_id em cada base — e, pior, evita
      // a segunda linha apontar para um registro que não tem a URL e nunca
      // conecta. As bases que tiverem credencial própria continuam usando a
      // delas: esta é a reserva.
      key: "is_global",
      label: "Usar esta credencial em todas as bases",
      required: false,
      secret: false,
      meta: true,
      options: [
        { value: "", label: "Não — só nesta base" },
        { value: "1", label: "Sim — vale para todas as bases sem credencial própria" },
      ],
      hint: "O callback registrado no provedor é único para o sistema, então normalmente há um app só. Só pode haver uma global por provedor.",
    },
    {
      // Amarra a caixa conectada ao cadastro do RH. DESLIGADO por padrão: nem
      // todo cliente tem SSO com o Azure, e nesses o e-mail funcional do
      // cadastro não corresponde a conta nenhuma do provedor — exigir travaria
      // gente que não tem como cumprir.
      key: "exigir_email_funcional",
      label: "Exigir que a conta seja a do e-mail funcional",
      required: false,
      secret: false,
      options: [
        { value: "", label: "Não — aceita qualquer conta que a pessoa autorizar" },
        { value: "1", label: "Sim — recusa conta diferente do cadastro (exige SSO)" },
      ],
      hint: "Vale para a credencial GLOBAL (um app servindo várias bases). Numa credencial cadastrada NA PRÓPRIA BASE a conferência é sempre feita, independente deste campo — ali o app é do diretório do cliente e o e-mail funcional é a conta do SSO.",
    },
    {
      key: "authorize_url",
      label: "URL de consentimento (avançado)",
      required: false,
      secret: false,
      hint: "DEIXE VAZIO. Só se usa em nuvem soberana. Não é a URL de callback.",
    },
    {
      key: "token_url",
      label: "URL do token (avançado)",
      required: false,
      secret: false,
      hint: "DEIXE VAZIO. Só se usa em nuvem soberana. Não é a URL de callback.",
    },
  ],
  bearer: [{ key: "token", label: "Token", required: true, secret: true }],
  api_key: [
    { key: "api_key", label: "API key", required: true, secret: true },
    { key: "header_name", label: "Nome do header", required: false, secret: false, hint: "Padrão: Authorization." },
  ],
  basic: [
    { key: "username", label: "Usuário", required: true, secret: false },
    { key: "password", label: "Senha", required: true, secret: true },
  ],
  none: [],
} as const;

export function isAuthType(v: unknown): v is AuthType {
  return typeof v === "string" && v in CREDENTIAL_FIELDS;
}

/**
 * Chaves obrigatórias DO BLOB — usado para validar o segredo antes de cifrar.
 *
 * Exclui os campos `meta`, que não moram no blob: eles são retirados antes de
 * cifrar e validados à parte. Sem essa exclusão, o campo era cobrado como
 * ausente logo depois de ter sido removido de propósito, e a tela pedia para
 * preencher algo que já estava preenchido.
 */
export function requiredKeys(t: AuthType): string[] {
  return CREDENTIAL_FIELDS[t].filter((f) => f.required && !f.meta).map((f) => f.key);
}

/** Campos que vão para COLUNA, não para o blob cifrado. */
export function metaKeys(t: AuthType): string[] {
  return CREDENTIAL_FIELDS[t].filter((f) => f.meta).map((f) => f.key);
}

/**
 * Separa o blob decifrado em CONFIGURAÇÃO e SEGREDO.
 *
 * O blob guarda os dois misturados: `client_id` e URL do token moram ao lado do
 * `client_secret`. Como nada voltava para a tela, editar uma credencial obrigava
 * a redigitar tudo — inclusive o que nunca foi segredo — e a via mais fácil
 * virava recadastrar, arriscando trocar um campo certo por um errado.
 *
 * O corte é a marca `secret` que cada campo já declara. Chave desconhecida (de
 * um tipo de auth antigo, ou renomeada) cai em `segredo` por precaução: numa
 * dúvida sobre expor ou esconder, esconder é o erro barato.
 */
export function separarCampos(
  t: AuthType,
  blob: Record<string, unknown>,
): { config: Record<string, string>; segredo: Record<string, string> } {
  const porChave = new Map(CREDENTIAL_FIELDS[t].map((f) => [f.key, f]));
  const config: Record<string, string> = {};
  const segredo: Record<string, string> = {};
  for (const [k, v] of Object.entries(blob ?? {})) {
    if (typeof v !== "string" && typeof v !== "number") continue;
    const campo = porChave.get(k);
    (campo && !campo.secret ? config : segredo)[k] = String(v);
  }
  return { config, segredo };
}

/** Chaves marcadas como segredo naquele tipo — o que a tela mascara. */
export function chavesSecretas(t: AuthType): string[] {
  return CREDENTIAL_FIELDS[t].filter((f) => f.secret).map((f) => f.key);
}
