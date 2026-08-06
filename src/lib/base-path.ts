/**
 * Prefixo de caminho quando o app NÃO está na raiz do domínio.
 *
 * Em produção a Natcorp serve em `https://www.natcorpbr.com.br/natcorp/ia`, atrás
 * de um nginx. O `basePath` do Next (next.config.ts) já resolve `<Link>`, rotas e
 * assets estáticos — mas NÃO toca em `fetch("/api/…")` escrito à mão no cliente:
 * essas chamadas continuariam indo para a raiz do domínio e tomando 404.
 *
 * Por isso todo fetch de cliente para uma rota própria passa por `comBase()`.
 *
 * Vazio = app na raiz (é o caso em desenvolvimento), e aí `comBase` é identidade.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

/** Prefixa um caminho absoluto do app (`/api/x` → `/natcorp/ia/api/x`). */
export function comBase(caminho: string): string {
  if (!BASE_PATH) return caminho;
  return caminho.startsWith("/") ? `${BASE_PATH}${caminho}` : `${BASE_PATH}/${caminho}`;
}
