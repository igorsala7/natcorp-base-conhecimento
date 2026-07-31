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
  return [...set].slice(0, 40);
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

/** Injeta o metadado de dataset no resultado devolvido ao modelo (sem perder o
 *  dado — o modelo continua vendo a lista; só ganha o `_dataset` para o relatório). */
export function injetarDataset(reg: DatasetRegistry | undefined, saida: unknown): unknown {
  if (!reg || !saida || typeof saida !== "object") return saida;
  const meta = registrarDataset(reg, saida);
  if (!meta) return saida;
  const tag = { _dataset: meta.id, _total: meta.total, _colunas: meta.colunas };
  if (Array.isArray(saida)) return { ...tag, itens: saida };
  return { ...(saida as Record<string, unknown>), ...tag };
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
