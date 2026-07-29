/**
 * Trava de agente por PERFIL (função pura, testável).
 *
 * Um agente com `requires_perfil` só é elegível quando o perfil resolvido no
 * login (identity-resolver) confere exatamente. `requires_perfil` nulo/vazio =
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
 * Acesso a uma FERRAMENTA por PORTAL e PERFIL — allowlists por (base, ferramenta).
 * Vazio = liberado (100%). Regra (#4):
 *   (operador OU portais vazio OU p_portal ∈ portais)  E  (perfis vazio OU p_perfil ∈ perfis)
 *
 * O `perfil` aqui é o **p_perfil CRU do token** (ex.: "MASTER") — NÃO o
 * gestor/colaborador do login (esse só escolhe o agente). O operador (portal PO)
 * ignora a lista de portais, mas a de perfil continua valendo.
 */
export function acessoFerramenta(
  regra: { portais?: string[] | null; perfis?: string[] | null },
  ctx: { portal?: string; perfil?: string; operador?: boolean },
): boolean {
  const portais = regra.portais ?? [];
  const perfis = regra.perfis ?? [];
  const portalOk = !!ctx.operador || portais.length === 0 || portais.some((p) => eqCI(p, ctx.portal));
  const perfilOk = perfis.length === 0 || perfis.some((p) => eqCI(p, ctx.perfil));
  return portalOk && perfilOk;
}
