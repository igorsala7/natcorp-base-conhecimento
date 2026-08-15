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
 *
 * DESEMPATE DE AMBIGUIDADE (`aplicarDesempate`): estreitar por relevância não basta
 * quando duas tools são quase sinônimas (`historico_financeiro` × `bi_historico_financeiro`
 * ficam a ~0.03 uma da outra). As duas passam no piso, chegam juntas ao modelo, e o
 * erro passa a ser DELE. Aqui a perdedora sai do turno — por regra PAREADA (explícita)
 * ou por PRIORIDADE dentro do grupo (numérica), e só quando ambas disputam o topo.
 */
export type ToolLite = {
  key: string;
  name: string;
  description: string;
  alwaysInclude: boolean;
  /** Sinônimos/exemplos de frase (`ai_tools.search_terms`) — vocabulário do usuário. */
  searchTerms?: string | null;
  /** Desempate numérico — só vale entre tools do MESMO `grupo`. 0 = neutro. */
  prioridade?: number;
  /** Rótulo que delimita onde a prioridade compete (ai_tools.grupo_ambiguidade). */
  grupo?: string | null;
};

/** Regra PAREADA: quando as duas disputam, a `perdedora` sai (ai_tool_priority_rules). */
export type RegraDesempate = { vencedora: string; perdedora: string; modo: "empate" | "sempre" };

/** O que foi cortado e por quê — vai para o trace, não some em silêncio. */
export type CorteDesempate = {
  perdedora: string;
  vencedora: string;
  via: "pareado" | "grupo";
  modo?: "empate" | "sempre";
};

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
 * A pergunta cita o NOME/CHAVE desta ferramenta? Conta os termos significativos em
 * comum. `minimo` controla a força: 1 basta para RESGATAR do corte semântico (onde o
 * embedding já opinou); no corte por MÓDULO exigimos 2, senão qualquer tool com
 * "pessoal" ou "requisição" no nome voltaria e o recorte perderia o sentido.
 */
export function forcaLexical(nome: string, chave: string, question: string, sinonimos?: string | null): number {
  const qs = new Set(termos(question));
  // `search_terms` entra aqui porque é EXATAMENTE o vocabulário do usuário. Sem ele,
  // "me traga o histórico de cargos e salário dela" não resgatava a Linha do Tempo:
  // o nome dela ("Linha do tempo do colaborador") não divide uma única palavra com a
  // pergunta, então a tool dependia só do vetor — e perdia para "Histórico financeiro".
  const alvo = new Set([...termos(nome), ...termos(chave), ...termos(sinonimos ?? "")]);
  let n = 0;
  for (const t of alvo) if (qs.has(t)) n++;
  return n;
}

/**
 * Devolve o CONJUNTO de `key`s a manter. `≤ max` tools → mantém todas. Acima disso,
 * mantém as essenciais/forçadas + as `max` melhores por sobreposição de termos.
 * Sem sinal lexical algum → mantém todas (protege a assertividade).
 */
const MIN_SEM = 0.6; // piso ABSOLUTO de similaridade: abaixo disso, semanticamente fraco
const MARGEM_SEM = 0.08; // piso RELATIVO ao topo: corta a cauda longe da melhor tool
const MIN_SEM_RELAX = 0.55; // modo COMPOSTO (multi-intenção): afrouxa para priorizar RECALL —
const MARGEM_SEM_RELAX = 0.16; // co-intenções ficam mais espalhadas; não corta as de menor sim.
const ANTIFLOOD_N = 3; // nada passou o piso → top-N por sim (NUNCA despeja o módulo inteiro)
/**
 * …mas só se o topo tiver ALGUMA relação com a pergunta.
 *
 * Medido em 15/08/2026: "Ocorreu um erro ao tentar processar as informações"
 * levou `estrutura_empresas` (0.56), `lista_opcoes` (0.55) e `estrutura_filiais`
 * (0.55). Nenhuma tem o que responder ali — a frase não é sobre empresa, filial
 * nem lista de opções. O piso adaptativo baixou junto com o `topSim`, o antiflood
 * completou com o top-3, e três ferramentas irrelevantes foram ao modelo.
 *
 * Abaixo deste valor a resposta certa é NENHUMA ferramenta: a pergunta se resolve
 * pela documentação. Enviar as três menos ruins custa token e, pior, convida o
 * modelo a chamar uma delas para "tentar".
 */
