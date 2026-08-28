/**
 * Cálculo do faturamento a partir das linhas de `faturamento_detalhe`.
 *
 * Puro (sem IO, sem `server-only`): o painel e os testes usam o mesmo código,
 * então o número da tela e o número da fatura não podem divergir.
 *
 * ── As duas contagens ───────────────────────────────────────────────────
 * `tokensBrutos`     — entrada + saída, como o provedor reporta.
 * `tokensPonderados` — a fatia de cache convertida pelo multiplicador do
 *                      provedor (leitura ≈0,10× e escrita ≈1,25× na Anthropic).
 *
 * As duas são CONTAGEM DE TOKENS, não dinheiro. A ponderada existe porque a
 * tarifa plana de US$/milhão pressupõe que todo token custa igual — e um token
 * lido do cache custa um décimo. Qual das duas vira fatura é decisão comercial
 * (`billing_settings.base_cobranca`), não técnica, e as duas ficam visíveis
 * lado a lado para a escolha ser informada.
 *
 * ── Por que o cache equivalente é derivado, e não recalculado ───────────
 * `cacheEquivalente = ponderados − entradaNova − saída`.
 *
 * O caminho óbvio seria `cache_read × mult + cache_write × mult`, mas o
 * multiplicador é POR MODELO: somando linhas de modelos diferentes não existe
 * um multiplicador único para aplicar, e usar o de qualquer uma delas erraria o
 * total. A subtração acima é exata em qualquer nível de agregação, porque cada
 * linha já veio ponderada com o multiplicador certo do banco.
 */

/** Uma linha de `faturamento_detalhe`. */
export type LinhaFaturamento = {
  cliente: string;
  origem: string;
  kind: string;
  provider: string;
  model: string;
  purpose: string;
  chamadas: number;
  entrada_total: number;
  entrada_nova: number;
  cache_read: number;
  cache_write: number;
  saida: number;
  tokens_brutos: number;
  tokens_ponderados: number;
  cache_read_mult: number | null;
  cache_write_mult: number | null;
  preco_confirmado: boolean;
  custo_usd: number | null;
};

export type BaseCobranca = "bruto" | "ponderado";

export type Totais = {
  chamadas: number;
  entradaTotal: number;
  entradaNova: number;
  cacheLido: number;
  cacheEscrito: number;
  cacheTotal: number;
  /** Quanto do cache o provedor realmente cobra, em tokens de preço cheio. */
  cacheEquivalente: number;
  saida: number;
  tokensBrutos: number;
  tokensPonderados: number;
  /** Tokens que a ponderação do cache poupou (bruto − ponderado). */
  economia: number;
  /** Custo real conhecido. `null` quando algum modelo do grupo não tem preço. */
  custoUsd: number | null;
  /** Há linha sem preço cadastrado neste grupo? */
  temPrecoAusente: boolean;
};

const ZERO: Totais = {
  chamadas: 0,
  entradaTotal: 0,
  entradaNova: 0,
  cacheLido: 0,
  cacheEscrito: 0,
  cacheTotal: 0,
  cacheEquivalente: 0,
  saida: 0,
  tokensBrutos: 0,
  tokensPonderados: 0,
  economia: 0,
  custoUsd: null,
  temPrecoAusente: false,
};

const n = (v: unknown): number => {
  const x = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(x) ? x : 0;
};

