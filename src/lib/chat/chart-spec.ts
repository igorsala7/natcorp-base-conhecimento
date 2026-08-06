import type { ChartData, ChartRow, ChartType } from "@/lib/blocks/schema";

/**
 * "Spec compacta" de gráfico — o formato que a IA preenche (fácil para o modelo)
 * e que trafega no SSE `chart`. É convertida para o `ChartData` do editor/portal
 * (reuso do `ChartView`/Recharts) e desenhada no canvas do widget e do PDF.
 *
 * Client-safe: só tipos + funções puras (sem `server-only`, sem SDK de IA).
 */

/** Tipos oferecidos no chat (rótulo + o `chartType` do ChartData). O widget desenha todos;
 *  o `chartType` é a correspondência no editor/portal (Recharts) ao salvar/converter. */
export const CHART_TIPOS = [
  { tipo: "colunas", label: "Colunas", chartType: "column" },
  { tipo: "colunas_emp", label: "Colunas empilhadas", chartType: "stackedColumn" },
  { tipo: "barras", label: "Barras", chartType: "bar" },
  { tipo: "barras_emp", label: "Barras empilhadas", chartType: "bar" },
  { tipo: "linha", label: "Linha", chartType: "line" },
  { tipo: "area", label: "Área", chartType: "area" },
  { tipo: "area_emp", label: "Área empilhada", chartType: "stackedArea" },
  { tipo: "combo", label: "Combo (colunas + linha)", chartType: "combo" },
  { tipo: "pizza", label: "Pizza", chartType: "pie" },
  { tipo: "rosca", label: "Rosca", chartType: "donut" },
  { tipo: "radar", label: "Radar / Teia", chartType: "radar" },
  { tipo: "dispersao", label: "Dispersão", chartType: "scatter" },
  { tipo: "bolha", label: "Bolha", chartType: "bubble" },
  { tipo: "heatmap", label: "Mapa de calor", chartType: "column" },
  { tipo: "candle", label: "Candle (OHLC)", chartType: "column" },
] as const;

export type ChartTipo = (typeof CHART_TIPOS)[number]["tipo"];
export const CHART_TIPO_KEYS = CHART_TIPOS.map((c) => c.tipo) as [ChartTipo, ...ChartTipo[]];

export type ChartSerie = { nome: string; valores: number[] };
export type ChartSpec = {
  tipo: ChartTipo;
  titulo: string;
  categorias: string[];
  series: ChartSerie[];
  /** Traça a linha da MEDIANA dos valores (quando faz sentido). */
  mediana?: boolean;
  /** Traça a linha de TENDÊNCIA/progressão (regressão linear da 1ª série). */
  tendencia?: boolean;
};

/** Mediana de uma lista de números (ignora não-finitos). */
export function medianOf(nums: number[]): number | null {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m]! : (xs[m - 1]! + xs[m]!) / 2;
}

/** Regressão linear simples sobre `ys` (x = 0..n-1): retorna {a, b} de y = a + b·x. */
export function linReg(ys: number[]): { a: number; b: number } | null {
  const n = ys.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    const y = ys[i] || 0;
    sx += i; sy += y; sxy += i * y; sxx += i * i;
  }
  const den = n * sxx - sx * sx;
  if (den === 0) return null;
  const b = (n * sxy - sx * sy) / den;
  return { a: (sy - b * sx) / n, b };
}

/** Paleta da marca (roxo/rosa/azul) + cores distintas para séries extras. */
export const CHART_PALETTE = [
  "#511C76",
  "#C95788",
  "#2C1A63",
  "#2563EB",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#0EA5E9",
  "#EC4899",
];

// Teto ALTO: um gráfico pode vir do DATASET completo (o servidor monta as categorias a
// partir de 100% das linhas — não são redigitadas pelo modelo). O widget navega os muitos
// pontos por JANELA (scroll/zoom), então não trava a leitura. Ver report-tools (dados_de).
const MAX_CATEGORIAS = 2000;
const MAX_SERIES = 12;

function coerceNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const tipoValido = (t: unknown): t is ChartTipo => CHART_TIPOS.some((c) => c.tipo === t);

