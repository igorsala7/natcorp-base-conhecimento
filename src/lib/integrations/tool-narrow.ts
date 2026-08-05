/**
 * TOP-K por relevância LEXICAL — segundo estágio do roteamento de ferramentas.
 *
 * O classificador de assunto (`analisarPedido`) já estreita para um MÓDULO, mas os
 * módulos gordos (ex.: "ADMINISTRAÇÃO DE PESSOAL" com 26 tools) ainda despejam
 * dezenas de schemas no modelo — mais tokens e mais distratores (pior escolha).
 * Aqui rankeamos as tools elegíveis pela sobreposição de termos com a pergunta e
 * ficamos com as `max` melhores — SEM chamar embedding (custo/latência zero).
 *
 * Assertividade acima de tudo: se NENHUMA tool casa lexicalmente (pergunta vaga
 * frente aos nomes/descrições), NÃO estreita — devolve todas, para nunca descartar
 * a ferramenta certa só para economizar token. Tools essenciais/forçadas ficam
 * sempre. Puro/sem I/O — testável isolado.
 */
export type ToolLite = { key: string; name: string; description: string; alwaysInclude: boolean };

const STOP = new Set([
  "que", "qual", "quais", "como", "quero", "preciso", "pode", "poderia", "meu", "meus", "minha", "minhas",
  "dos", "das", "por", "para", "com", "sao", "são", "the", "de", "da", "do", "em", "um", "uma", "os", "as",
  "e", "ou", "no", "na", "ao", "aos", "sobre", "meu", "seu", "sua", "esse", "essa", "isso", "estao", "estão",
]);

/** Termos significativos (sem acento, minúsculos, len ≥ 3, sem stopwords). */
function termos(s: string): string[] {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/**
 * Devolve o CONJUNTO de `key`s a manter. `≤ max` tools → mantém todas. Acima disso,
 * mantém as essenciais/forçadas + as `max` melhores por sobreposição de termos.
 * Sem sinal lexical algum → mantém todas (protege a assertividade).
 */
const MIN_SEM = 0.6; // piso ABSOLUTO de similaridade: abaixo disso, semanticamente fraco
const MARGEM_SEM = 0.08; // piso RELATIVO ao topo: corta a cauda longe da melhor tool
const ANTIFLOOD_N = 3; // nada passou o piso → top-N por sim (NUNCA despeja o módulo inteiro)

export function selecionarTopK(
  tools: ToolLite[],
  question: string,
  max: number,
  sempreIncluir?: Set<string>,
  sim?: Map<string, number> | null,
): Set<string> {
  const forcada = (t: ToolLite) => t.alwaysInclude || sempreIncluir?.has(t.key) === true;
  const qs = new Set(termos(question));

  // ── MODO SEMÂNTICO (há embedding do turno): PRECISÃO por similaridade ──────────
  // Mantém só as tools próximas da MELHOR (piso relativo) e acima de um mínimo real —
  // corta a cauda de ruído (o ~0.57 que fazia o modelo consultar a tool errada). Aplica
  // MESMO com poucas tools (o ganho de assertividade é justamente cortar as irrelevantes).
  // Resgate LEXICAL: termo exato no NOME (código/sigla que o embedding às vezes perde)
  // entra mesmo com sim menor. Anti-inundação: nada confiável → só o top-N por sim (o gate
  // de desambiguação pergunta), jamais o módulo inteiro.
  if (sim && sim.size) {
    const simDe = (t: ToolLite) => sim.get(t.key) ?? 0;
    const naoForcadas = tools.filter((t) => !forcada(t));
    const topSim = naoForcadas.reduce((m, t) => Math.max(m, simDe(t)), 0);
    if (topSim > 0) {
      const piso = Math.max(MIN_SEM, topSim - MARGEM_SEM);
      const lexForte = (t: ToolLite) => {
        for (const term of new Set(termos(t.name))) if (qs.has(term)) return true;
        return false;
      };
      let cand = naoForcadas
        .filter((t) => simDe(t) >= piso || lexForte(t))
        .sort((a, b) => simDe(b) - simDe(a));
      if (!cand.length) cand = naoForcadas.slice().sort((a, b) => simDe(b) - simDe(a)).slice(0, ANTIFLOOD_N);
      const keep = new Set<string>();
      for (const t of tools) if (forcada(t)) keep.add(t.key); // essenciais/forçadas: sempre
      for (const t of cand) { if (keep.size >= max) break; keep.add(t.key); }
      return keep;
    }
    // topSim == 0 (tools fora do catálogo semântico) → cai no modo lexical abaixo.
  }

  // ── MODO LEXICAL (fallback: sem embedding do turno ou sem sinal semântico) ─────
  if (tools.length <= max) return new Set(tools.map((t) => t.key));
  const score = (t: ToolLite): number => {
    let s = 0;
    for (const term of new Set(termos(t.name))) if (qs.has(term)) s += 3;
    for (const term of new Set(termos(t.key))) if (qs.has(term)) s += 2;
    for (const term of new Set(termos(t.description))) if (qs.has(term)) s += 1;
    return s;
  };
  const ranked = tools
    .map((t, i) => ({ t, s: forcada(t) ? Infinity : score(t), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i);
  // Nenhuma tool não-forçada casou → sem sinal para discriminar: mantém todas.
  if (ranked.every((r) => r.s === Infinity || r.s === 0)) return new Set(tools.map((t) => t.key));
  const keep = new Set<string>();
  for (const r of ranked) {
    if (r.s === Infinity) keep.add(r.t.key); // essenciais/forçadas: sempre
    else if (keep.size < max) keep.add(r.t.key);
  }
  return keep;
}