/** Soma um conjunto de linhas. */
export function somar(linhas: LinhaFaturamento[]): Totais {
  if (!linhas.length) return { ...ZERO };
  const t = { ...ZERO };
  let custo = 0;
  let algumCusto = false;
  for (const l of linhas) {
    t.chamadas += n(l.chamadas);
    t.entradaTotal += n(l.entrada_total);
    t.entradaNova += n(l.entrada_nova);
    t.cacheLido += n(l.cache_read);
    t.cacheEscrito += n(l.cache_write);
    t.saida += n(l.saida);
    t.tokensBrutos += n(l.tokens_brutos);
    t.tokensPonderados += n(l.tokens_ponderados);
    if (l.preco_confirmado && l.custo_usd != null) {
      custo += n(l.custo_usd);
      algumCusto = true;
    } else {
      t.temPrecoAusente = true;
    }
  }
  t.cacheTotal = t.cacheLido + t.cacheEscrito;
  // Derivado, não recalculado — ver o cabeçalho. `max(…, 0)` porque a RPC
  // arredonda o ponderado para inteiro e um grupo minúsculo poderia ficar
  // alguns tokens abaixo da soma das partes.
  t.cacheEquivalente = Math.max(t.tokensPonderados - t.entradaNova - t.saida, 0);
  t.economia = Math.max(t.tokensBrutos - t.tokensPonderados, 0);
  // Custo parcial é pior que custo ausente: some com "US$ 0,47" numa tela onde
  // metade dos modelos não tem preço e alguém lê isso como o custo do mês.
  t.custoUsd = t.temPrecoAusente ? null : algumCusto ? custo : null;
  return t;
}

/**
 * Fração do cache que o provedor realmente cobra (0–1+).
 *
 * Pode passar de 1: a ESCRITA de cache custa 1,25× na Anthropic, então um turno
 * que grava muito e lê pouco fica acima de 100% — é caro, não é um bug. É
 * justamente o sinal de que o prefixo está sendo invalidado toda hora.
 */
export function fracaoCacheCobrada(t: Totais): number | null {
  if (t.cacheTotal <= 0) return null;
  return t.cacheEquivalente / t.cacheTotal;
}

/** Fração da entrada que veio do cache (lido + escrito). */
export function fracaoEntradaEmCache(t: Totais): number | null {
  if (t.entradaTotal <= 0) return null;
  return t.cacheTotal / t.entradaTotal;
}

/**
 * Tokens que vão para a fatura.
 *
 * `cobrarOverhead = false` tira o consumo que o SISTEMA disparou dentro do
 * turno (reescrita de consulta, classificador, embeddings) — medido em ~1,5%.
 * O usuário não pediu essas chamadas; se elas entram na conta dele é decisão
 * comercial, e por isso é configuração e não regra fixa.
 */
export function tokensCobrados(
  linhas: LinhaFaturamento[],
  base: BaseCobranca,
  cobrarOverhead = true,
): number {
  const alvo = cobrarOverhead ? linhas : linhas.filter((l) => l.kind !== "system");
  const t = somar(alvo);
  return base === "ponderado" ? t.tokensPonderados : t.tokensBrutos;
}

/** Valor em dólar de uma contagem de tokens, na tarifa plana por milhão. */
export function valorUsd(tokens: number, usdPorMtok: number): number {
  return (tokens / 1_000_000) * usdPorMtok;
}

/**
 * QUANTO CUSTA, DE FATO, UM MILHÃO DE TOKENS.
 *
 * O contrário de `usdPorMtok`, que é a tarifa que se COBRA. Este é o preço que
 * se PAGA, e ele não é escolhido: cai do mix de modelos, da razão entre entrada
 * e saída e do quanto o cache pegou no período.
 *
 * Por que a tela precisava disto: ela já mostrava o custo total em dólar e a
 * margem, mas custo total sobe quando se usa mais — e não diz se o sistema
 * ficou mais caro ou apenas mais movimentado. O custo POR MILHÃO separa as duas
 * coisas, e é comparável entre clientes de tamanhos diferentes.
 *
 * Medido em 28/08 sobre 14 dias: US$ 1,61/Mtok na base bruta contra os US$ 5,00
 * cobrados — e US$ 2,92 na origem `sistema` contra US$ 0,88 no `widget`, que é
 * o tipo de diferença que o total em dólar escondia.
 *
 * `null` quando algum modelo do grupo não tem preço confirmado: o custo daquele
 * grupo é DESCONHECIDO, não zero. Dividir um custo parcial pelo total de tokens
 * produziria um número menor que a verdade, e com cara de exato — a mesma
 * armadilha de somar imensurável ao denominador.
 */