const MIN_ANTIFLOOD = 0.58;
/**
 * FAIXA DE DISPUTA do desempate: só desempata quem está a ≤ 0.05 do topo da rodada.
 * Duas tools dentro da faixa estão, por construção, a ≤ 0.05 uma da outra — é a
 * definição operacional de "ambíguas AGORA". Fora da faixa, a semântica já decidiu
 * e o desempate se cala: é o que impede `historico_financeiro` de derrubar o BI
 * numa pergunta agregada, onde nenhuma das duas é a melhor da vez.
 */
const FAIXA_DISPUTA = 0.05;

/**
 * PISO ADAPTATIVO — o `MIN_SEM` deixa de ser piso e vira TETO do piso.
 *
 * Por que: o 0.60 foi calibrado com o catálogo cheio. Quando as ferramentas que
 * ancoravam o topo saem do ar (desativadas, sem embedding, cortadas por escopo), o
 * `topSim` do turno despenca, o piso absoluto passa a mandar sozinho e NADA passa —
 * aí o anti-inundação entrega as 3 melhores por similaridade, que podem estar em
 * 0.5x, como se fossem certas. Foi exatamente o que aconteceu quando 36% do catálogo
 * foi desativado: "quantos colaboradores ativos" deixou de casar 0.75 e passou a
 * receber a ferramenta genérica de cadastro.
 *
 * O piso multiplicativo é SEMPRE mais apertado que o aditivo para `topSim < 1`
 * (`topSim·0.92 > topSim − 0.08`), então a banda ENCOLHE proporcionalmente quando
 * tudo é fraco — o oposto de "passa tudo". Turno saudável não muda em nada:
 * topSim 0.75 → 0.67 antes e depois.
 */
const PISO_FATOR = 0.92;
/** Afrouxou o piso? Então limite a QUANTIDADE — banda maior não pode virar enxurrada. */
const MAX_FRACO = 4;

export function pisoAdaptativo(
  topSim: number,
  absoluto: number,
  margem: number,
): { piso: number; adaptativo: boolean } {
  if (process.env.TOOL_PISO_ADAPTATIVO === "0") {
    return { piso: Math.max(absoluto, topSim - margem), adaptativo: false };
  }
  const pisoAbs = Math.min(absoluto, topSim * PISO_FATOR);
  return { piso: Math.max(pisoAbs, topSim - margem), adaptativo: pisoAbs < absoluto };
}

/** Diagnóstico da seleção semântica — alimenta o trace e a diretriz de baixa confiança. */
export type InfoSelecao = {
  topSim: number;
  piso: number;
  adaptativo: boolean;
  /** Nem a melhor ferramenta do turno chegou ao piso absoluto: o assunto pode não ter dono. */
  fraco: boolean;
  keys: string[];
};

// ── Seleção MULTI-FACETA (pergunta com várias intenções) ─────────────────────
const POR_FACETA = 3; // quantas ferramentas cada faceta garante para si
const MIN_SEM_FACETA = 0.45; // piso ABSOLUTO frouxo: a faceta fraca também merece ferramenta
const MARGEM_FACETA = 0.08; // piso RELATIVO ao topo DAQUELA faceta

/**
 * Escolhe as ferramentas de uma pergunta MULTI-INTENÇÃO: em vez de um ranking único
 * (onde a intenção diluída desaparece), cada faceta traz as suas melhores e a união
 * vai ao modelo.
 *
 * O piso é relativo À FACETA, não ao turno — é isso que salva a intenção fraca. No caso
 * que motivou o recurso, "valor de horas normais de março de 2025" tem topo 0.590,
 * abaixo até do piso absoluto normal (0.60): num ranking global ela nunca sobreviveria,
 * dentro da própria faceta ela é a primeira colocada.
 *
 * A união sai em RODÍZIO (a 1ª de cada faceta, depois a 2ª de cada…): quando o teto
 * corta, ele corta a segunda escolha de alguém — nunca a única de uma faceta inteira.
 */
export function selecionarPorFaceta(
  candidatas: ToolLite[],
  sims: Map<string, number>[],
  porFaceta = POR_FACETA,
): ToolLite[] {
  const rodadas: ToolLite[][] = [];
  for (const sim of sims) {
    if (!sim?.size) continue;
    const simDe = (t: ToolLite) => sim.get(t.key) ?? 0;
    const topo = candidatas.reduce((m, t) => Math.max(m, simDe(t)), 0);
    if (topo <= 0) continue;
    // Mesmo piso adaptativo do caminho simples: a erosão do catálogo derruba a
    // faceta fraca do mesmo jeito, e uma faceta sem candidata é um assunto perdido.
    const { piso } = pisoAdaptativo(topo, MIN_SEM_FACETA, MARGEM_FACETA);
    rodadas.push(
      candidatas
        .filter((t) => simDe(t) >= piso)
        .sort((a, b) => simDe(b) - simDe(a))
        .slice(0, porFaceta),
    );
  }
  const vistas = new Set<string>();
  const out: ToolLite[] = [];
  for (let i = 0; i < porFaceta; i++) {
    for (const r of rodadas) {
      const t = r[i];
      if (!t || vistas.has(t.key)) continue;
      vistas.add(t.key);
      out.push(t);
    }
  }
  return out;
}

