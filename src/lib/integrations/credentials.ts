/**
 * Tipos de autenticação das APIs/Tools e os campos de credencial de cada um.
 *
 * Compartilhado entre a TELA (que renderiza os campos por tipo) e o MOTOR de
 * execução (Fase E, que decifra o blob e monta o cabeçalho de auth). O segredo
 * é guardado como um JSON `{ campo: valor }` cifrado em `ai_base_credential_secrets`
 * — só o servidor (service-role) lê; a tela nunca recebe o valor de volta.
 */

export type AuthType = "none" | "basic" | "api_key" | "bearer" | "oauth2";

export const AUTH_TYPES: readonly { value: AuthType; label: string }[] = [
  { value: "oauth2", label: "OAuth 2.0 (client credentials)" },
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
