import ExcelJS from "exceljs";
import { parseCsv, detectarDelim } from "./extract-csv";
import { cellToText } from "./extract-sheet";

/**
 * Extrai uma TABELA ESTRUTURADA (colunas + linhas) de um anexo CSV/TSV/XLSX.
 *
 * Diferente do extractor de texto (que achata a planilha em blocos para o RAG),
 * aqui preservamos as LINHAS para o anexo virar um DATASET consultável — as
 * ferramentas de dados (agregar/consultar_registros/derivar) passam a operar
 * sobre 100% do arquivo, em vez de o modelo "olhar" um texto truncado. Null
 * quando não é tabular ou não dá para estruturar (cabeçalho + ≥ 1 linha).
 */
export type TabelaExtraida = { colunas: string[]; linhas: string[][] };

const RE_CSV = /\.(csv|tsv)$/i;
const RE_XLS = /\.(xlsx|xlsm|xls)$/i;
/** Teto de linhas: as query-tools operam em memória; acima disto podaria contexto. */
const MAX_LINHAS = 100_000;

export async function extractTable(buf: Buffer, name: string, mime: string): Promise<TabelaExtraida | null> {
  try {
    if (RE_CSV.test(name) || /csv|tab-separated/i.test(mime)) {
      const text = buf.toString("utf8");
      const ext = (name.split(".").pop() ?? "csv").toLowerCase();
      return montar(parseCsv(text, detectarDelim(text, ext)));
    }
    if (RE_XLS.test(name) || /spreadsheet|excel|officedocument\.spreadsheet/i.test(mime)) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
      const ws = wb.worksheets.find((w) => (w.actualRowCount ?? 0) > 0) ?? wb.worksheets[0];
      if (!ws) return null;
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        if (rows.length >= MAX_LINHAS) return;
        const valores = Array.isArray(row.values) ? row.values.slice(1) : [];
        rows.push(valores.map(cellToText));
      });
      return montar(rows);
    }
  } catch {
    return null;
  }
  return null;
}

/** 1ª linha não-vazia = cabeçalho; alinha cada célula por índice de coluna. */
function montar(rows: string[][]): TabelaExtraida | null {
  const limpas = rows.filter((r) => r.some((c) => (c ?? "").trim() !== "")).slice(0, MAX_LINHAS + 1);
  if (limpas.length < 2) return null; // precisa de cabeçalho + ≥ 1 linha de dados
  const colunas = (limpas[0] ?? []).map((c, i) => String(c ?? "").trim() || `coluna${i + 1}`);
  const linhas = limpas.slice(1).map((r) => colunas.map((_c, i) => String(r[i] ?? "")));
  return { colunas, linhas };
}
