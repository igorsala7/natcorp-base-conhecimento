import type { TrackingKey } from "@/lib/chat/tracking";

/**
 * AS DOZE DIMENSÕES DE ELEGIBILIDADE, e por que doze.
 *
 * Ditadas pelo dono em 24/09. Todas são a ALOCAÇÃO da pessoa, nunca o que ela
 * gerencia: um gestor responsável por três centros de custo tem UM centro de
 * custo próprio, e é esse que conta. Vínculo é o empregatício (CLT, PJ,
 * autônomo, estagiário).
 *
 * Isso está escrito porque a alternativa vai ser proposta de novo: aceitar
 * lista por dimensão na identidade (para cobrir "gestor de vários CCs") mudaria
 * o predicado, o formato do token e as três telas que o consomem.
 *
 * `p_cod_candidato` NÃO entra. Ele identifica fluxo de candidato, não recorte
 * de público, e como filtro convidaria a restringir conteúdo a um candidato.
 */
export const DIMENSOES = [
  "base",
  "portal",
  "perfil",
  "usuario",
  "empresa",
  "matricula",
  "filial",
  "centro_custo",
  "unidade_adm",
  "unidade_negocio",
  "vinculo",
  "sindicato",
] as const;

export type Dimensao = (typeof DIMENSOES)[number];

/** Allowlist por dimensão. Ausente ou vazia = não restringe. */
export type Regra = Partial<Record<Dimensao, string[]>>;

/** Quem está perguntando, uma valor por dimensão. */
export type Identidade = Partial<Record<Dimensao, string | null | undefined>>;

/**
 * De dimensão para o parâmetro de rastreio que a carrega.
 *
 * Existe para que ninguém escreva `"p_centro_custo"` à mão em três lugares e
 * erre num deles: o erro não daria exceção, daria conteúdo que não alcança
 * ninguém.
 */
export const CHAVE_DE_DIMENSAO: Record<Dimensao, TrackingKey> = {
  base: "p_base",
  portal: "p_portal",
  perfil: "p_perfil",
  usuario: "p_usuario",
  empresa: "p_empresa",
  matricula: "p_matricula",
  filial: "p_filial",
  centro_custo: "p_centro_custo",
  unidade_adm: "p_unidade_adm",
  unidade_negocio: "p_unidade_negocio",
  vinculo: "p_vinculo",
  sindicato: "p_sindicato",
};
