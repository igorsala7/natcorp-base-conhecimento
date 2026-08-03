/**
 * REGISTRO DE DATASETS (correção do PDF incompleto).
 *
 * Problema: `gerar_relatorio` recebia as LINHAS redigitadas pelo modelo — com
 * "todos os dados" ele não reescreve centenas de linhas (limite de tokens), e o
 * PDF saía com ~1/10. Solução: quando uma ferramenta de dados retorna uma LISTA,
 * o servidor guarda as linhas COMPLETAS num registro e devolve ao modelo só um
 * id (`_dataset`) + total + colunas. No relatório, o modelo referencia o id e
 * escolhe as colunas — o servidor expande as linhas reais. Nada é redigitado.
 *
 * Puro (sem server-only/IO) para ser testável e reutilizável.
 */

import { parseNumBR } from "./num-br";

export type DatasetRow = Record<string, unknown>;
export type Dataset = { id: string; rows: DatasetRow[]; colunas: string[]; headers?: string[] };
export type DatasetRegistry = { list: Dataset[] };

export function newRegistry(): DatasetRegistry {
  return { list: [] };
}

/**
 * Registra uma TABELA DA TELA (colunas + linhas em texto) como dataset, para o
 * modelo referenciar por id (`dados_de`) sem redigitar as linhas — é o que evita
 * chamadas de tool gigantes (60×N células) que vazam como texto ou estouram.
 * As linhas são indexadas por `c0..cN` e os cabeçalhos de exibição ficam em
 * `headers` (usados por `expandirTabela` quando o modelo não passa `colunas`).
 */
export function registrarTabelaTela(reg: DatasetRegistry, colunas: string[], linhas: string[][]): { id: string; total: number } {
  const nomes = colunas.map((c) => String(c).trim());
  // Indexa cada célula por DUAS chaves — o índice `cN` E o NOME da coluna — para
  // funcionar independentemente de o modelo passar `campos` por índice ou por nome
  // (ou não passar nada). Sem isto, `campos` por nome não casava → células vazias.
  const rows: DatasetRow[] = linhas.map((row) => {
    const o: DatasetRow = {};
    nomes.forEach((nome, i) => {
      const v = row[i] ?? "";
      o["c" + i] = v;
      if (nome && o[nome] === undefined) o[nome] = v;
    });
    return o;
  });
  const id = "tela" + (reg.list.length + 1);
  // colunas = NOMES (fallback quando o modelo não passa `campos`); headers = idem.
  reg.list.push({ id, rows, colunas: nomes, headers: nomes });
  return { id, total: rows.length };
}

const ehLinha = (x: unknown): x is DatasetRow => !!x && typeof x === "object" && !Array.isArray(x);

/** Encontra a lista de registros dentro do resultado da ferramenta. */
function extrairLista(data: unknown): DatasetRow[] | null {
  if (Array.isArray(data)) {
    const rows = data.filter(ehLinha);
    return rows.length ? rows : null;
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["items", "itens", "data", "dados", "rows", "registros", "result", "results", "lista"]) {
      const v = o[k];
      if (Array.isArray(v)) {
        const rows = v.filter(ehLinha);
        if (rows.length) return rows;
      }
    }
  }
  return null;
}

/** Colunas candidatas = união das chaves das linhas (ignora metadados `_*`). */
function inferirColunas(rows: DatasetRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows.slice(0, 100)) for (const k of Object.keys(r)) if (!k.startsWith("_")) set.add(k);
  return [...set].slice(0, 150);
}

/** Coage uma célula a texto (números/booleanos/objetos tratados). */
function celula(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 200);
  return String(v).slice(0, 300);
}

/**
 * Registra a lista do resultado (se houver) e devolve o metadado para o modelo.
 * `null` quando o resultado não é uma lista de registros.
 */
export function registrarDataset(reg: DatasetRegistry, data: unknown): { id: string; total: number; colunas: string[] } | null {
  const rows = extrairLista(data);
  if (!rows || rows.length === 0) return null;
  const colunas = inferirColunas(rows);
  if (colunas.length === 0) return null;
  const id = "ds" + (reg.list.length + 1);
  reg.list.push({ id, rows, colunas });
  return { id, total: rows.length, colunas };
}

/** Máx. de linhas que o MODELO vê de um resultado de tool. O dataset (id) guarda TUDO;
 *  passar centenas/milhares de linhas ao modelo por chamada estoura o contexto (bug real:
 *  vários tool-calls acumulados passavam de 1M tokens no Gemini). A análise sobre 100% das
 *  linhas é feita pelas ferramentas de dados (dados_de), não relendo tudo no prompt. */
const MAX_ITENS_MODELO = 50;

const CHAVES_LISTA = ["items", "itens", "data", "dados", "rows", "registros", "result", "results", "lista"];

/** Injeta o metadado de dataset no resultado devolvido ao modelo. Registra TODAS as linhas
 *  no dataset (para dados_de) mas entrega ao modelo só uma AMOSTRA quando a lista é grande —
 *  senão o contexto estoura. O `_total`/`_dataset` + as ferramentas cobrem os 100%. */
