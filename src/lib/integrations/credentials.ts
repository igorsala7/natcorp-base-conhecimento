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
      hint: "microsoft ou google. Define os endpoints de consentimento e os escopos padrão.",
    },
    { key: "client_id", label: "Client ID (Application ID)", required: true, secret: false },
    { key: "client_secret", label: "Client Secret (valor, não o ID)", required: true, secret: true },
    {
      key: "tenant",
      label: "Locatário (só Microsoft)",
      required: false,
      secret: false,
      hint: "GUID do tenant = registro single-tenant, só entram usuários daquele locatário. `common` = multi-tenant, cada empresa consente. Vazio equivale a `common`.",
    },
    {
      key: "scopes",
      label: "Escopos",
      required: false,
      secret: false,
      hint: "Vazio usa o padrão SÓ LEITURA do provedor. Acrescentar escopo de escrita aqui dá ao agente poder de agir em nome da pessoa — faça de propósito.",
    },
    {
      key: "authorize_url",
      label: "URL de consentimento",
      required: false,
      secret: false,
      hint: "Só para nuvem soberana. Vazio usa o endpoint público do provedor.",
    },
    { key: "token_url", label: "URL do token", required: false, secret: false, hint: "Idem." },
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

/** Chaves obrigatórias de um tipo — usado para validar o blob antes de cifrar. */
export function requiredKeys(t: AuthType): string[] {
  return CREDENTIAL_FIELDS[t].filter((f) => f.required).map((f) => f.key);
}
