/**
 * O widget aparece nesta base, neste painel?
 *
 * Três chaves independentes decidem, e cada uma responde a uma pergunta
 * diferente — por isso nenhuma substitui a outra:
 *
 *   `widget_keys.active`   o widget daquele PAINEL está no ar (vale para todos
 *                          os clientes)
 *   `ai_bases.active`      o cliente está ativo (desliga também as integrações)
 *   `widget_paineis`       ESTE cliente liberou ESTE painel
 *
 * O terceiro é o que faltava, e é o recorte que a operação usa de verdade: "a
 * empresa X ainda não liberou para os colaboradores, mas os gestores já usam".
 *
 * Puro e sem IO — quem lê o banco é a rota.
 */

export type PainelWidget = "PO" | "PG" | "PC";

const PAINEIS: PainelWidget[] = ["PO", "PG", "PC"];

export function ehPainel(v: unknown): v is PainelWidget {
  return typeof v === "string" && (PAINEIS as string[]).includes(v.trim().toUpperCase());
}

/** Normaliza o que veio do banco/formulário: maiúsculo, sem repetido, só painel válido. */
export function normalizarPaineis(v: unknown): PainelWidget[] | null {
  if (v == null) return null; // NULL = todos (comportamento de sempre)
  if (!Array.isArray(v)) return null;
  const set = new Set<PainelWidget>();
  for (const x of v) {
    const s = String(x ?? "").trim().toUpperCase();
    if (ehPainel(s)) set.add(s as PainelWidget);
  }
  return PAINEIS.filter((p) => set.has(p));
}

/**
 * Decide a exibição.
 *
 * Sem painel identificado (portal público, instalação sem rastreio) o widget
 * APARECE: a lista é um recorte por painel, e um turno sem painel não está em
 * painel nenhum. Bloquear ali derrubaria o widget do portal por causa de uma
 * configuração que não fala dele.
 */
export function widgetLiberado(
  paineis: unknown,
  painel: unknown,
  baseAtiva = true,
): boolean {
  if (!baseAtiva) return false;
  const lista = normalizarPaineis(paineis);
  if (lista === null) return true; // NULL = todos
  const p = String(painel ?? "").trim().toUpperCase();
  if (!ehPainel(p)) return true; // sem painel → fora do recorte
  return lista.includes(p as PainelWidget);
}
