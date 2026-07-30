import type { ExtractedBlock, Extraction } from "./extract";

/**
 * CSV/TSV → blocos de texto para embedding, no MESMO espírito do `extract-sheet`
 * (planilha): cada linha é reescrita com o CABEÇALHO da coluna repetido —
 * `"Produto: Alfa; Preço: 1.200"` — porque uma linha crua (`"Alfa,1.200,5"`) é
 * irrecuperável para o RAG. Fica num módulo próprio (sem ExcelJS) para o CSV não
 * arrastar a dependência pesada da planilha.
 */

/** Teto de linhas: um CSV gigante estouraria a memória do worker. */
const MAX_LINHAS = 5000;
const BOM = /^\uFEFF/;

/**
 * Parser CSV/TSV (RFC 4180): aspas, aspas escapadas (`""`), quebras de linha
 * dentro de aspas, CRLF e BOM. `delim` é o separador de campo.
 */
export function parseCsv(text: string, delim: string): string[][] {
  const s = text.replace(BOM, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } // "" → aspa literal
        else quoted = false;
      } else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Descarta linhas totalmente vazias.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Detecta o separador pela 1ª linha não-vazia (vírgula/ponto-e-vírgula/tab). */
export function detectarDelim(text: string, ext: string): string {
  if (ext === "tsv") return "\t";
  const linha = text.replace(BOM, "").split(/\r?\n/).find((l) => l.trim()) ?? "";
  const cont = (ch: string) => linha.split(ch).length - 1;
  const cands = [
    { d: ",", n: cont(",") },
    { d: ";", n: cont(";") },
    { d: "\t", n: cont("\t") },
  ];
  const melhor = cands.reduce((a, b) => (b.n > a.n ? b : a));
  return melhor.n > 0 ? melhor.d : ",";
}

/** Linha "Cabeçalho: valor; …" (pula colunas vazias) — igual à planilha. */
function linhaComCabecalho(cabecalhos: string[], valores: string[]): string {
  const partes: string[] = [];
  for (let i = 0; i < valores.length; i++) {
    const valor = valores[i]?.trim();
    if (!valor) continue;
    const cab = cabecalhos[i]?.trim();
    partes.push(cab ? `${cab}: ${valor}` : valor);
  }
  return partes.join("; ");
}

export function extractCsv(text: string, ext: string): Extraction {
  const rows = parseCsv(text, detectarDelim(text, ext));
  const blocks: ExtractedBlock[] = [];
  const linhas = rows.slice(0, MAX_LINHAS);
  if (linhas.length) {
    // 1ª linha é cabeçalho quando tem ≥2 células com texto (CSV sem cabeçalho
    // existe, e inventar um piora o resultado).
    const primeira = linhas[0] ?? [];
    const temCabecalho = primeira.filter((c) => c.trim()).length >= 2;
    const cabecalhos = temCabecalho ? primeira : [];
    const corpo = temCabecalho ? linhas.slice(1) : linhas;
    for (const valores of corpo) {
      const texto = linhaComCabecalho(cabecalhos, valores);
      if (texto) blocks.push({ text: texto, level: 0 });
    }
    if (rows.length > MAX_LINHAS) {
      blocks.push({ text: `(Arquivo truncado em ${MAX_LINHAS} linhas.)`, level: 0 });
    }
  }
  return { source: "sheet", blocks, images: [] };
}