/**
 * Aplica os dois níveis de desempate sobre as candidatas, do mais específico ao
 * mais geral — o PAREADO vence o numérico (é declaração explícita, não heurística).
 *
 * Todas as regras são avaliadas contra o conjunto ORIGINAL, numa passada só — o
 * resultado não depende da ordem de leitura. Numa cadeia A>B>C com os três no turno
 * sobra o A (B e C perdem para alguém que está presente); some B do turno e a regra
 * B>C não dispara, porque regra sem vencedora presente não corta ninguém.
 *
 * `imune` (essencial/forçada pela rota) nunca é cortada: quem a rota mandou incluir
 * entra, ponto. E se a configuração for degenerada a ponto de esvaziar o turno
 * (ciclo indireto A>B>C>A, que o trigger de ciclo direto não pega), os cortes são
 * DESCARTADOS: turno sem ferramenta é pior que ambiguidade.
 */
export function aplicarDesempate(
  candidatas: ToolLite[],
  simDe: ((t: ToolLite) => number) | null,
  regras: RegraDesempate[] | undefined,
  imune: (t: ToolLite) => boolean,
): { manter: ToolLite[]; cortes: CorteDesempate[] } {
  if (!candidatas.length) return { manter: candidatas, cortes: [] };
  const presentes = new Map(candidatas.map((t) => [t.key, t]));
  const cortes = new Map<string, CorteDesempate>();
  const derruba = (c: CorteDesempate) => {
    const alvo = presentes.get(c.perdedora);
    if (!alvo || imune(alvo) || cortes.has(c.perdedora)) return;
    cortes.set(c.perdedora, c);
  };

  // "Disputando o topo": sem similaridade (modo lexical) não dá para medir empate,
  // então só as regras `sempre` valem — as heurísticas ficam de fora.
  const topo = simDe ? candidatas.reduce((m, t) => Math.max(m, simDe(t)), 0) : 0;
  const naDisputa = (t: ToolLite) => !!simDe && simDe(t) >= topo - FAIXA_DISPUTA;

  // ── Nível 1: PAREADO ────────────────────────────────────────────────────────
  for (const r of regras ?? []) {
    const v = presentes.get(r.vencedora);
    const p = presentes.get(r.perdedora);
    if (!v || !p) continue; // a regra só existe quando as DUAS estão no turno
    if (r.modo === "empate" && !(naDisputa(v) && naDisputa(p))) continue;
    derruba({ perdedora: p.key, vencedora: v.key, via: "pareado", modo: r.modo });
  }

  // ── Nível 2: NUMÉRICO, dentro do grupo e só na faixa de disputa ─────────────
  // Roda sobre o que SOBROU do pareado: sem isto, um par apontando para lados
  // opostos (regra diz A, prioridade diz B) derrubaria as duas e o turno ficaria
  // sem ferramenta nenhuma. Declaração explícita manda; o número é a rede.
  if (simDe) {
    const grupos = new Map<string, ToolLite[]>();
    for (const t of candidatas) {
      const g = t.grupo?.trim();
      if (!g || !naDisputa(t) || cortes.has(t.key)) continue;
      const arr = grupos.get(g) ?? [];
      arr.push(t);
      grupos.set(g, arr);
    }
    for (const membros of grupos.values()) {
      if (membros.length < 2) continue;
      const melhor = membros.reduce((a, b) => ((b.prioridade ?? 0) > (a.prioridade ?? 0) ? b : a));
      for (const t of membros) {
        if (t.key === melhor.key) continue;
        if ((t.prioridade ?? 0) >= (melhor.prioridade ?? 0)) continue; // empate de prioridade: ninguém cai
        derruba({ perdedora: t.key, vencedora: melhor.key, via: "grupo" });
      }
    }
  }

  if (!cortes.size) return { manter: candidatas, cortes: [] };
  const manter = candidatas.filter((t) => !cortes.has(t.key));
  if (!manter.length) return { manter: candidatas, cortes: [] }; // configuração degenerada
  return { manter, cortes: [...cortes.values()] };
}