export function custoPorMilhao(t: Totais, base: BaseCobranca): number | null {
  if (t.custoUsd == null) return null;
  const tokens = base === "ponderado" ? t.tokensPonderados : t.tokensBrutos;
  if (tokens <= 0) return null;
  return t.custoUsd / (tokens / 1_000_000);
}

/**
 * Margem por milhão de tokens: o que se cobra menos o que se paga.
 *
 * `null` pelo mesmo motivo acima — sem preço confirmado não há margem a
 * afirmar, e mostrar a tarifa cheia como se fosse margem seria pior que
 * mostrar nada.
 */
export function margemPorMilhao(
  t: Totais,
  base: BaseCobranca,
  usdPorMtok: number,
): number | null {
  const custo = custoPorMilhao(t, base);
  return custo == null ? null : usdPorMtok - custo;
}

/** Um grupo do totalizador: a chave, as linhas e a soma. */
export type Grupo = { chave: string; linhas: LinhaFaturamento[]; totais: Totais };

/**
 * Agrupa e soma, do maior para o menor. Serve aos quatro totalizadores da tela
 * (cliente, provedor, modelo, ação) a partir das MESMAS linhas — é o que
 * garante que os subtotais fechem com o total geral.
 */
export function agrupar(
  linhas: LinhaFaturamento[],
  chave: (l: LinhaFaturamento) => string,
  base: BaseCobranca = "bruto",
): Grupo[] {
  const mapa = new Map<string, LinhaFaturamento[]>();
  for (const l of linhas) {
    const k = chave(l) || "—";
    const atual = mapa.get(k);
    if (atual) atual.push(l);
    else mapa.set(k, [l]);
  }
  return [...mapa.entries()]
    .map(([k, ls]) => ({ chave: k, linhas: ls, totais: somar(ls) }))
    .sort((a, b) =>
      base === "ponderado"
        ? b.totais.tokensPonderados - a.totais.tokensPonderados
        : b.totais.tokensBrutos - a.totais.tokensBrutos,
    );
}

export type PrecoAusente = { provider: string; model: string };

/**
 * Modelos do período sem preço confirmado. A tela os nomeia em vez de exibir
 * custo zero — um zero silencioso na coluna de custo vira margem imaginária.
 */
export function precosAusentes(linhas: LinhaFaturamento[]): PrecoAusente[] {
  const vistos = new Set<string>();
  const out: PrecoAusente[] = [];
  for (const l of linhas) {
    if (l.preco_confirmado) continue;
    const k = `${l.provider}/${l.model}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push({ provider: l.provider, model: l.model });
  }
  return out;
}

export type Periodo = { de: string; ate: string };

/** Mês corrente até hoje — o período que a tela abre por padrão, porque a
 *  pergunta de quem entra aqui é quase sempre "quanto vai na fatura deste mês". */
export function mesCorrente(agora = new Date()): Periodo {
  const primeiro = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
  return {
    de: primeiro.toISOString().slice(0, 10),
    ate: agora.toISOString().slice(0, 10),
  };
}

/** Rótulo legível das finalidades — a coluna "ação" do relatório. */
export const ROTULO_ACAO: Record<string, string> = {
  chat: "Chat",
  chat_ferramentas: "Chat com ferramentas",
  report_analysis: "Análise de relatório",
  query_rewrite: "Reescrita de busca",
  embedding: "Embeddings",
  import_structure: "Importação — estrutura",
  import_layout: "Importação — layout",
  editor_text: "Editor — texto",
  editor_generate: "Editor — geração",
  transcricao: "Transcrição",
};

export const rotuloAcao = (p: string): string => ROTULO_ACAO[p] ?? p;
