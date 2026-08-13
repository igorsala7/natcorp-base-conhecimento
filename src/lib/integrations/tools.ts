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
export type ParamOrigem = "modelo" | "identidade" | "fixo" | "credencial" | "pessoa";
/** `none` = a IA preenche, mas NÃO vai na requisição (uso interno, ex.: código de um guard). */
export type ParamLocal = "query" | "path" | "body" | "header" | "none";
/**
 * Campos de identidade disponíveis para injeção nas tools.
 * `usuario/cod_empresa/matricula/perfil/portal` vêm do TOKEN (p_*). `cpf` e
 * `cod_candidato` são resolvidos no SERVIDOR (login ORDS) quando a credencial tem
 * `session_key` — nunca vêm do token nem do modelo. `cod_candidato` serve às tools
 * de "só o próprio dado" (o param P_COD_CANDIDATO com origem=identidade fixa o
 * candidato do usuário logado, invisível ao modelo).
 */
export type IdentityField = "usuario" | "cod_empresa" | "matricula" | "perfil" | "portal" | "cpf" | "base" | "cod_candidato";

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
  /**
   * Data que só existe no FUTURO (saída de férias, agendamento). Quando o valor
   * cai no passado, o servidor avança para a próxima ocorrência do mesmo dia e
   * mês — ver data-futura.ts.
   *
   * Existe porque a pessoa diz "01/10" e o ANO é dedução do modelo, que erra.
   * Não use em consulta histórica nem em período aquisitivo, que são
   * legitimamente passados.
   */
  futuro?: boolean;
  /** Valores possíveis quando tipo = 'enum'. */
  opcoes?: string[];
  /** Campo do token a injetar quando origem = 'identidade'. */
  campoIdentidade?: IdentityField | null;
  /** Valor constante quando origem = 'fixo'. */
  valorFixo?: string | null;
  /** Campo do segredo da credencial a injetar quando origem = 'credencial' (ex.: 'session_key'). */
  campoCredencial?: string | null;
  /**
   * Só para `local: 'path'`: insere o valor no caminho SEM percent-encode das
   * barras — permite um segmento composto (ex.: um enum "empresa/filial/cargo"
   * que escolhe o endpoint de agrupamento). Cada segmento ainda é encodado.
   */
  rawPath?: boolean;
};

/**
 * Expansão/loop de uma ferramenta cuja API aceita UM valor por chamada, mas o
 * usuário quer VÁRIOS (ver `ai_tools.loop`). O servidor itera e agrega — o modelo
 * faz UMA chamada. Dois modos:
 *  - `month`  : período mensal; o modelo informa `from`/`to` (ISO AAAA-MM) e o
 *               servidor itera mês a mês, injetando cada mês em `param`.
 *  - `values` : o modelo informa uma LISTA de valores em `param` (ex.: várias
 *               matrículas) e o servidor consulta UM A UM (uma chamada por valor).
 *               Use quando a API aceita só 1 valor por vez (ou há guard por valor,
 *               ex.: escopo_pessoa validando cada matrícula). Cap = `max`.
 *  - `batch`  : a API aceita uma LISTA separada por vírgula no MESMO parâmetro (ex.:
 *               `123,344,502`). O modelo passa todos; o servidor FATIA em lotes de
 *               `max` (junta cada lote com vírgula) e faz UMA chamada por lote —
 *               evita estourar o limite de tamanho de UM request com muitos itens.
 */
export type LoopConfig = {
  /** Modo da iteração. */
  unit: "month" | "values" | "batch";
  /** Nome do parâmetro que a API espera (recebe cada valor/mês, ou o lote em `batch`). */
  param: string;
  /** (month) Parâmetro com o início do período (ISO AAAA-MM). */
  from?: string;
  /** (month) Parâmetro com o fim do período (opcional; ausente = 1 mês). */
  to?: string;
  /** Teto por iteração/lote. Padrão 24 (month) / 20 (values) / 20 por lote (batch). */
  max?: number | null;
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
  { value: "pessoa", label: "Pessoa (por painel)", hint: "A IA informa a matrícula-alvo; o servidor libera conforme o painel (Operador=qualquer, Gestor=equipe, Colaborador=só o próprio). Sem alvo, usa o próprio (via `campoIdentidade`). Requer o guard escopo_pessoa." },
];

export const PARAM_LOCAIS: readonly { value: ParamLocal; label: string }[] = [
  { value: "query", label: "Query string" },
  { value: "path", label: "Caminho (path)" },
  { value: "body", label: "Corpo (body)" },
  { value: "header", label: "Header" },
  { value: "none", label: "Não enviar (uso interno)" },
];

export const IDENTITY_FIELDS: readonly { value: IdentityField; label: string }[] = [
  { value: "usuario", label: "Usuário (p_usuario)" },
  { value: "cod_empresa", label: "Cód. empresa (p_empresa)" },
  { value: "matricula", label: "Matrícula (p_matricula)" },
  { value: "perfil", label: "Perfil (gestor/colaborador)" },
  { value: "portal", label: "Portal (p_portal)" },
  { value: "cpf", label: "CPF (resolvido no login)" },
  { value: "cod_candidato", label: "Cód. candidato (P_COD_CANDIDATO — resolvido no login)" },
  { value: "base", label: "Base/cliente (p_base)" },
];

/** Um parâmetro em branco para o editor. */
export function paramVazio(): ToolParam {
  return { nome: "", descricao: "", tipo: "string", origem: "modelo", obrigatorio: false, local: "query" };
}
