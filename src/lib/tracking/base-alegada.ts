/**
 * A BASE QUE O TOKEN ALEGA SER — passo 1 da inversão, e nada além disso.
 *
 * ── Por que isto é um módulo próprio ───────────────────────────────────
 * A função nasceu privada em `resolve-base.ts` (área de gestão). Em 25/09 o
 * mesmo passo passou a ser necessário em `resolve.ts` (widget, portal e as
 * 18 chamadas de identidade do produto). Copiar seria criar duas leituras do
 * mesmo formato de token, que é a classe de defeito que `bloco-apex.ts`
 * existe para não repetir — lá foi o bloco PL/SQL vivendo em dois lugares e
 * divergindo em silêncio.
 *
 * Também não tem `server-only` de propósito: é PURO, sem I/O e sem segredo,
 * então o teste importa direto. Mesma razão de `escopo-da-base.ts`.
 *
 * ── O que este valor é, e o que ele NÃO é ──────────────────────────────
 * É uma ALEGAÇÃO. Serve unicamente para escolher COM QUAL CHAVE verificar.
 * Nada daqui pode chegar a uma consulta antes de
 * `decodificarRastreioDetalhado` confirmar a assinatura — e, depois de
 * confirmar, quem vale é o `p_base` do payload verificado, que o chamador
 * ainda precisa comparar com esta alegação.
 *
 * Ler o payload sem verificar não é brecha: o formato `kbt1h` é ASSINADO, não
 * cifrado, e o próprio bloco PL/SQL do APEX documenta que os valores são
 * legíveis no navegador. O que decide é a verificação do HMAC.
 */

/** Único formato em que a base é legível antes da chave (HMAC, payload aberto). */
export const PREFIXO_HMAC = "kbt1h.";

/**
 * Lê o `p_base` do payload de um token assinado SEM verificar a assinatura.
 *
 * Devolve `null` para qualquer coisa que não seja `kbt1h` com `p_base` não
 * vazio — inclusive para o formato opaco `kbt1.` (AES-GCM), em que a base só
 * aparece DEPOIS de ter a chave. Tentar chave por chave até uma decifrar
 * transformaria a validação num oráculo, então esse formato nunca passa por
 * aqui; ele segue pelo caminho legado.
 *
 * O valor sai normalizado (minúsculas, sem espaços nas pontas) porque
 * produção tem `INCOR`, `NATCORP` e `STEFANINI` gravados com caixa variada,
 * e a comparação com `ai_bases.base_code` é sempre normalizada.
 */
export function baseAlegada(token: string): string | null {
  if (!token.startsWith(PREFIXO_HMAC)) return null;
  const corpo = token.slice(PREFIXO_HMAC.length).split(".");
  if (corpo.length !== 2) return null;
  try {
    const json = Buffer.from(corpo[0]!, "base64url").toString("utf8");
    const obj = JSON.parse(json) as unknown;
    if (!obj || typeof obj !== "object") return null;
    const base = (obj as Record<string, unknown>).p_base;
    if (typeof base !== "string") return null;
    const limpo = base.trim().toLowerCase();
    return limpo === "" ? null : limpo;
  } catch {
    return null;
  }
}

/** Escapa os curingas do `ilike` — um `base_code` com `%` casaria demais. */
export function escaparIlike(v: string): string {
  return v.replace(/([\\%_])/g, "\\$1");
}