export function injetarDataset(reg: DatasetRegistry | undefined, saida: unknown): unknown {
  if (!reg || !saida || typeof saida !== "object") return saida;
  const meta = registrarDataset(reg, saida);
  if (!meta) return saida;
  const truncado = meta.total > MAX_ITENS_MODELO;
  const tag: Record<string, unknown> = { _dataset: meta.id, _total: meta.total, _colunas: meta.colunas };
  if (truncado) {
    tag._amostra = MAX_ITENS_MODELO;
    tag._nota =
      `Amostra de ${MAX_ITENS_MODELO} de ${meta.total} registros. Para o TOTAL exato, contar, filtrar, somar/média ` +
      `ou exportar, use as ferramentas de dados com dados_de="${meta.id}" (elas cobrem 100% das linhas) — NUNCA conte/` +
      `analise pela amostra.`;
  }
  if (Array.isArray(saida)) return { ...tag, itens: truncado ? saida.slice(0, MAX_ITENS_MODELO) : saida };
  const o = saida as Record<string, unknown>;
  if (truncado) {
    // Trunca a MESMA lista que `extrairLista` registrou (1º array com linhas-objeto),
    // para o metadado (_total) e a amostra falarem da mesma coisa.
    for (const k of CHAVES_LISTA) {
      const v = o[k];
      if (Array.isArray(v) && v.some(ehLinha)) return { ...o, [k]: v.slice(0, MAX_ITENS_MODELO), ...tag };
    }
  }
  return { ...o, ...tag };
}

export type TabelaExpandida = { colunas: string[]; linhas: string[][]; total: number; truncado: boolean };

/**
 * Expande uma tabela do relatório a partir de um dataset registrado: usa TODAS
 * as linhas (até `max`). `campos` = chaves da linha por coluna (fallback: todas
 * as colunas inferidas); `colunas` = cabeçalhos exibidos (fallback: os campos).
 */
export function expandirTabela(
  reg: DatasetRegistry,
  datasetId: string,
  campos?: string[],
  colunas?: string[],
  max = 50000,
): TabelaExpandida | null {
  const ds = reg.list.find((d) => d.id === datasetId);
  if (!ds) return null;
  const keys = campos && campos.length ? campos.map((k) => String(k).trim()) : ds.colunas;
  if (keys.length === 0) return null;
  const headers =
    colunas && colunas.length === keys.length
      ? colunas
      : ds.headers && ds.headers.length === keys.length
        ? ds.headers
        : keys;
  const linhas = ds.rows.slice(0, max).map((r) => keys.map((k) => celula(r[k])));
  return { colunas: headers, linhas, total: ds.rows.length, truncado: ds.rows.length > max };
}

/* ────────────────────────────────────────────────────────────────────────────
 * CONSULTA / FILTRO server-side sobre um dataset já coletado.
 *
 * Motivo (bug grave): quando o relatório é grande, o modelo NÃO recebe as linhas
 * uma a uma — só um resumo estatístico (agregados + amostra). Se o usuário pede
 * "só os registros que têm X", o modelo tende a filtrar pela AMOSTRA (parcial) e
 * gera um arquivo com N errado (ex.: 10 de 70). A correção é NÃO deixar o modelo
 * filtrar: ele descreve as condições, o servidor aplica sobre 100% das linhas
 * COLETADAS e registra o subconjunto como um novo dataset para exportar exato.
 * ──────────────────────────────────────────────────────────────────────────── */

export type Operador =
  | "contem" | "nao_contem" | "igual" | "diferente"
  | "comeca" | "termina" | "vazio" | "nao_vazio"
  | "maior" | "menor" | "maior_igual" | "menor_igual";

export const OPERADORES: Operador[] = [
  "contem", "nao_contem", "igual", "diferente", "comeca", "termina",
  "vazio", "nao_vazio", "maior", "menor", "maior_igual", "menor_igual",
];

export type Filtro = { coluna: string; operador: Operador; valor?: string };
export type ConsultaResultado = {
  id: string;            // id do subconjunto registrado (para gerar_relatorio dados_de)
  total: number;         // total EXATO de correspondências (sobre todas as linhas)
  colunas: string[];
  amostra: string[][];   // primeiras N correspondências (para o modelo mostrar/conferir)
  colunaNaoEncontrada?: string;
};

