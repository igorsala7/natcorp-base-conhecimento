/**
 * Restrição de acesso por ORIGEM (Referer) — regra pura, sem imports de
 * servidor (testável).
 *
 * Realidade do Referer entre sites: com a política padrão dos navegadores
 * (strict-origin-when-cross-origin), chega só a ORIGEM (`https://host/`),
 * sem caminho nem parâmetros. Por isso o critério confiável é a IGUALDADE DE
 * ORIGEM; quando o navegador enviar o caminho (política mais frouxa no site
 * de origem), o prefixo de caminho vira um reforço — nunca o critério único.
 */

/** Nome do cookie de liberação por origem (token = o mesmo HMAC da senha). */
export function originCookieName(spaceId: string): string {
  return `kb_or_${spaceId}`;
}

type UrlParte = { origin: string; path: string } | null;

function parseUrl(raw: string): UrlParte {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return { origin: u.origin.toLowerCase(), path: u.pathname.replace(/\/+$/, "") };
  } catch {
    return null;
  }
}

/**
 * O Referer autoriza o acesso?
 *
 * - `permitidas`: URLs configuradas no espaço (uma por linha na UI).
 * - `selfHosts`: hosts do próprio portal (site principal e custom_domain) —
 *   navegação interna sempre passa, senão o segundo clique bloquearia.
 */
export function origemPermitida(
  referer: string | null | undefined,
  permitidas: string[],
  selfHosts: string[] = [],
): boolean {
  if (!referer) return false;
  const ref = parseUrl(referer);
  if (!ref) return false;

  const refHost = ref.origin.replace(/^https?:\/\//, "");
  if (selfHosts.some((h) => h && refHost === h.toLowerCase())) return true;

  for (const raw of permitidas) {
    const alvo = parseUrl(raw);
    if (!alvo) continue;
    if (ref.origin !== alvo.origin) continue;
    // Origem casou. Se a config tem caminho E o referer trouxe caminho,
    // exige prefixo (parâmetros da URL variam — ver exemplo do APEX).
    if (alvo.path && ref.path) {
      if (ref.path === alvo.path || ref.path.startsWith(`${alvo.path}/`)) return true;
      // Caminho divergente: outra URL permitida ainda pode casar.
      continue;
    }
    // Config só com origem, OU referer veio sem caminho (política padrão
    // entre sites): a origem é o que dá para verificar — libera.
    return true;
  }
  return false;
}

/** O espaço tem restrição de origem ativa? (lista com ao menos 1 URL válida) */
export function temRestricaoDeOrigem(referrers: string[] | null | undefined): boolean {
  return !!referrers && referrers.some((r) => parseUrl(r) !== null);
}