/** Saneia a spec vinda do modelo: alinha valores às categorias, limita tamanhos. */
export function normalizeSpec(raw: unknown): ChartSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const categorias = Array.isArray(o.categorias)
    ? o.categorias.slice(0, MAX_CATEGORIAS).map((c) => String(c ?? "").slice(0, 80))
    : [];
  if (categorias.length === 0) return null;
  const seriesRaw = Array.isArray(o.series) ? o.series.slice(0, MAX_SERIES) : [];
  const series: ChartSerie[] = [];
  for (const s of seriesRaw) {
    if (!s || typeof s !== "object") continue;
    const so = s as Record<string, unknown>;
    const valoresRaw = Array.isArray(so.valores) ? so.valores : [];
    // Alinha ao nº de categorias (preenche com 0, corta o excedente).
    const valores = categorias.map((_, i) => coerceNum(valoresRaw[i]));
    series.push({ nome: String(so.nome ?? "").slice(0, 60) || `Série ${series.length + 1}`, valores });
  }
  if (series.length === 0) return null;
  // Exige ao menos um valor não-zero (senão o gráfico é inútil).
  if (!series.some((s) => s.valores.some((v) => v !== 0))) return null;
  return {
    tipo: tipoValido(o.tipo) ? o.tipo : "colunas",
    titulo: String(o.titulo ?? "").slice(0, 120),
    categorias,
    series,
    ...(o.mediana === true ? { mediana: true } : {}),
    ...(o.tendencia === true ? { tendencia: true } : {}),
  };
}

/** Converte a spec compacta no `ChartData` do editor/portal (mesmo render). */
export function specToChartData(spec: ChartSpec): ChartData {
  const chartType = (CHART_TIPOS.find((c) => c.tipo === spec.tipo)?.chartType ?? "column") as ChartType;
  const xKey = "categoria";
  const series = spec.series.map((s, i) => ({ key: `s${i}`, label: s.nome }));
  const columns = [{ key: xKey, label: "Categoria" }, ...series.map((s) => ({ key: s.key, label: s.label }))];
  const rows: ChartRow[] = spec.categorias.map((c, r) => {
    const row: ChartRow = { [xKey]: c };
    spec.series.forEach((s, i) => (row[`s${i}`] = s.valores[r] ?? 0));
    return row;
  });
  return {
    chartType,
    title: spec.titulo,
    columns,
    rows,
    xKey,
    series,
    legend: series.length > 1,
    grid: true,
    showMedian: spec.mediana === true,
    showTrend: spec.tendencia === true,
  };
}

/**
 * QUEM desenha o quê. O chat oferece 15 tipos e o widget desenha os 15 em canvas,
 * mas os ARQUIVOS não: até aqui um `radar` num PPT virava barras e um `candle` num
 * PDF virava linha — com os números certos e a FORMA errada, sem nenhum aviso.
 * Isso é integridade de dado, não estética. Esta tabela é a fonte única da verdade;
 * `degradarTipo` troca por um substituto honesto E devolve o aviso para contar ao
 * usuário. Nunca degrade em silêncio.
 */
export type DestinoGrafico = "svg" | "pdf" | "docxNativo" | "pptx" | "recharts";
type Suporte = Record<DestinoGrafico, boolean>;
const S = (svg: boolean, pdf: boolean, docxNativo: boolean, pptx: boolean, recharts: boolean): Suporte =>
  ({ svg, pdf, docxNativo, pptx, recharts });

export const CHART_SUPORTE: Record<ChartTipo, Suporte> = {
  //              svg    pdf    docx   pptx   recharts
  colunas:     S(true,  true,  true,  true,  true),
  colunas_emp: S(true,  true,  true,  true,  true),
  barras:      S(true,  true,  true,  true,  true),
  barras_emp:  S(true,  true,  true,  true,  false),
  linha:       S(true,  true,  true,  true,  true),
  area:        S(true,  true,  true,  true,  true),
  area_emp:    S(true,  true,  true,  true,  true),
  combo:       S(true,  true,  false, true,  true),
  pizza:       S(true,  true,  true,  true,  true),
  rosca:       S(true,  true,  true,  true,  true),
  radar:       S(true,  true,  false, true,  true),
  dispersao:   S(false, false, false, false, true),
  bolha:       S(false, false, false, false, true),
  heatmap:     S(false, false, false, false, false),
  candle:      S(false, false, false, false, false),
};

