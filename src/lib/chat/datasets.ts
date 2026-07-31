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
  const keys = colunas.map((_c, i) => "c" + i);
  const rows: DatasetRow[] = linhas.map((row) => {
    const o: DatasetRow = {};
    keys.forEach((k, i) => { o[k] = row[i] ?? ""; });
    return o;
  });
  const id = "tela" + (reg.list.length + 1);
  reg.list.push({ id, rows, colunas: keys, headers: colunas });
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
  max = 5000,
): TabelaExpandida | null {
  const ds = reg.list.find((d) => d.id === datasetId);
  if (!ds) return null;
  const keys = campos && campos.length ? campos : ds.colunas;
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
