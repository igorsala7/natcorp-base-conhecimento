/**
 * Import de dados tabulares (CSV/TSV/planilha) para gráfico e tabela. PURO e
 * isomórfico — a leitura de .xlsx (SheetJS) fica no cliente (data-import.tsx),
 * que chama `parseDelimited` para CSV e devolve `string[][]` para as conversões
 * daqui. Detecta delimitador, cabeçalho e colunas numéricas automaticamente.
 */
import type { ChartColumn, ChartRow, ChartSeries, RichText } from "./schema";

/** Número no formato PT-BR (1.234,56) ou EN (1,234.56 / 1234.56), com R$/%/espaços. */
export function ehNumero(s: string): boolean {
  const t = String(s ?? "")
    .trim()
    .replace(/[R$\s%€.]/g, "")
    .replace(",", ".");
  return t !== "" && Number.isFinite(Number(t));
}

/** Escolhe o delimitador pela 1ª linha: tab > ; > , (o mais frequente). */
export function detectarDelimitador(text: string): string {
  const linha = (text.split(/\r?\n/).find((l) => l.trim() !== "") ?? "");
  const cont = (d: string) => linha.split(d).length - 1;
  const tab = cont("\t");
  if (tab > 0) return "\t";
  const pv = cont(";");
  const v = cont(",");
  if (pv > 0 && pv >= v) return ";";
  return ",";
}

/** Parser CSV/TSV com aspas (RFC-ish): "" escapa aspas, \n dentro de aspas. */
export function parseDelimited(text: string, delim?: string): string[][] {
  const d = delim ?? detectarDelimitador(text);
  const t = text.replace(/\r\n?/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          cell += '"';
          i++;
        } else aspas = false;
      } else cell += c;
    } else if (c === '"') {
      aspas = true;
    } else if (c === d) {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  row.push(cell);
  rows.push(row);
  // Descarta linhas totalmente vazias.
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Chaves únicas a partir dos cabeçalhos. */
function chaves(headers: string[]): string[] {
  const vistos = new Set<string>();
  return headers.map((h, i) => {
    const base = slug(h) || `col${i + 1}`;
    let k = base;
    let n = 2;
    while (vistos.has(k)) k = `${base}_${n++}`;
    vistos.add(k);
    return k;
  });
}

/** Primeira linha é cabeçalho se NÃO for toda numérica (e houver dados abaixo). */
function temCabecalho(grid: string[][]): boolean {
  if (grid.length < 2) return grid.length === 1 && !grid[0]!.every(ehNumero);
  return !grid[0]!.every(ehNumero);
}

/**
 * `string[][]` → dados de GRÁFICO. Detecta cabeçalho; X = 1ª coluna majoritária
 * NÃO-numérica (categoria); séries = colunas majoritariamente numéricas.
 */
export function rowsToChart(
  grid: string[][],
): { columns: ChartColumn[]; rows: ChartRow[]; xKey: string; series: ChartSeries[] } | null {
  const g = grid.filter((r) => r.some((c) => c.trim() !== ""));
  if (!g.length) return null;
  const largura = Math.max(...g.map((r) => r.length));
  const header = temCabecalho(g);
  const cabec = header
    ? Array.from({ length: largura }, (_, i) => (g[0]![i] ?? "").trim() || `Coluna ${i + 1}`)
    : Array.from({ length: largura }, (_, i) => `Coluna ${i + 1}`);
  const dados = header ? g.slice(1) : g;
  if (!dados.length) return null;
  const keys = chaves(cabec);
  const columns: ChartColumn[] = cabec.map((label, i) => ({ key: keys[i]!, label }));
  const rows: ChartRow[] = dados.map((r) => {
    const o: ChartRow = {};
    columns.forEach((c, i) => {
      o[c.key] = (r[i] ?? "").trim();
    });
    return o;
  });
  // Proporção numérica por coluna.
  const score = columns.map(
    (c) => rows.filter((r) => ehNumero(String(r[c.key]))).length / rows.length,
  );
  let xi = score.findIndex((s) => s < 0.5);
  if (xi < 0) xi = 0;
  const xKey = columns[xi]!.key;
  const numericas = columns.filter((_, i) => i !== xi && score[i]! >= 0.5);
  const series: ChartSeries[] = (numericas.length
    ? numericas
    : columns.filter((_, i) => i !== xi)
  ).map((c) => ({ key: c.key, label: c.label }));
  return { columns, rows, xKey, series };
}

const richDe = (s: string): RichText => (s.trim() ? [{ text: s.trim() }] : []);

/** `string[][]` → dados de TABELA (RichText[][] + cabeçalho detectado). */
export function rowsToTable(grid: string[][]): { rows: RichText[][]; hasHeader: boolean } {
  const g = grid.filter((r) => r.some((c) => c.trim() !== ""));
  const largura = Math.max(1, ...g.map((r) => r.length));
  const rows = g.map((r) => Array.from({ length: largura }, (_, i) => richDe(r[i] ?? "")));
  return { rows, hasHeader: temCabecalho(g) };
}