/** Substituto quando o destino não desenha o tipo pedido — e por quê, em português. */
const SUBSTITUTO: Partial<Record<ChartTipo, { tipo: ChartTipo; motivo: string }>> = {
  colunas_emp: { tipo: "colunas", motivo: "as séries aparecem lado a lado, não empilhadas" },
  barras_emp: { tipo: "barras", motivo: "as séries aparecem lado a lado, não empilhadas" },
  area_emp: { tipo: "area", motivo: "as séries aparecem sobrepostas, não empilhadas" },
  combo: { tipo: "colunas", motivo: "todas as séries saem em colunas" },
  radar: { tipo: "barras", motivo: "as dimensões viram barras" },
  heatmap: { tipo: "colunas", motivo: "a matriz vira colunas agrupadas" },
  candle: { tipo: "linha", motivo: "sai só a linha de fechamento" },
  dispersao: { tipo: "colunas", motivo: "os pontos viram colunas — a relação X×Y se perde" },
  bolha: { tipo: "colunas", motivo: "os pontos viram colunas — X×Y e o tamanho se perdem" },
};

const rotuloTipo = (t: ChartTipo) => CHART_TIPOS.find((c) => c.tipo === t)?.label ?? t;

/**
 * Ajusta o tipo ao que o destino REALMENTE desenha. Devolve o tipo a usar e, quando
 * houve troca, um aviso pronto para o modelo repassar e para a legenda do arquivo.
 */
export function degradarTipo(tipo: ChartTipo, destino: DestinoGrafico): { tipo: ChartTipo; aviso?: string } {
  if (CHART_SUPORTE[tipo]?.[destino]) return { tipo };
  const sub = SUBSTITUTO[tipo];
  const alvo = sub && CHART_SUPORTE[sub.tipo]?.[destino] ? sub.tipo : "colunas";
  const motivo = sub?.motivo ?? "o formato não desenha esse tipo";
  return { tipo: alvo, aviso: `"${rotuloTipo(tipo)}" não existe neste formato — saiu como ${rotuloTipo(alvo)} (${motivo}).` };
}

/** Rótulo que "cheira" a tempo: 03/2026, 2026-03, 2026, jan…, semana 4, 1º tri. */
const RX_TEMPO = /^(0?[1-9]|1[0-2])[/-]\d{2,4}$|^\d{4}(-\d{2})?$|^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i;

/**
 * Tipo mais adequado para estes dados — decidido AQUI, não pelo modelo (é onde ele
 * mais erra). Usado quando a chamada vem sem `tipo`: vira a recomendação destacada
 * nos botões e o padrão quando não há escolha do usuário.
 */
export function sugerirTipo(spec: { categorias: string[]; series: ChartSerie[] }): ChartTipo {
  const n = spec.categorias.length;
  const nSeries = spec.series.length;
  const temporal = n >= 3 && spec.categorias.filter((c) => RX_TEMPO.test(c.trim())).length >= Math.ceil(n * 0.6);
  if (temporal) return "linha";
  // Poucas fatias de uma série só, todas positivas → parte de um todo.
  if (nSeries === 1 && n >= 2 && n <= 6 && spec.series[0]!.valores.every((v) => v >= 0)) return "pizza";
  const rotuloMedio = n ? spec.categorias.reduce((s, c) => s + c.length, 0) / n : 0;
  if (n > 12 || rotuloMedio > 14) return "barras"; // horizontais: rótulo longo cabe
  return "colunas";
}

function csvCell(v: string): string {
  return /[",\r\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV dos dados (cabeçalho: Categoria + nomes das séries). */
export function specToCsv(spec: ChartSpec): string {
  const head = ["Categoria", ...spec.series.map((s) => s.nome)];
  const linhas = spec.categorias.map((c, r) => [c, ...spec.series.map((s) => String(s.valores[r] ?? ""))]);
  return [head, ...linhas].map((cols) => cols.map((x) => csvCell(x)).join(",")).join("\r\n");
}
