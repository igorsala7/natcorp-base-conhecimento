/** Gera um slug URL-safe a partir de um título (sem acentos, minúsculo). */
export function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // remove acentos (marcas combinantes)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "sem-titulo"
  );
}

/**
 * Palavras que não podem virar slug de documentação: colidiriam com rotas
 * reais do produto (`/docs/api/...` bateria com a API se um dia ela morar sob
 * o mesmo prefixo) ou com caminhos que já significam outra coisa.
 */
const SLUGS_RESERVADAS = new Set(
  // Guardadas JÁ SLUGIFICADAS: a comparação acontece depois de normalizar, e
  // `_next`/`robots.txt` nunca chegariam nessa forma (viram `next`/`robots-txt`).
  // Sem isto a lista pareceria proteger e não protegeria nada.
  ["api", "admin", "docs", "auth", "_next", "sitemap.xml", "robots.txt", "favicon.ico"].map(
    slugify,
  ),
);

export type SlugCheck = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Normaliza e valida a slug de uma documentação.
 *
 * `emUso` deve conter TODAS as slugs já tomadas — inclusive as aposentadas do
 * histórico. Reaproveitar uma slug antiga faria os links compartilhados de uma
 * documentação apontarem para outra, o que é pior do que um 404: o leitor não
 * percebe que está no lugar errado.
 */
export function validarSlugEspaco(
  entrada: string,
  emUso: Iterable<string>,
  slugAtual?: string,
): SlugCheck {
  const bruta = (entrada ?? "").trim();
  if (!bruta) return { ok: false, error: "Informe o endereço." };

  const slug = slugify(bruta);
  if (slug === "sem-titulo") {
    return { ok: false, error: "Use letras ou números no endereço." };
  }
  if (slug.length < 2) return { ok: false, error: "O endereço é curto demais." };
  if (SLUGS_RESERVADAS.has(slug)) {
    return { ok: false, error: `"${slug}" é um endereço reservado do sistema.` };
  }
  // Manter a própria slug não é colisão.
  if (slugAtual && slug === slugAtual) return { ok: true, slug };

  for (const s of emUso) {
    if (s === slug) {
      return { ok: false, error: `O endereço "${slug}" já pertence a outra documentação.` };
    }
  }
  return { ok: true, slug };
}
