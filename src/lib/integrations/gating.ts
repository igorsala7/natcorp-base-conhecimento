/**
 * Trava de agente por PERFIL (função pura, testável).
 *
 * Um agente com `requires_perfil` só é elegível quando o perfil resolvido no
 * TOKEN (p_perfil, mandado pelo portal: MASTER no PO, GESTOR no PG, COLABORADOR
 * no PC) confere exatamente — a comparação ignora caixa. O login NÃO altera esse
 * perfil: responder por um centro de custo é fato do cadastro, não perfil. `requires_perfil` nulo/vazio =
 * sem exigência (qualquer perfil, inclusive perfil ausente). O perfil NUNCA vem
 * do modelo — vem do servidor. Ver [[system-prompt-sections]] / tool-builder.
 */
export function perfilAtende(requiresPerfil: string | null | undefined, perfil: string | undefined): boolean {
  const exigido = (requiresPerfil ?? "").trim();
  if (!exigido) return true; // sem exigência
  return (perfil ?? "").trim().toLowerCase() === exigido.toLowerCase();
}

/** Portais fixos: PO = Operador, PG = Gestor, PC = Colaborador. */
export const PORTAIS = [
  { code: "PO", label: "Operador" },
  { code: "PG", label: "Gestor" },
  { code: "PC", label: "Colaborador" },
] as const;

const eqCI = (a: string, b: string | undefined) => (b ?? "").trim().toLowerCase() === a.trim().toLowerCase();

/**
 * Tira os BRANCOS da allowlist antes de comparar, e isto não é limpeza.
 *
 * `eqCI("", undefined)` compara `"" === ""` e dá verdadeiro. Ou seja, com
 * `portais: ["", "PG"]` uma linha em branco salva sem intenção liberava a
 * ferramenta para todo mundo que NÃO manda `p_portal` — o oposto da regra, e
 * sem erro em lugar nenhum para investigar. É o mesmo furo que 24/09 fechou em
 * `public.allowlist_casa`, do outro lado do sistema.
 *
 * Latente e não explorado quando encontrado: 1.586 linhas em `ai_base_tools`,
 * zero entrada em branco. O outro também estava assim antes de alguém olhar.
 *
 * Com os brancos fora, os três efeitos caem no lugar de uma vez: lista só de
 * brancos vira lista vazia e não restringe (convenção do projeto, igual a
 * `cardinality = 0`); branco junto de valor real deixa a restrição valer; e
 * valor ausente não tem com o que casar.
 */
const semBrancos = (l: string[] | null | undefined) =>
  (l ?? []).filter((x) => (x ?? "").trim() !== "");

/**
 * Acesso a uma FERRAMENTA por PORTAL, EMPRESA e PERFIL — allowlists por
 * (base, ferramenta). Vazio (ou só de brancos) = liberado (100%). Regra (#4):
 *   (operador OU portais vazio OU p_portal ∈ portais)
 *   E (empresas vazio OU p_empresa ∈ empresas)
 *   E (perfis vazio OU p_perfil ∈ perfis)
 *
 * O `perfil` aqui é o **p_perfil CRU do token** (ex.: "MASTER") — NÃO o
 * gestor/colaborador do login (esse só escolhe o agente). A `empresa` é o
 * cod_empresa da identidade. O operador (portal PO) ignora a lista de PORTAIS,
 * mas as de EMPRESA e PERFIL continuam valendo (empresa é escopo de dado).
 */
export function acessoFerramenta(
  regra: { portais?: string[] | null; empresas?: string[] | null; perfis?: string[] | null },
  ctx: { portal?: string; empresa?: string; perfil?: string; operador?: boolean },
): boolean {
  const portais = semBrancos(regra.portais);
  const empresas = semBrancos(regra.empresas);
  const perfis = semBrancos(regra.perfis);
  const portalOk = !!ctx.operador || portais.length === 0 || portais.some((p) => eqCI(p, ctx.portal));
  const empresaOk = empresas.length === 0 || empresas.some((e) => eqCI(e, ctx.empresa));
  const perfilOk = perfis.length === 0 || perfis.some((p) => eqCI(p, ctx.perfil));
  return portalOk && empresaOk && perfilOk;
}
