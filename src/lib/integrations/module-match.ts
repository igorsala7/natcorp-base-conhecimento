/**
 * Lógica PURA da seleção de tools por assunto (Opção A) — sem `server-only` nem
 * dependências de IA/DB, para ser testável e reutilizável no cliente/servidor.
 * A chamada ao modelo (classificador) fica em `module-select.ts`.
 */

export type ModuleTag = { modulo: string; submodulo: string | null };

const norm = (s: string | null | undefined) =>
  String(s ?? "").normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");

/** Um caminho de submódulo é igual, ancestral OU descendente do outro? `null`
 *  de qualquer lado = "o módulo inteiro" → sempre casa. */
function pathRelacionado(a: string | null, b: string | null): boolean {
  if (a == null || b == null) return true;
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  return na.startsWith(nb + " > ") || nb.startsWith(na + " > ");
}

/** A tool (com suas tags de módulo) cai em algum item selecionado? */
export function toolNoRecorte(tags: ModuleTag[], selecionados: ModuleTag[]): boolean {
  for (const sel of selecionados) {
    for (const tag of tags) {
      if (norm(tag.modulo) !== norm(sel.modulo)) continue;
      if (pathRelacionado(tag.submodulo, sel.submodulo)) return true;
    }
  }
  return false;
}

/** Vocabulário compacto: submódulos agrupados por módulo (entra no prompt). */
export function vocabularioDeModulos(tags: ModuleTag[]): { modulo: string; submodulos: string[] }[] {
  const map = new Map<string, { modulo: string; subs: Set<string> }>();
  for (const t of tags) {
    if (!t.modulo?.trim()) continue;
    const k = norm(t.modulo);
    let e = map.get(k);
    if (!e) { e = { modulo: t.modulo.trim(), subs: new Set() }; map.set(k, e); }
    if (t.submodulo?.trim()) e.subs.add(t.submodulo.trim());
  }
  return [...map.values()]
    .map((e) => ({ modulo: e.modulo, submodulos: [...e.subs].sort() }))
    .sort((a, b) => a.modulo.localeCompare(b.modulo));
}

/** Valida o retorno do modelo contra o vocab: descarta módulo inexistente e
 *  rebaixa submódulo desconhecido para "módulo inteiro" (widening seguro). */
export function filtrarContraVocab(sel: ModuleTag[], tags: ModuleTag[]): ModuleTag[] {
  const modulos = new Set(tags.map((t) => norm(t.modulo)));
  const subs = new Set(tags.filter((t) => t.submodulo).map((t) => norm(t.modulo) + "||" + norm(t.submodulo)));
  const vistos = new Set<string>();
  const out: ModuleTag[] = [];
  for (const s of sel) {
    const nm = norm(s.modulo);
    if (!modulos.has(nm)) continue; // módulo alucinado → fora
    const sub = s.submodulo && subs.has(nm + "||" + norm(s.submodulo)) ? s.submodulo : null;
    const chave = nm + "||" + (sub ? norm(sub) : "");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({ modulo: s.modulo, submodulo: sub });
  }
  return out;
}

/** Heurística: a mensagem tem MAIS DE UM assunto/pergunta? (2+ "?" ou conectivo de
 *  adição). Rede do recorte: numa pergunta COMPOSTA o classificador tende a pegar só o
 *  1º tópico — se vier ≤ 1 módulo, é mais seguro carregar todas as ferramentas. */
export function pareceComposta(p: string): boolean {
  const t = (p ?? "").trim();
  if (!t) return false;
  if ((t.match(/\?/g) ?? []).length >= 2) return true;
  return /\b(além disso|e também|e quais|e quantos|e qual são|e os últimos|e o histórico)\b/i.test(t);
}
