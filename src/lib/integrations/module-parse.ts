/**
 * Parsing PURO da resposta do endpoint de módulos do cliente (sem `server-only`,
 * para ser testável). O endpoint devolve:
 *   { items: [{ modulo, sub_modulo }], hasMore, limit, offset, links }
 * onde `sub_modulo` é uma lista separada por ';' de caminhos hierárquicos
 * ("A > B > C"), ou null quando é o módulo raiz.
 */

export type ModuloRow = { modulo: string; submodulo: string | null };

/** Normaliza o espaçamento do separador de caminho ("A>B" e "A  >  B" → "A > B"). */
function normPath(s: string): string {
  return s.trim().replace(/\s*>\s*/g, " > ").replace(/\s{2,}/g, " ");
}

/** Extrai as linhas (modulo, submodulo) de UMA página da resposta. */
export function parseModulosPayload(payload: unknown): ModuloRow[] {
  const items = (payload as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const out: ModuloRow[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const modulo = String(o.modulo ?? "").trim();
    if (!modulo) continue;
    const sub = o.sub_modulo;
    if (sub == null || String(sub).trim() === "") {
      out.push({ modulo, submodulo: null });
      continue;
    }
    for (const part of String(sub).split(";")) {
      const s = normPath(part);
      if (s) out.push({ modulo, submodulo: s });
    }
  }
  return out;
}

/** Deduplica por (modulo, submodulo) — o endpoint repete módulos entre items/páginas. */
export function dedupModulos(rows: ModuloRow[]): ModuloRow[] {
  const seen = new Set<string>();
  const out: ModuloRow[] = [];
  for (const r of rows) {
    const k = r.modulo.toLowerCase() + "||" + (r.submodulo?.toLowerCase() ?? "");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
