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
