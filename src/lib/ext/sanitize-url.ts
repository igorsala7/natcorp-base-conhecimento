/**
 * Máscara de dados sensíveis em URLs capturadas (Fase 5.6).
 *
 * A extensão vê o produto do cliente e registra a URL de cada tela. Uma URL pode
 * carregar segredo na querystring (`?token=…`, `?senha=…`) ou credenciais no
 * userinfo (`https://user:pass@host`). Antes de guardar, removemos as credenciais
 * e redigimos os parâmetros de aparência sensível. Puro e testável.
 *
 * Não substitui o descarte humano (a revisão da 5.5): prints ainda podem conter
 * dados sensíveis na imagem — isso é responsabilidade da revisão.
 */
const CHAVE_SENSIVEL = /(pass|senha|secret|token|auth|api[_-]?key|access|session|bearer|otp|cpf|cnpj|cart(a|ã)o|card|cvv|pix)/i;

export function sanitizarUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    // Remove credenciais embutidas.
    u.username = "";
    u.password = "";
    // Redige parâmetros sensíveis (mantém a chave, some com o valor).
    for (const k of [...u.searchParams.keys()]) {
      if (CHAVE_SENSIVEL.test(k)) u.searchParams.set(k, "***");
    }
    return u.toString().slice(0, 500);
  } catch {
    // Não é URL absoluta — devolve aparada (sem parse de querystring possível).
    return s.slice(0, 500);
  }
}