/** Teto de dependências puxadas por turno — evita que uma descrição citando meia
 *  dúzia de ferramentas de apoio infle o turno inteiro. */
const MAX_DEPENDENCIAS = 6;

/**
 * Ferramentas que as SELECIONADAS declaram precisar. Várias descrições do catálogo
 * dizem, em letras maiúsculas, "DEPENDÊNCIA OBRIGATÓRIA: chame `linha_tempo_fato`
 * ANTES" — mas o top-K escolhia uma sem a outra, e o modelo recebia a ferramenta sem
 * a chave dela (com a descrição proibindo, com razão, inventar o parâmetro).
 *
 * A dependência é lida da própria descrição (a chave da outra ferramenta citada) —
 * nada a cadastrar, e vale para qualquer descrição futura que siga a convenção.
 * UM nível só, sem cascata: dependência de dependência sinaliza catálogo mal
 * modelado, não algo a resolver puxando meio catálogo.
 */
export function dependenciasCitadas(
  selecionadas: ToolLite[],
  todas: ToolLite[],
  max = MAX_DEPENDENCIAS,
): { key: string; porCausaDe: string }[] {
  const jaTem = new Set(selecionadas.map((t) => t.key));
  const out: { key: string; porCausaDe: string }[] = [];
  const vistas = new Set<string>();
  for (const t of selecionadas) {
    const desc = t.description ?? "";
    if (!desc) continue;
    for (const alvo of todas) {
      if (alvo.key === t.key || jaTem.has(alvo.key) || vistas.has(alvo.key)) continue;
      // `\b` não quebra dentro de snake_case (o "_" é caractere de palavra): a busca por
      // `historico_financeiro` NÃO casa dentro de `historico_financeiro_meses`.
      if (!new RegExp(`\\b${alvo.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(desc)) continue;
      vistas.add(alvo.key);
      out.push({ key: alvo.key, porCausaDe: t.key });
      if (out.length >= max) return out;
    }
  }
  return out;
}

export function selecionarTopK(
  tools: ToolLite[],
  question: string,
  max: number,
  sempreIncluir?: Set<string>,
  sim?: Map<string, number> | null,
  /** COMPOSTO (multi-intenção): afrouxa piso/margem p/ não cortar co-intenções. */
  relax = false,
  /** Desempate de ambiguidade: regras pareadas + callback para o trace.
   *  `onSelecao` reporta a QUALIDADE da seleção — sem isso o modelo recebia
   *  ferramentas a 0.5x sem nenhum sinal de que eram fracas. */
  desempate?: {
    regras?: RegraDesempate[];
    onCorte?: (cortes: CorteDesempate[]) => void;
    onSelecao?: (info: InfoSelecao) => void;
  },
  /**
   * MULTI-FACETA: um Map de similaridade POR INTENÇÃO da pergunta (ver facets.ts).
   * Com 2+ facetas, cada uma garante as suas melhores e as essenciais deixam de
   * consumir a cota — numa pergunta de 7 intenções elas comiam 5 das 12 vagas.
   */
  simFacetas?: Map<string, number>[] | null,
): Set<string> {
  const forcada = (t: ToolLite) => t.alwaysInclude || sempreIncluir?.has(t.key) === true;
  const qs = new Set(termos(question));
  /** Roda o desempate sobre as candidatas e avisa o trace. */
  const desempatar = (cand: ToolLite[], simDe: ((t: ToolLite) => number) | null): ToolLite[] => {
    const { manter, cortes } = aplicarDesempate(cand, simDe, desempate?.regras, forcada);
    if (cortes.length) desempate?.onCorte?.(cortes);
    return manter;
  };

  // ── MODO SEMÂNTICO (há embedding do turno): PRECISÃO por similaridade ──────────
  // Mantém só as tools próximas da MELHOR (piso relativo) e acima de um mínimo real —
  // corta a cauda de ruído (o ~0.57 que fazia o modelo consultar a tool errada). Aplica
  // MESMO com poucas tools (o ganho de assertividade é justamente cortar as irrelevantes).
  // Resgate LEXICAL: termo exato no NOME (código/sigla que o embedding às vezes perde)
  // entra mesmo com sim menor. Anti-inundação: nada confiável → só o top-N por sim (o gate
  // de desambiguação pergunta), jamais o módulo inteiro.
  // ── MODO MULTI-FACETA: cada intenção da pergunta traz as suas ─────────────────
  // Vem ANTES do modo semântico de ranking único, que é justamente o que dilui a
  // intenção secundária. Essenciais entram FORA da cota: numa pergunta de 7 intenções
  // as 5 essenciais comiam quase metade das vagas antes de qualquer intenção ser
  // atendida. (Só aqui — na pergunta simples o teto continua valendo para todas.)
  const facetasUteis = (simFacetas ?? []).filter((m) => m?.size);
  if (facetasUteis.length > 1) {
    const naoForcadas = tools.filter((t) => !forcada(t));
    const cand = desempatar(selecionarPorFaceta(naoForcadas, facetasUteis), sim?.size ? (t) => sim.get(t.key) ?? 0 : null);
    if (cand.length) {
      const keep = new Set<string>();
      for (const t of tools) if (forcada(t)) keep.add(t.key);
      for (const t of cand.slice(0, max)) keep.add(t.key);
      return keep;
    }
    // Nenhuma faceta produziu candidata → segue no caminho normal abaixo.
  }

  if (sim && sim.size) {
    const simDe = (t: ToolLite) => sim.get(t.key) ?? 0;
    const naoForcadas = tools.filter((t) => !forcada(t));
    const topSim = naoForcadas.reduce((m, t) => Math.max(m, simDe(t)), 0);
    if (topSim > 0) {
      const absoluto = relax ? MIN_SEM_RELAX : MIN_SEM;
      const { piso, adaptativo } = pisoAdaptativo(topSim, absoluto, relax ? MARGEM_SEM_RELAX : MARGEM_SEM);
      const lexForte = (t: ToolLite) => forcaLexical(t.name, "", question, t.searchTerms) >= 1;
      let cand = naoForcadas
        .filter((t) => simDe(t) >= piso || lexForte(t))
        .sort((a, b) => simDe(b) - simDe(a));
      // Piso afrouxado = turno fraco: mais banda, porém quantidade travada.
      if (adaptativo) cand = cand.slice(0, MAX_FRACO);
      if (!cand.length) {
        const ordenadas = naoForcadas.slice().sort((a, b) => simDe(b) - simDe(a));
        // Topo fraco demais → nenhuma. Ver MIN_ANTIFLOOD.
        const topo = ordenadas[0];
        cand = topo && simDe(topo) >= MIN_ANTIFLOOD ? ordenadas.slice(0, ANTIFLOOD_N) : [];
      }
      // DESEMPATE antes do teto: a vaga que a perdedora libera vai para a próxima
      // melhor, em vez de virar espaço morto.
      cand = desempatar(cand, simDe);
      const keep = new Set<string>();
      for (const t of tools) if (forcada(t)) keep.add(t.key); // essenciais/forçadas: sempre
      // As forçadas NÃO consomem a cota — mesma regra do caminho multi-faceta. Elas
      // são 5 e entram com similaridade de ruído (0.46–0.62); dentro do teto de 12
      // sobravam 7 vagas para o que a pergunta realmente pede.
      let n = 0;
      for (const t of cand) { if (n >= max) break; keep.add(t.key); n++; }
      desempate?.onSelecao?.({ topSim, piso, adaptativo, fraco: topSim < absoluto, keys: [...keep] });
      return keep;
    }
    // topSim == 0 (tools fora do catálogo semântico) → cai no modo lexical abaixo.
  }

  // ── MODO LEXICAL (fallback: sem embedding do turno ou sem sinal semântico) ─────
  // Sem similaridade não há como medir empate, então aqui só valem as regras
  // pareadas `sempre` (a perdedora é redundante quando a vencedora está no turno).
  const elegiveis = desempatar(tools, null);
  if (elegiveis.length <= max) return new Set(elegiveis.map((t) => t.key));
  const score = (t: ToolLite): number => {
    let s = 0;
    for (const term of new Set(termos(t.name))) if (qs.has(term)) s += 3;
    for (const term of new Set(termos(t.key))) if (qs.has(term)) s += 2;
    for (const term of new Set(termos(t.description))) if (qs.has(term)) s += 1;
    return s;
  };
  const ranked = elegiveis
    .map((t, i) => ({ t, s: forcada(t) ? Infinity : score(t), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i);
  // Nenhuma tool não-forçada casou → sem sinal para discriminar: mantém todas.
  if (ranked.every((r) => r.s === Infinity || r.s === 0)) return new Set(elegiveis.map((t) => t.key));
  const keep = new Set<string>();
  for (const r of ranked) {
    if (r.s === Infinity) keep.add(r.t.key); // essenciais/forçadas: sempre
    else if (keep.size < max) keep.add(r.t.key);
  }
  return keep;
}
