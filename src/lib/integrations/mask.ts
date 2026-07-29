/**
 * Formata uma data CANÔNICA (a IA sempre devolve ISO) na máscara que cada API
 * exige — e as APIs divergem: dd/MM/yyyy, MM/yyyy, dd/mm/rrrr (Oracle), etc.
 * Isolar a bagunça aqui mantém o prompt do modelo simples e uniforme.
 *
 * Tokens aceitos (case-insensitive): yyyy/rrrr (ano 4), yy/rr (ano 2),
 * mm (mês), dd (dia). Tudo que não for token fica literal — então uma máscara
 * "01/MM/yyyy" fixa o dia em 01.
 */

/** Aceita YYYY-MM-DD, YYYY-MM, YYYY e datetime ISO (usa só a data). */
export function parseCanonicalDate(v: string): { y: string; m: string; d: string } | null {
  const s = (v || "").trim();
  const m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(s);
  if (!m) return null;
  return {
    y: m[1]!,
    m: (m[2] ?? "1").padStart(2, "0"),
    d: (m[3] ?? "1").padStart(2, "0"),
  };
}

export function applyDateMask(value: string, mask: string): string {
  const parts = parseCanonicalDate(value);
  if (!parts) return value; // não parseou → devolve como veio (melhor que quebrar)
  const { y, m, d } = parts;
  // Ordem por comprimento (rrrr/yyyy antes de rr/yy) para não casar o token curto
  // dentro do longo.
  return mask.replace(/rrrr|yyyy|rr|yy|mm|dd/gi, (tok) => {
    const t = tok.toLowerCase();
    if (t === "rrrr" || t === "yyyy") return y;
    if (t === "rr" || t === "yy") return y.slice(-2);
    if (t === "mm") return m;
    return d; // dd
  });
}
