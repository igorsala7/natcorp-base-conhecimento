/**
 * Parser de Markdown LEVE para os relatórios (Word/PDF/PPT). Os modelos escrevem
 * o texto em markdown (`# Título`, `**negrito**`, `- item`, tabelas com `|`); sem
 * este parser os geradores mostrariam a marcação crua. Puro e testável.
 */

export type MdRun = { text: string; bold?: boolean; italic?: boolean };
export type MdBlock =
  | { kind: "heading"; level: 1 | 2 | 3; runs: MdRun[] }
  | { kind: "paragraph"; runs: MdRun[] }
  | { kind: "bullet"; runs: MdRun[] }
  | { kind: "ordered"; index: number; runs: MdRun[] }
  | { kind: "table"; header: string[]; rows: string[][] };

/** Divide uma linha de tabela em células (remove `|` das bordas). */
function splitPipe(line: string): string[] {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
}

/** Quebra o texto em runs com negrito/itálico. Negrito: `**` ou `__`; itálico: `*`
 *  (o `_` isolado NÃO vira itálico, para não afetar identificadores como p_matricula). */
export function parseInline(text: string): MdRun[] {
  const s = String(text ?? "");
  const runs: MdRun[] = [];
  const re = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) runs.push({ text: s.slice(last, m.index) });
    if (m[1] != null) runs.push({ text: m[1], bold: true, italic: true });
    else if (m[2] != null) runs.push({ text: m[2], bold: true });
    else if (m[3] != null) runs.push({ text: m[3], bold: true });
    else if (m[4] != null) runs.push({ text: m[4], italic: true });
    else if (m[5] != null) runs.push({ text: m[5] });
    last = re.lastIndex;
  }
  if (last < s.length) runs.push({ text: s.slice(last) });
  return runs.length ? runs.filter((r) => r.text !== "") : [{ text: s }];
}

/** Texto puro de uma sequência de runs (para células/legendas). */
export function runsText(runs: MdRun[]): string {
  return runs.map((r) => r.text).join("");
}

const ehSeparadorTabela = (l: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes("|");

/** Converte markdown em blocos estruturados. */
export function parseMarkdown(text: string): MdBlock[] {
  const linhas = String(text ?? "").replace(/\r/g, "").split("\n");
  const blocos: MdBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocos.push({ kind: "paragraph", runs: parseInline(para.join(" ")) });
      para = [];
    }
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]!.trim();

    // Tabela markdown: linha com `|`, seguida de linha separadora `|---|`.
    if (linha.includes("|") && i + 1 < linhas.length && ehSeparadorTabela(linhas[i + 1]!.trim())) {
      flush();
      const header = splitPipe(linha);
      const rows: string[][] = [];
      i += 2;
      while (i < linhas.length && linhas[i]!.includes("|") && linhas[i]!.trim()) {
        rows.push(splitPipe(linhas[i]!.trim()));
        i++;
      }
      i--;
      blocos.push({ kind: "table", header, rows });
      continue;
    }

    if (!linha) {
      flush();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = linha.match(/^(#{1,6})\s+(.*)$/))) {
      flush();
      blocos.push({ kind: "heading", level: Math.min(3, m[1]!.length) as 1 | 2 | 3, runs: parseInline(m[2]!) });
    } else if ((m = linha.match(/^[-*•]\s+(.*)$/))) {
      flush();
      blocos.push({ kind: "bullet", runs: parseInline(m[1]!) });
    } else if ((m = linha.match(/^(\d+)[.)]\s+(.*)$/))) {
      flush();
      blocos.push({ kind: "ordered", index: Number(m[1]), runs: parseInline(m[2]!) });
    } else {
      para.push(linha);
    }
  }
  flush();
  return blocos;
}