/** Normaliza texto para comparação: sem acento, minúsculo, sem espaços nas pontas. */
function norm(s: unknown): string {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Resolve o nome de coluna informado (ou `cN`) para o índice na tabela. */
function resolverColuna(ds: Dataset, coluna: string): number | null {
  const alvo = norm(coluna);
  if (!alvo) return null;
  let idx = ds.colunas.findIndex((c) => norm(c) === alvo);
  if (idx >= 0) return idx;
  const m = /^c(\d+)$/i.exec(coluna.trim());
  if (m) { const i = Number(m[1]); if (i >= 0 && i < ds.colunas.length) return i; }
  idx = ds.colunas.findIndex((c) => { const n = norm(c); return n.includes(alvo) || alvo.includes(n); });
  return idx >= 0 ? idx : null;
}

/** Avalia UMA condição sobre uma célula (texto e número em pt-BR). */
function bate(cell: string, op: Operador, valor: string): boolean {
  const c = norm(cell), v = norm(valor);
  switch (op) {
    case "contem": return c.includes(v);
    case "nao_contem": return !c.includes(v);
    case "igual": return c === v;
    case "diferente": return c !== v;
    case "comeca": return c.startsWith(v);
    case "termina": return c.endsWith(v);
    case "vazio": return c === "";
    case "nao_vazio": return c !== "";
    default: {
      const a = parseNumBR(cell), b = parseNumBR(valor);
      if (a == null || b == null) return false;
      if (op === "maior") return a > b;
      if (op === "menor") return a < b;
      if (op === "maior_igual") return a >= b;
      return a <= b; // menor_igual
    }
  }
}

/**
 * Aplica os filtros sobre TODAS as linhas do dataset (não sobre uma amostra) e
 * registra o subconjunto como um novo dataset (id retornado em `id`) para o
 * modelo exportar via `gerar_relatorio({ dados_de })`. `modo`: "E" (todas as
 * condições) ou "OU" (qualquer uma). Sem filtros → devolve todas as linhas.
 */
export function consultarDataset(
  reg: DatasetRegistry,
  datasetId: string,
  filtros: Filtro[],
  modo: "E" | "OU" = "E",
  amostraMax = 50,
): ConsultaResultado | null {
  const ds = reg.list.find((d) => d.id === datasetId);
  if (!ds) return null;
  const nomes = ds.colunas;
  const asRow = (r: DatasetRow) => nomes.map((_c, i) => celula(r["c" + i]));
  const conds = filtros.map((f) => ({ f, idx: resolverColuna(ds, f.coluna) }));
  const ausente = conds.find((c) => c.idx == null);
  if (ausente) return { id: "", total: 0, colunas: nomes, amostra: [], colunaNaoEncontrada: ausente.f.coluna };

  const linhas: string[][] = [];
  for (const r of ds.rows) {
    const row = asRow(r);
    const res = conds.map(({ f, idx }) => bate(row[idx!] ?? "", f.operador, f.valor ?? ""));
    const ok = res.length === 0 ? true : modo === "OU" ? res.some(Boolean) : res.every(Boolean);
    if (ok) linhas.push(row);
  }
  // Registra o subconjunto como novo dataset (mesmas colunas) para exportar exato.
  const { id } = registrarTabelaTela(reg, nomes, linhas);
  return { id, total: linhas.length, colunas: nomes, amostra: linhas.slice(0, amostraMax) };
}

export type Agregacao =
  | "soma" | "media" | "mediana" | "min" | "max" | "amplitude"
  | "variancia" | "desvio_padrao" | "moda" | "contar" | "distintos";
export type AgregacaoResultado = {
  operacao: Agregacao;
  coluna: string;
  valor: number;
  linhasConsideradas: number; // linhas após o filtro (base da contagem)
  valoresNumericos: number;   // quantas células entraram no cálculo (numéricas)
  ignorados: number;          // células não-vazias que não são número (ignoradas no cálculo)
  colunaNaoEncontrada?: string;
};

/** Percentil por interpolação linear (igual ao PERCENTILE_CONT do Oracle). */
export function percentil(ordenado: number[], p: number): number {
  const n = ordenado.length;
  if (n === 0) return 0;
  if (n === 1) return ordenado[0]!;
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (n - 1);
  const lo = Math.floor(rank), hi = Math.ceil(rank);
  return lo === hi ? ordenado[lo]! : ordenado[lo]! + (ordenado[hi]! - ordenado[lo]!) * (rank - lo);
}

/** Aplica os filtros e devolve as linhas que passam (ou a coluna ausente). */
function filtrarLinhas(
  ds: Dataset,
  filtros: Filtro[],
  modo: "E" | "OU",
): { linhas: string[][] } | { colunaNaoEncontrada: string } {
  const nomes = ds.colunas;
  const asRow = (r: DatasetRow) => nomes.map((_c, i) => celula(r["c" + i]));
  const conds = filtros.map((f) => ({ f, idx: resolverColuna(ds, f.coluna) }));
  const ausente = conds.find((c) => c.idx == null);
  if (ausente) return { colunaNaoEncontrada: ausente.f.coluna };
  const linhas: string[][] = [];
  for (const r of ds.rows) {
    const row = asRow(r);
    const res = conds.map(({ f, idx }) => bate(row[idx!] ?? "", f.operador, f.valor ?? ""));
    const ok = res.length === 0 ? true : modo === "OU" ? res.some(Boolean) : res.every(Boolean);
    if (ok) linhas.push(row);
  }
  return { linhas };
}

/** Calcula UMA operação sobre um vetor numérico (+ contagem de linhas, p/ contar). */
export function calcularOperacao(operacao: Agregacao, nums: number[], linhas: number): number {
  if (operacao === "contar") return linhas;
  if (operacao === "distintos") return new Set(nums).size;
  const n = nums.length;
  if (!n) return 0;
  const soma = nums.reduce((s, x) => s + x, 0);
  const media = soma / n;
  const somaQuad = () => nums.reduce((s, x) => s + (x - media) ** 2, 0);
  switch (operacao) {
    case "soma": return soma;
    case "media": return media;
    case "mediana": return percentil([...nums].sort((a, b) => a - b), 50);
    case "min": return Math.min(...nums);
    case "max": return Math.max(...nums);
    case "amplitude": return Math.max(...nums) - Math.min(...nums);
    case "variancia": return n > 1 ? somaQuad() / (n - 1) : 0;            // amostral (= STDDEV/VARIANCE do Oracle)
    case "desvio_padrao": return n > 1 ? Math.sqrt(somaQuad() / (n - 1)) : 0;
    case "moda": {
      const f = new Map<number, number>(); let best = 0, m = nums[0]!;
      for (const x of nums) { const c = (f.get(x) ?? 0) + 1; f.set(x, c); if (c > best) { best = c; m = x; } }
      return m;
    }
    default: return 0;
  }
}

/** Extrai os NÚMEROS (pt-BR/R$) de uma coluna nas linhas dadas + estatística de qualidade. */
function extrairNumeros(linhas: string[][], idxCol: number): { nums: number[]; ignorados: number; distintos: number } {
  const nums: number[] = []; const distintos = new Set<string>(); let ignorados = 0;
  for (const row of linhas) {
    const cell = row[idxCol] ?? "";
    if (String(cell).trim()) distintos.add(norm(cell));
    const n = parseNumBR(cell);
    if (n == null) { if (String(cell).trim()) ignorados++; continue; }
    nums.push(n);
  }
  return { nums, ignorados, distintos: distintos.size };
}

/**
 * AGREGA uma coluna sobre TODAS as linhas do dataset (não uma amostra), com filtro
 * opcional aplicado antes. Garante SOMA/MÉDIA/MEDIANA/DESVIO/MÍN/MÁX/CONTAGEM EXATOS
 * — a IA nunca soma na mão nem se recusa por volume. Números pt-BR/R$ via parseNumBR.
 */
export function agregarDataset(
  reg: DatasetRegistry,
  datasetId: string,
  coluna: string,
  operacao: Agregacao,
  filtros: Filtro[] = [],
  modo: "E" | "OU" = "E",
): AgregacaoResultado | null {
  const ds = reg.list.find((d) => d.id === datasetId);
  if (!ds) return null;
  const idxCol = resolverColuna(ds, coluna);
  const base: AgregacaoResultado = { operacao, coluna, valor: 0, linhasConsideradas: 0, valoresNumericos: 0, ignorados: 0 };
  if (idxCol == null) return { ...base, colunaNaoEncontrada: coluna };
  const filt = filtrarLinhas(ds, filtros, modo);
  if ("colunaNaoEncontrada" in filt) return { ...base, coluna: ds.colunas[idxCol] ?? coluna, colunaNaoEncontrada: filt.colunaNaoEncontrada };
  const linhasConsideradas = filt.linhas.length;
  const { nums, ignorados, distintos } = extrairNumeros(filt.linhas, idxCol);
  const valor = operacao === "distintos" ? distintos : calcularOperacao(operacao, nums, linhasConsideradas);
  return { operacao, coluna: ds.colunas[idxCol] ?? coluna, valor, linhasConsideradas, valoresNumericos: nums.length, ignorados };
}

export type EstatisticasColuna = {
  coluna: string;
  linhas: number;      // linhas consideradas (após o filtro)
  validos: number;     // valores numéricos
  ignorados: number;   // células não-numéricas não-vazias
  distintos: number;
  soma: number; media: number; mediana: number; moda: number | null;
  min: number; max: number; amplitude: number;
  variancia: number; desvio_padrao: number;
  p25: number; p75: number; p90: number; p95: number; p99: number;
  colunaNaoEncontrada?: string;
};

/** PERFIL ESTATÍSTICO completo de uma coluna sobre 100% do dataset (com filtro opcional). */
export function estatisticasColuna(
  reg: DatasetRegistry,
  datasetId: string,
  coluna: string,
  filtros: Filtro[] = [],
  modo: "E" | "OU" = "E",
): EstatisticasColuna | null {
  const ds = reg.list.find((d) => d.id === datasetId);
  if (!ds) return null;
  const vazio: EstatisticasColuna = {
    coluna, linhas: 0, validos: 0, ignorados: 0, distintos: 0, soma: 0, media: 0, mediana: 0, moda: null,
    min: 0, max: 0, amplitude: 0, variancia: 0, desvio_padrao: 0, p25: 0, p75: 0, p90: 0, p95: 0, p99: 0,
  };
  const idxCol = resolverColuna(ds, coluna);
  if (idxCol == null) return { ...vazio, colunaNaoEncontrada: coluna };
  const filt = filtrarLinhas(ds, filtros, modo);
  if ("colunaNaoEncontrada" in filt) return { ...vazio, coluna: ds.colunas[idxCol] ?? coluna, colunaNaoEncontrada: filt.colunaNaoEncontrada };
  const nome = ds.colunas[idxCol] ?? coluna;
  const { nums, ignorados, distintos } = extrairNumeros(filt.linhas, idxCol);
  const linhas = filt.linhas.length, validos = nums.length;
  if (!validos) return { ...vazio, coluna: nome, linhas, ignorados, distintos };
  const ordenado = [...nums].sort((a, b) => a - b);
  const min = ordenado[0]!, max = ordenado[validos - 1]!;
  const variancia = calcularOperacao("variancia", nums, linhas);
  const freq = new Map<number, number>(); let best = 0, moda: number | null = null;
  for (const x of nums) { const c = (freq.get(x) ?? 0) + 1; freq.set(x, c); if (c > best) { best = c; moda = x; } }
  return {
    coluna: nome, linhas, validos, ignorados, distintos,
    soma: calcularOperacao("soma", nums, linhas), media: calcularOperacao("media", nums, linhas),
    mediana: percentil(ordenado, 50), moda: best > 1 ? moda : null,
    min, max, amplitude: max - min, variancia, desvio_padrao: Math.sqrt(variancia),
    p25: percentil(ordenado, 25), p75: percentil(ordenado, 75), p90: percentil(ordenado, 90),
    p95: percentil(ordenado, 95), p99: percentil(ordenado, 99),
  };
}

export type GrupoResultado = { grupo: string; valor: number; linhas: number };
/** AGRUPA POR uma coluna e agrega outra (ex.: média de Salário por Departamento). */
export function agruparDataset(
  reg: DatasetRegistry,
  datasetId: string,
  colunaGrupo: string,
  colunaValor: string,
  operacao: Agregacao,
  filtros: Filtro[] = [],
  modo: "E" | "OU" = "E",
  limite = 100,
  colunaGrupo2?: string,
): { grupos: GrupoResultado[]; totalGrupos: number } | { colunaNaoEncontrada: string } | null {
  const ds = reg.list.find((d) => d.id === datasetId);
  if (!ds) return null;
  const idxG = resolverColuna(ds, colunaGrupo);
  if (idxG == null) return { colunaNaoEncontrada: colunaGrupo };
  // 2ª coluna de grupo (opcional) → CRUZAMENTO exato numa passada (ex.: por empresa E filial).
  const idxG2 = colunaGrupo2 && colunaGrupo2.trim() ? resolverColuna(ds, colunaGrupo2) : null;
  if (colunaGrupo2 && colunaGrupo2.trim() && idxG2 == null) return { colunaNaoEncontrada: colunaGrupo2 };
  const precisaValor = operacao !== "contar";
  const idxV = precisaValor ? resolverColuna(ds, colunaValor) : idxG;
  if (precisaValor && idxV == null) return { colunaNaoEncontrada: colunaValor };
  const filt = filtrarLinhas(ds, filtros, modo);
  if ("colunaNaoEncontrada" in filt) return { colunaNaoEncontrada: filt.colunaNaoEncontrada };
  const mapa = new Map<string, { rotulo: string; nums: number[]; linhas: number }>();
  for (const row of filt.linhas) {
    const rot1 = String(row[idxG] ?? "").trim() || "(vazio)";
    const rot = idxG2 != null ? `${rot1} | ${String(row[idxG2] ?? "").trim() || "(vazio)"}` : rot1;
    const k = norm(rot);
    let e = mapa.get(k); if (!e) { e = { rotulo: rot, nums: [], linhas: 0 }; mapa.set(k, e); }
    e.linhas++;
    if (precisaValor) { const n = parseNumBR(row[idxV!] ?? ""); if (n != null) e.nums.push(n); }
  }
  const grupos: GrupoResultado[] = [];
  for (const e of mapa.values()) grupos.push({ grupo: e.rotulo, valor: calcularOperacao(operacao, e.nums, e.linhas), linhas: e.linhas });
  grupos.sort((a, b) => b.valor - a.valor);
  return { grupos: grupos.slice(0, limite), totalGrupos: mapa.size };
}

/* ────────────────────────────────────────────────────────────────────────────
 * DERIVAÇÃO POR LINHA (coluna calculada sobre 100% dos registros).
 *
 * As agregações reduzem UMA coluna a UM número e os filtros comparam coluna com
 * CONSTANTE — faltava a conta LINHA A LINHA entre duas colunas (ex.: mês2 − mês1,
 * variação %). Sem ela o modelo só derivava na amostra (~300) → PARCIAL num
 * relatório grande. Aqui o SERVIDOR calcula cada linha sobre 100% e registra um
 * novo dataset com a coluna derivada, para as ferramentas exatas (estatisticas/
 * consultar_registros/agrupar/gráfico/relatório) operarem sobre ela.
 *
 * INTEGRIDADE (dinheiro em jogo — decisões do usuário):
 *  - determinístico, sem IA no cálculo; pt-BR via parseNumBR;
 *  - célula vazia/não-numérica no OPERANDO → tratada como 0, e o total dessas
 *    linhas é REPORTADO (`vazias_como_zero`) — nada silencioso;
 *  - base ZERO em divisão/percentual/variação → resultado N/A explícito (nunca um
 *    número falso tipo "100%"), também REPORTADO (`base_zero_na`);
 *  - valor guardado com PRECISÃO TOTAL em formato pt-BR canônico (vírgula, SEM
 *    milhar) p/ as agregações seguintes serem exatas; a AMOSTRA arredonda a 2
 *    casas só p/ exibir. `parseNumBR` leria "1.234" como 1234 — por isso a vírgula.
 * ──────────────────────────────────────────────────────────────────────────── */

export type OperacaoLinha =
  | "subtracao" | "soma" | "multiplicacao" | "divisao"
  | "variacao_percentual" | "percentual" | "percentual_do_total";

export const OPERACOES_LINHA: OperacaoLinha[] = [
  "subtracao", "soma", "multiplicacao", "divisao",
  "variacao_percentual", "percentual", "percentual_do_total",
];

export type DerivacaoResultado = {
  id: string;               // novo dataset (colunas originais + a derivada)
  coluna: string;           // nome da coluna criada
  operacao: OperacaoLinha;
  total: number;            // linhas processadas (100%)
  calculadas: number;       // linhas com resultado numérico
  vazias_como_zero: number; // linhas onde um operando vazio/não-numérico virou 0
  base_zero_na: number;     // linhas N/A por base zero / resultado indefinido
  colunas: string[];        // colunas do novo dataset
  amostra: string[][];      // primeiras N linhas (derivada arredondada p/ exibir)
  colunaNaoEncontrada?: string;
};

/** Número → pt-BR canônico com PRECISÃO TOTAL (vírgula decimal, SEM milhar) —
 *  inequívoco p/ parseNumBR. Evita notação científica. N/A (não-finito) → "". */
function numeroCanonico(n: number): string {
  if (!Number.isFinite(n)) return "";
  let s = n.toString();
  if (s.includes("e") || s.includes("E")) s = n.toFixed(20).replace(/0+$/, "").replace(/\.$/, "");
  return s.replace(".", ",");
}

/** Arredonda p/ EXIBIÇÃO (2 casas) em pt-BR. Não afeta o valor guardado. */
function exibir2(n: number): string {
  if (!Number.isFinite(n)) return "N/A";
  return (Math.round(n * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function nomePadraoDerivada(op: OperacaoLinha, a: string, b: string): string {
  switch (op) {
    case "subtracao": return `${a} − ${b}`;
    case "soma": return `${a} + ${b}`;
    case "multiplicacao": return `${a} × ${b}`;
    case "divisao": return `${a} ÷ ${b}`;
    case "variacao_percentual": return `Variação % (${a} vs ${b})`;
    case "percentual": return `% (${a} de ${b})`;
    case "percentual_do_total": return `% do total (${a})`;
    default: return "Calculado";
  }
}

/**
 * Cria uma coluna CALCULADA por linha sobre 100% do dataset e registra um novo
 * dataset (colunas originais + a derivada). `colunaB` pode ser outra coluna OU um
 * número fixo (ignorada em `percentual_do_total`, que usa a soma da coluna A).
 */
export function derivarColuna(
  reg: DatasetRegistry,
  datasetId: string,
  colunaA: string,
  operacao: OperacaoLinha,
  colunaB?: string,
  nomeColuna?: string,
  amostraMax = 30,
): DerivacaoResultado | null {
  const ds = reg.list.find((d) => d.id === datasetId);
  if (!ds) return null;
  const nomes = ds.colunas;
  const base: DerivacaoResultado = {
    id: "", coluna: "", operacao, total: ds.rows.length, calculadas: 0,
    vazias_como_zero: 0, base_zero_na: 0, colunas: nomes, amostra: [],
  };
  const idxA = resolverColuna(ds, colunaA);
  if (idxA == null) return { ...base, colunaNaoEncontrada: colunaA };

  // colunaB: outra coluna, senão um número fixo. Dispensada em percentual_do_total.
  const precisaB = operacao !== "percentual_do_total";
  let idxB: number | null = null;
  let constB: number | null = null;
  if (precisaB) {
    idxB = colunaB != null && colunaB.trim() ? resolverColuna(ds, colunaB) : null;
    if (idxB == null) {
      const c = colunaB != null ? parseNumBR(colunaB) : null;
      if (c == null) return { ...base, colunaNaoEncontrada: colunaB ?? "(coluna_b)" };
      constB = c;
    }
  }

  const asRow = (r: DatasetRow) => nomes.map((_c, i) => celula(r["c" + i]));
  const linhasOrig = ds.rows.map(asRow);

  // percentual_do_total: soma da coluna A sobre 100% (vazio→0), usada como base.
  let totalA = 0;
  if (operacao === "percentual_do_total") for (const row of linhasOrig) totalA += parseNumBR(row[idxA] ?? "") ?? 0;

  let vazias = 0, calculadas = 0, baseZeroNa = 0;
  const novasLinhas: string[][] = [];
  for (const row of linhasOrig) {
    const aRaw = parseNumBR(row[idxA] ?? "");
    let bRaw: number | null;
    if (operacao === "percentual_do_total") bRaw = totalA;
    else if (constB != null) bRaw = constB;
    else bRaw = parseNumBR(row[idxB!] ?? "");
    // Política do usuário: operando vazio/não-numérico → 0 (contado e reportado).
    // Só conta operandos LIDOS DE CÉLULA (constante e total não contam).
    const aSubstituido = aRaw == null;
    const bSubstituido = precisaB && constB == null && bRaw == null;
    if (aSubstituido || bSubstituido) vazias++;
    const a = aRaw ?? 0;
    const b = bRaw ?? 0;
    let v: number | null;
    switch (operacao) {
      case "subtracao": v = a - b; break;
      case "soma": v = a + b; break;
      case "multiplicacao": v = a * b; break;
      case "divisao": v = b === 0 ? null : a / b; break;
      case "variacao_percentual": v = b === 0 ? null : ((a - b) / b) * 100; break;
      case "percentual": v = b === 0 ? null : (a / b) * 100; break;
      case "percentual_do_total": v = totalA === 0 ? null : (a / totalA) * 100; break;
      default: v = null;
    }
    if (v == null || !Number.isFinite(v)) { baseZeroNa++; novasLinhas.push([...row, ""]); }
    else { calculadas++; novasLinhas.push([...row, numeroCanonico(v)]); }
  }

  // Nome único (resolverColuna faz match fuzzy → evita colidir com coluna existente).
  const rotuloB = precisaB ? (idxB != null ? nomes[idxB] ?? String(colunaB) : String(colunaB)) : "";
  let nome = ((nomeColuna && nomeColuna.trim()) || nomePadraoDerivada(operacao, nomes[idxA] ?? colunaA, rotuloB)).slice(0, 80);
  if (nomes.some((c) => norm(c) === norm(nome))) nome = `${nome} (calc)`;

  const { id } = registrarTabelaTela(reg, [...nomes, nome], novasLinhas);
  // Amostra: derivada arredondada p/ exibição (o dataset guarda precisão total).
  const amostra = novasLinhas.slice(0, amostraMax).map((r) => {
    const derivada = r[r.length - 1] ?? "";
    return [...r.slice(0, -1), derivada === "" ? "N/A" : exibir2(parseNumBR(derivada) ?? NaN)];
  });
  return { id, coluna: nome, operacao, total: ds.rows.length, calculadas, vazias_como_zero: vazias, base_zero_na: baseZeroNa, colunas: [...nomes, nome], amostra };
}

/* ────────────────────────────────────────────────────────────────────────────
 * CLASSIFICAÇÃO POR FAIXA (rótulo de risco/faixa por linha, sobre 100%).
 * Ex.: variação % < −20 = "queda forte"; −20..0 = "queda leve"; ≥ 0 = "alta".
 * Determinístico. Faixa = [min, max) (min inclusivo, max exclusivo); null = aberto.
 * Célula vazia/não-numérica → bucket próprio "(sem valor)" (NUNCA some numa faixa).
 * ──────────────────────────────────────────────────────────────────────────── */

export type Faixa = { rotulo: string; min?: number | null; max?: number | null };
export type ClassificacaoResultado = {
  id: string;
  coluna: string;            // nome da coluna de rótulo criada
  total: number;
  distribuicao: { rotulo: string; linhas: number }[];
  sem_valor: number;         // células vazias/não-numéricas (bucket à parte)
  colunas: string[];
  amostra: string[][];
  colunaNaoEncontrada?: string;
};

const ROTULO_SEM_VALOR = "(sem valor)";
const ROTULO_FORA = "(fora das faixas)";

export function classificarColuna(
  reg: DatasetRegistry,
  datasetId: string,
  coluna: string,
  faixas: Faixa[],
  nomeColuna?: string,
  amostraMax = 30,
): ClassificacaoResultado | null {
  const ds = reg.list.find((d) => d.id === datasetId);
  if (!ds) return null;
  const nomes = ds.colunas;
  const idx = resolverColuna(ds, coluna);
  const base: ClassificacaoResultado = { id: "", coluna: "", total: ds.rows.length, distribuicao: [], sem_valor: 0, colunas: nomes, amostra: [] };
  if (idx == null) return { ...base, colunaNaoEncontrada: coluna };

  const asRow = (r: DatasetRow) => nomes.map((_c, i) => celula(r["c" + i]));
  const cont = new Map<string, number>();
  let semValor = 0;
  const novasLinhas: string[][] = ds.rows.map(asRow).map((row) => {
    const v = parseNumBR(row[idx] ?? "");
    let rot: string;
    if (v == null) { rot = ROTULO_SEM_VALOR; semValor++; }
    else {
      const f = faixas.find((fx) => (fx.min == null || v >= fx.min) && (fx.max == null || v < fx.max));
      rot = f ? f.rotulo : ROTULO_FORA;
    }
    cont.set(rot, (cont.get(rot) ?? 0) + 1);
    return [...row, rot];
  });

  let nome = (nomeColuna && nomeColuna.trim() ? nomeColuna : `Faixa (${nomes[idx]})`).slice(0, 80);
  if (nomes.some((c) => norm(c) === norm(nome))) nome = `${nome} (cl)`;
  const { id } = registrarTabelaTela(reg, [...nomes, nome], novasLinhas);

  // Distribuição na ORDEM das faixas + extras (fora/sem valor) ao fim — transparente.
  const distribuicao: { rotulo: string; linhas: number }[] = [];
  const vistos = new Set<string>();
  for (const fx of faixas) { if (!vistos.has(fx.rotulo)) { vistos.add(fx.rotulo); distribuicao.push({ rotulo: fx.rotulo, linhas: cont.get(fx.rotulo) ?? 0 }); } }
  for (const extra of [ROTULO_FORA, ROTULO_SEM_VALOR]) if (cont.get(extra)) distribuicao.push({ rotulo: extra, linhas: cont.get(extra)! });

  const amostra = novasLinhas.slice(0, amostraMax);
  return { id, coluna: nome, total: ds.rows.length, distribuicao, sem_valor: semValor, colunas: [...nomes, nome], amostra };
}

/* ────────────────────────────────────────────────────────────────────────────
 * PROJEÇÃO por registro a partir de uma SÉRIE de colunas mensais.
 *  - 2 meses (decisão do usuário): calcula COMPOSTA e LINEAR lado a lado.
 *  - 3+ meses: REGRESSÃO linear (mínimos quadrados) + R² por registro.
 * Determinística, com PREMISSAS explícitas. Integridade: série INCOMPLETA (algum
 * mês faltante) → linha NÃO projetada (N/A) e reportada — não se inventa ponto,
 * pois um valor fabricado numa tendência é justamente o erro que custa caro.
 * ──────────────────────────────────────────────────────────────────────────── */

export type MetodoProjecao = "auto" | "ambos" | "composta" | "linear" | "regressao";
export type ProjecaoResultado = {
  id: string;
  metodo: Exclude<MetodoProjecao, "auto">; // método EFETIVO aplicado
  horizonte: number;
  total: number;
  projetadas: number;             // linhas com ao menos uma projeção numérica
  serie_incompleta: number;       // linhas com mês faltante → não projetadas
  base_invalida_composta: number; // base ≤ 0 → composta N/A na linha
  premissas: string[];
  colunas_projetadas: string[];
  colunas: string[];
  amostra: string[][];
  colunaNaoEncontrada?: string;
  erro?: string;
};

/** Regressão linear por mínimos quadrados sobre y[i] em x=i. Retorna coef. + R². */
function regressaoLinear(ys: number[]): { m: number; b: number; r2: number } {
  const n = ys.length;
  const mx = (n - 1) / 2;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = i - mx, dy = ys[i]! - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const m = sxx === 0 ? 0 : sxy / sxx;
  const b = my - m * mx;
  let ssres = 0;
  for (let i = 0; i < n; i++) { const yhat = m * i + b; ssres += (ys[i]! - yhat) ** 2; }
  const r2 = syy === 0 ? 1 : 1 - ssres / syy; // série constante → ajuste perfeito
  return { m, b, r2 };
}

export function projetarSerie(
  reg: DatasetRegistry,
  datasetId: string,
  colunasSerie: string[],
  horizonte = 6,
  metodo: MetodoProjecao = "auto",
  amostraMax = 30,
): ProjecaoResultado | null {
  const ds = reg.list.find((d) => d.id === datasetId);
  if (!ds) return null;
  const nomes = ds.colunas;
  const h = Math.min(Math.max(1, Math.floor(horizonte)), 24);
  const base: ProjecaoResultado = {
    id: "", metodo: "linear", horizonte: h, total: ds.rows.length, projetadas: 0,
    serie_incompleta: 0, base_invalida_composta: 0, premissas: [], colunas_projetadas: [], colunas: nomes, amostra: [],
  };
  const serie = colunasSerie.map((c) => c);
  if (serie.length < 2) return { ...base, erro: "A projeção precisa de ao menos 2 colunas de meses (a série histórica)." };
  const idxs = serie.map((c) => resolverColuna(ds, c));
  const faltaI = idxs.findIndex((i) => i == null);
  if (faltaI >= 0) return { ...base, colunaNaoEncontrada: serie[faltaI] };
  const idxSerie = idxs as number[];
  const k = idxSerie.length;

  // Método EFETIVO: auto = regressão (3+ meses) senão "ambos" (2 meses).
  const efetivo: Exclude<MetodoProjecao, "auto"> = metodo === "auto" ? (k >= 3 ? "regressao" : "ambos") : metodo;
  const fazComp = efetivo === "composta" || efetivo === "ambos";
  const fazLin = efetivo === "linear" || efetivo === "ambos";
  const fazReg = efetivo === "regressao";

  // Cabeçalhos das colunas projetadas.
  const colsComp = fazComp ? Array.from({ length: h }, (_, n) => `Proj +${n + 1} (comp.)`) : [];
  const colsLin = fazLin ? Array.from({ length: h }, (_, n) => `Proj +${n + 1} (linear)`) : [];
  const colsReg = fazReg ? Array.from({ length: h }, (_, n) => `Proj +${n + 1} (regr.)`) : [];
  const colsProj = [...colsComp, ...colsLin, ...colsReg, ...(fazReg ? ["R²"] : [])];

  const asRow = (r: DatasetRow) => nomes.map((_c, i) => celula(r["c" + i]));
  let projetadas = 0, incompleta = 0, baseInvalida = 0;
  const novasLinhas: string[][] = ds.rows.map(asRow).map((row) => {
    const ys = idxSerie.map((i) => parseNumBR(row[i] ?? ""));
    if (ys.some((y) => y == null)) { incompleta++; return [...row, ...colsProj.map(() => "")]; }
    const s = ys as number[];
    const ult = s[k - 1]!, prim = s[0]!;
    const vals: string[] = [];
    let algum = false;

    if (fazComp) {
      // CAGR sobre a série; exige base > 0 (ratio). Base ≤ 0 → N/A na linha.
      if (prim > 0 && ult > 0) {
        const cagr = Math.pow(ult / prim, 1 / (k - 1)) - 1;
        for (let n = 1; n <= h; n++) { const v = ult * Math.pow(1 + cagr, n); vals.push(Number.isFinite(v) ? numeroCanonico(v) : ""); if (Number.isFinite(v)) algum = true; }
      } else { baseInvalida++; for (let n = 0; n < h; n++) vals.push(""); }
    }
    if (fazLin) {
      const passo = (ult - prim) / (k - 1);
      for (let n = 1; n <= h; n++) { const v = ult + passo * n; vals.push(Number.isFinite(v) ? numeroCanonico(v) : ""); if (Number.isFinite(v)) algum = true; }
    }
    if (fazReg) {
      const { m, b, r2 } = regressaoLinear(s);
      for (let n = 1; n <= h; n++) { const v = m * (k - 1 + n) + b; vals.push(Number.isFinite(v) ? numeroCanonico(v) : ""); if (Number.isFinite(v)) algum = true; }
      vals.push(numeroCanonico(r2));
    }
    if (algum) projetadas++;
    return [...row, ...vals];
  });

  const { id } = registrarTabelaTela(reg, [...nomes, ...colsProj], novasLinhas);

  const premissas: string[] = [];
  if (fazComp) premissas.push("Composta: aplica a variação média (CAGR) da série a cada mês — premissa de crescimento proporcional constante; não considera sazonalidade; base ≤ 0 vira N/A.");
  if (fazLin) premissas.push("Linear: soma o passo médio absoluto da série a cada mês — premissa de variação constante em reais; pode ficar negativo.");
  if (fazReg) premissas.push(`Regressão linear (mínimos quadrados) sobre ${k} meses; R² por registro indica a qualidade do ajuste (1 = perfeito). Premissa de tendência linear.`);
  if (k === 2) premissas.push("ATENÇÃO: só 2 meses de histórico — projeção é extrapolação de 2 pontos, frágil por natureza. Trate como cenário, não como certeza.");

  // Amostra: projeções arredondadas p/ exibição (dataset guarda precisão total).
  const amostra = novasLinhas.slice(0, amostraMax).map((r) => {
    const orig = r.slice(0, nomes.length);
    const proj = r.slice(nomes.length).map((c) => (c === "" ? "N/A" : exibir2(parseNumBR(c) ?? NaN)));
    return [...orig, ...proj];
  });

  return { id, metodo: efetivo, horizonte: h, total: ds.rows.length, projetadas, serie_incompleta: incompleta, base_invalida_composta: baseInvalida, premissas, colunas_projetadas: colsProj, colunas: [...nomes, ...colsProj], amostra };
}
