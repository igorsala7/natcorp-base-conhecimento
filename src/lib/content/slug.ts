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
