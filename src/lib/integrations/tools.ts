/**
 * Definição de um PARÂMETRO de uma API/Tool e as opções de cadastro.
 *
 * Compartilhado entre a tela (editor de params) e o motor (Fase E, que monta a
 * requisição). Guardado em `ai_tools.params` (jsonb). Regras de segurança:
 *  - `origem: 'identidade'` → o valor vem do TOKEN cifrado (nunca do modelo);
 *  - `origem: 'modelo'`     → a IA extrai da conversa (validado por tipo);
 *  - `origem: 'fixo'`       → valor constante definido aqui.
 */

export type ParamTipo = "string" | "number" | "date" | "enum" | "boolean";
/** `credencial` injeta um campo do SEGREDO da credencial (ex.: session_key) — nunca do modelo. */
export type ParamOrigem = "modelo" | "identidade" | "fixo" | "credencial";
export type ParamLocal = "query" | "path" | "body" | "header";
/**
 * Campos de identidade disponíveis para injeção nas tools.
 * `usuario/cod_empresa/matricula/perfil/portal` vêm do TOKEN (p_*). `cpf` é
 * resolvido no SERVIDOR (login ORDS) quando a credencial tem `session_key` —
 * nunca vem do token nem do modelo.
 */
export type IdentityField = "usuario" | "cod_empresa" | "matricula" | "perfil" | "portal" | "cpf";

export type ToolParam = {
  /** Nome do parâmetro NA API. */
  nome: string;
  /** Explicação p/ a IA (só relevante quando origem = 'modelo'). */
  descricao: string;
  tipo: ParamTipo;
  origem: ParamOrigem;
  obrigatorio: boolean;
  /** Onde entra na requisição. `path` casa com `{nome}` no path_template. */
  local: ParamLocal;
  /** Formato de saída (datas variam por API): dd/MM/yyyy, MM/yyyy, yyyy-MM-dd… */
  mascara?: string | null;
  /** Valores possíveis quando tipo = 'enum'. */
  opcoes?: string[];
  /** Campo do token a injetar quando origem = 'identidade'. */
  campoIdentidade?: IdentityField | null;
  /** Valor constante quando origem = 'fixo'. */
  valorFixo?: string | null;
  /** Campo do segredo da credencial a injetar quando origem = 'credencial' (ex.: 'session_key'). */
  campoCredencial?: string | null;
};

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const PARAM_TIPOS: readonly { value: ParamTipo; label: string }[] = [
  { value: "string", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "enum", label: "Lista (enum)" },
  { value: "boolean", label: "Booleano" },
];

export const PARAM_ORIGENS: readonly { value: ParamOrigem; label: string; hint: string }[] = [
  { value: "modelo", label: "IA extrai da conversa", hint: "O modelo preenche a partir do que o usuário pedir." },
  { value: "identidade", label: "Identidade (token)", hint: "Injetado do token cifrado — nunca do modelo." },
  { value: "fixo", label: "Valor fixo", hint: "Constante definida aqui." },
  { value: "credencial", label: "Segredo da credencial", hint: "Injeta um campo do segredo da credencial (ex.: session_key)." },
];

export const PARAM_LOCAIS: readonly { value: ParamLocal; label: string }[] = [
  { value: "query", label: "Query string" },
  { value: "path", label: "Caminho (path)" },
  { value: "body", label: "Corpo (body)" },
  { value: "header", label: "Header" },
];

export const IDENTITY_FIELDS: readonly { value: IdentityField; label: string }[] = [
  { value: "usuario", label: "Usuário (p_usuario)" },
  { value: "cod_empresa", label: "Cód. empresa (p_empresa)" },
  { value: "matricula", label: "Matrícula (p_matricula)" },
  { value: "perfil", label: "Perfil (gestor/colaborador)" },
  { value: "portal", label: "Portal (p_portal)" },
  { value: "cpf", label: "CPF (resolvido no login)" },
];

/** Um parâmetro em branco para o editor. */
export function paramVazio(): ToolParam {
  return { nome: "", descricao: "", tipo: "string", origem: "modelo", obrigatorio: false, local: "query" };
}
