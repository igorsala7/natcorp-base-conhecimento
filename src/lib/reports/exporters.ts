import "server-only";
import type { Paragraph as DocxParagraph, Table as DocxTable } from "docx";
import type { Worksheet as XlsxWorksheet, Fill as XlsxFill, Border as XlsxBorder, Font as XlsxFont } from "exceljs";
import type { OutFile } from "@/lib/integrations/documents";
import { LOGO_COR, LOGO_BRANCO, logoPng, logoDataUrl } from "./assets/logo";
import { MARCA, degrade, semCerquilha } from "./marca";
import type { ReportSpec, ReportBlock } from "./report-spec";
import { renderReportPdf, type BrandInfo } from "./pdf";
import { parseMarkdown, runsText, type MdRun } from "./markdown";
import { chartSvg } from "./chart-svg";
import { CHART_SUPORTE } from "@/lib/chat/chart-spec";
import { chartXml, injectDocxCharts } from "./docx-chart";

// PNG 1×1 (fallback exigido pelo Word ao embutir SVG; o Word moderno mostra o SVG).
const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Exporta um `ReportSpec` (título + blocos texto/tabela/gráfico) no FORMATO
 * pedido pelo usuário: PDF (layout de marca), Excel (xlsx), CSV, Word (docx) ou
 * PowerPoint (pptx). A mesma estrutura de blocos serve todos os formatos — só o
 * "renderizador" muda. As libs pesadas (exceljs/docx/pptxgenjs) são carregadas
 * SOB DEMANDA (import dinâmico) para não pesar o cold start das rotas.
 */

/** Nome de arquivo seguro a partir do título. */
function slug(titulo: string, ext: string): string {
  const base = (titulo || "relatorio")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .toLowerCase();
  return (base || "relatorio") + "." + ext;
}

/** Dispatcher — escolhe o gerador pelo `spec.formato`. */
export async function renderReport(spec: ReportSpec, brand: BrandInfo): Promise<OutFile> {
  switch (spec.formato) {
    case "xlsx":
      return renderXlsx(spec, brand);
    case "csv":
      return renderCsv(spec);
    case "docx":
      return renderDocx(spec, brand);
    case "pptx":
      return renderPptx(spec, brand);
    case "pdf":
    default:
      return renderReportPdf(spec, brand);
  }
}

// ── CSV ──────────────────────────────────────────────────────────────────────
// Separador SEMPRE ";" (padrão pt-BR / Excel local) — assim a vírgula decimal
// ("846,50") não quebra as colunas. Só entra aspas em ; " ou quebra de linha.
const SEP = ";";
function csvCell(v: string): string {
  return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function renderCsv(spec: ReportSpec): OutFile {
  const linhas: string[] = [csvCell(spec.titulo)];
  if (spec.subtitulo) linhas.push(csvCell(spec.subtitulo));
  linhas.push("");
  for (const b of spec.blocos) {
    if (b.tipo === "texto") {
      linhas.push(csvCell(b.texto), "");
    } else if (b.tipo === "tabela") {
      if (b.titulo) linhas.push(csvCell(b.titulo));
      linhas.push(b.colunas.map(csvCell).join(SEP));
      for (const row of b.linhas) linhas.push(b.colunas.map((_, i) => csvCell(row[i] ?? "")).join(SEP));
      linhas.push("");
    } else if (b.tipo === "grafico") {
      const g = b.grafico;
      linhas.push(csvCell(g.titulo || "Gráfico"));
      linhas.push(["Categoria", ...g.series.map((s) => s.nome)].map(csvCell).join(SEP));
      g.categorias.forEach((cat, i) =>
        linhas.push([cat, ...g.series.map((s) => String(s.valores[i] ?? ""))].map(csvCell).join(SEP)),
      );
      linhas.push("");
    }
  }
  // "sep=;" faz o Excel reconhecer o delimitador; + BOM para abrir UTF-8.
  const csv = "﻿sep=;\r\n" + linhas.join("\r\n");
  const comAviso = spec.avisos?.length ? csv + "\r\n" + spec.avisos.map((a) => "# " + a).join("\r\n") : csv;
  return { filename: slug(spec.titulo, "csv"), mimeType: "text/csv", base64: Buffer.from(comAviso, "utf8").toString("base64") };
}

/** Nome de aba único e válido (≤31 chars, sem caracteres proibidos). */
function nomeAba(base: string, usados: Set<string>): string {
  let nome = (base || "Planilha").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Planilha";
  let i = 2;
  while (usados.has(nome)) nome = (nome.slice(0, 28) + " " + i++).slice(0, 31);
  usados.add(nome);
  return nome;
}

// ── Excel (xlsx) — formatado (marca) + gráfico como IMAGEM ───────────────────
async function renderXlsx(spec: ReportSpec, brand: BrandInfo): Promise<OutFile> {
  const ExcelJS = (await import("exceljs")).default;
  const c = paleta(brand);
  const wb = new ExcelJS.Workbook();
  wb.creator = brand.marca || "Base de Conhecimento";

  const argb = (h: string) => "FF" + h;
  const headerFill: XlsxFill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(c.primary) } };
  const zebraFill: XlsxFill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(c.zebra) } };
  const thin: Partial<XlsxBorder> = { style: "thin", color: { argb: argb(c.borda) } };
  const bordas = { top: thin, left: thin, bottom: thin, right: thin };

  // Escreve uma tabela estilizada a partir de `startRow`; devolve a próxima linha livre.
  const escreverTabela = (ws: XlsxWorksheet, colunas: string[], linhas: string[][], startRow: number): number => {
    const hr = ws.getRow(startRow);
    colunas.forEach((col, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = col;
      cell.fill = headerFill;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = bordas;
    });
    hr.height = 20;
    linhas.forEach((row, r) => {
      const rr = ws.getRow(startRow + 1 + r);
      colunas.forEach((_col, i) => {
        const cell = rr.getCell(i + 1);
        const val = coerceNum(row[i] ?? "");
        cell.value = val;
        cell.border = bordas;
        if (r % 2 === 1) cell.fill = zebraFill;
        if (typeof val === "number") cell.alignment = { horizontal: "right" };
      });
    });
    colunas.forEach((col, i) => {
      const max = Math.max(String(col).length, ...linhas.map((r) => String(r[i] ?? "").length));
      const cur = ws.getColumn(i + 1).width || 0;
      ws.getColumn(i + 1).width = Math.min(58, Math.max(cur, Math.max(10, max + 2)));
    });
    return startRow + 1 + linhas.length;
  };

  const usados = new Set<string>();
  const tabelas = spec.blocos.filter((b) => b.tipo === "tabela") as Extract<ReportBlock, { tipo: "tabela" }>[];
  const textos = spec.blocos.filter((b) => b.tipo === "texto") as Extract<ReportBlock, { tipo: "texto" }>[];
  const graficos = spec.blocos.filter((b) => b.tipo === "grafico") as Extract<ReportBlock, { tipo: "grafico" }>[];
  const principal = tabelas[0]; // relatório tabular na 1ª ABA
  // Largura de mesclagem = nº de colunas da tabela principal (o cabeçalho ocupa
  // A..N mesclado, então não estica nenhuma coluna da tabela).
  const N = Math.max(1, Math.min(40, principal ? principal.colunas.length : 6));

  const ws = wb.addWorksheet(nomeAba(spec.titulo || "Relatório", usados));
  let row = 1;
  // Linha de CABEÇALHO mesclada (A..N): o texto ocupa toda a largura da tabela sem
  // alargar a coluna A (é o que o usuário pediu).
  const linhaMesclada = (texto: string, font: Partial<XlsxFont>, altura?: number) => {
    ws.mergeCells(row, 1, row, N);
    const cell = ws.getCell(row, 1);
    cell.value = texto;
    cell.font = font;
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    if (altura) ws.getRow(row).height = altura;
    row++;
  };
  linhaMesclada(spec.titulo, { bold: true, size: 18, color: { argb: argb(c.primary) } }, 26);
  if (spec.subtitulo) linhaMesclada(spec.subtitulo, { color: { argb: "FF666666" }, size: 11 });
  linhaMesclada(brand.dataHoje, { color: { argb: "FF999999" }, size: 9, italic: true });
  row++; // linha em branco

  // Textos (markdown) → cada linha mesclada, acima da tabela.
  for (const b of textos) {
    for (const mb of parseMarkdown(b.texto)) {
      if (mb.kind === "table") { row = escreverTabela(ws, mb.header, mb.rows, row) + 1; continue; }
      const txt = mb.kind === "ordered" ? `${mb.index}. ${runsText(mb.runs)}` : mb.kind === "bullet" ? `•  ${runsText(mb.runs)}` : runsText(mb.runs);
      linhaMesclada(txt, mb.kind === "heading" ? { bold: true, size: mb.level === 1 ? 14 : 12, color: { argb: argb(c.contrast) } } : { size: 11, color: { argb: "FF333333" } });
    }
    row++;
  }

  // TABELA principal, logo ABAIXO do cabeçalho, na 1ª aba.
  if (principal) {
    const headerRow = row;
    row = escreverTabela(ws, principal.colunas, principal.linhas, row);
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: Math.min(principal.colunas.length, 40) } };
    ws.views = [{ state: "frozen", ySplit: headerRow }]; // congela cabeçalho + títulos
    row += 2;
  }

  // Gráficos (imagem) abaixo da tabela, na mesma aba.
  for (const g of graficos) {
    linhaMesclada(g.grafico.titulo || "Gráfico", { bold: true, size: 12, color: { argb: argb(c.contrast) } });
    try {
      const png = await svgToPng(chartSvg(g.grafico, chartCols(c)));
      const imgId = wb.addImage({ buffer: png as unknown as Parameters<typeof wb.addImage>[0]["buffer"], extension: "png" });
      ws.addImage(imgId, { tl: { col: 0, row: row - 1 }, ext: { width: 520, height: 300 } });
      row += 17;
    } catch {
      row = escreverTabela(ws, ["Categoria", ...g.grafico.series.map((s) => s.nome)], g.grafico.categorias.map((cat, i) => [cat, ...g.grafico.series.map((s) => String(s.valores[i] ?? ""))]), row) + 1;
    }
  }

  // Tabelas ADICIONAIS → uma aba própria cada.
  for (let i = 1; i < tabelas.length; i++) {
    const b = tabelas[i]!;
    const ws2 = wb.addWorksheet(nomeAba(b.titulo || `Tabela ${i + 1}`, usados));
    escreverTabela(ws2, b.colunas, b.linhas, 1);
    ws2.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: Math.min(b.colunas.length, 40) } };
    ws2.views = [{ state: "frozen", ySplit: 1 }];
  }

  // Avisos de degradação: linha própria abaixo do conteúdo da 1ª aba.
  for (const av of spec.avisos ?? []) {
    const cel = ws.getCell(row + 1, 1);
    cel.value = "⚠ " + av;
    cel.font = { italic: true, color: { argb: "FF6B6577" }, size: 10 };
    row += 1;
  }

  const buf = await wb.xlsx.writeBuffer();
  return {
    filename: slug(spec.titulo, "xlsx"),
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    base64: Buffer.from(buf).toString("base64"),
  };
}

// ── Cores da marca (Natcorp por padrão) + utilidades de cor ──────────────────
const HEX = (h: string) => (h || "").replace("#", "").padEnd(6, "0").slice(0, 6).toUpperCase();
function mixWhite(hex: string, p: number): string {
  const n = parseInt(HEX(hex), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c: number) => Math.round(c + (255 - c) * p);
  return ((m(r) << 16) | (m(g) << 8) | m(b)).toString(16).padStart(6, "0").toUpperCase();
}
function paleta(brand: BrandInfo) {
  const primary = HEX(brand.primariaHex || "#511C76"); // roxo Natcorp
  const secondary = HEX(brand.secundariaHex || "#C95788"); // rosa
  const contrast = HEX("#2C1A63"); // azul contraste
  return { primary, secondary, contrast, zebra: mixWhite(primary, 0.94), suave: mixWhite(primary, 0.88), borda: mixWhite(primary, 0.8) };
}
/** Cores do gráfico (com #) a partir da paleta. */
function chartCols(c: ReturnType<typeof paleta>): string[] {
  return ["#" + c.primary, "#" + c.secondary, "#" + c.contrast, "#" + mixWhite(c.primary, 0.4), "#" + mixWhite(c.secondary, 0.4)];
}
/** Rasteriza um SVG em PNG (para embutir em Excel/Word). */
async function svgToPng(svg: string, width = 960): Promise<Buffer> {
  const { Resvg } = await import("@resvg/resvg-js");
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width }, background: "white" }).render().asPng());
}
/** Coage um texto a NÚMERO quando é claramente numérico (pt-BR/moeda/%); senão
 *  devolve o texto. Preserva códigos com zero à esquerda (ex.: matrícula 007). */
function coerceNum(v: string): number | string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const limpo = s.replace(/R\$|\s|%/g, "");
  if (/^-?0\d/.test(limpo)) return s; // zero à esquerda → mantém texto
  let n: number;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(limpo)) n = Number(limpo.replace(/\./g, "").replace(",", "."));
  else if (/^-?\d+(,\d+)?$/.test(limpo)) n = Number(limpo.replace(",", "."));
  else if (/^-?\d+(\.\d+)?$/.test(limpo)) n = Number(limpo);
  else return s;
  return Number.isFinite(n) ? n : s;
}

// ── Word (docx) — layout com identidade da marca ─────────────────────────────
// Tenta o gráfico NATIVO do Word (editável); em qualquer falha, cai para a imagem.
async function renderDocx(spec: ReportSpec, brand: BrandInfo): Promise<OutFile> {
  try {
    return await renderDocxImpl(spec, brand, true);
  } catch (e) {
    console.error("[docx] gráfico nativo falhou; usando imagem:", e);
    return await renderDocxImpl(spec, brand, false);
  }
}
async function renderDocxImpl(spec: ReportSpec, brand: BrandInfo, nativo: boolean): Promise<OutFile> {
  const d = await import("docx");
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
    WidthType, ShadingType, BorderStyle, AlignmentType, Footer, PageNumber, ImageRun,
  } = d;
  const c = paleta(brand);
  const FONTE = "Calibri";
  const filhos: (DocxParagraph | DocxTable)[] = [];
  const chartsNativos: { marker: string; xml: string }[] = [];

  // Cabeçalho de marca: logo + barra colorida + título + subtítulo + data.
  //
  // O logo COLORIDO aqui: o Word abre sobre branco, e a versão branca sumiria.
  // No `Header` de página (abaixo) ele repete, menor.
  filhos.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new ImageRun({
          data: logoPng(LOGO_COR),
          transformation: { width: 132, height: Math.round(132 / LOGO_COR.proporcao) },
          type: "png",
        }),
      ],
    }),
  );
  filhos.push(new Paragraph({ spacing: { after: 40 }, border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: c.primary } }, children: [] }));
  filhos.push(
    new Paragraph({
      spacing: { before: 120, after: spec.subtitulo ? 40 : 60 },
      children: [new TextRun({ text: spec.titulo, bold: true, size: 40, color: c.primary, font: FONTE })],
    }),
  );
  if (spec.subtitulo)
    filhos.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: spec.subtitulo, size: 22, color: "666666", font: FONTE })] }));
  filhos.push(
    new Paragraph({
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: c.secondary } },
      children: [new TextRun({ text: brand.dataHoje, size: 16, color: "888888", font: FONTE })],
    }),
  );

  const b1 = { style: BorderStyle.SINGLE, size: 2, color: c.borda };
  const bordasTabela = { top: b1, bottom: b1, left: b1, right: b1, insideHorizontal: b1, insideVertical: b1 };
  const cel = (texto: string, o: { header?: boolean; zebra?: boolean } = {}) =>
    new TableCell({
      shading: o.header ? { type: ShadingType.CLEAR, color: "auto", fill: c.primary } : o.zebra ? { type: ShadingType.CLEAR, color: "auto", fill: c.zebra } : undefined,
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: texto, bold: !!o.header, color: o.header ? "FFFFFF" : "222222", size: 20, font: FONTE })] })],
    });
  const tabela = (colunas: string[], linhas: string[][]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: bordasTabela,
      rows: [
        new TableRow({ tableHeader: true, children: colunas.map((h) => cel(h, { header: true })) }),
        ...linhas.map((row, i) => new TableRow({ children: colunas.map((_, j) => cel(row[j] ?? "", { zebra: i % 2 === 1 })) })),
      ],
    });
  const tituloSecao = (t: string) =>
    new Paragraph({ spacing: { before: 160, after: 80 }, heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, bold: true, size: 26, color: c.contrast, font: FONTE })] });
  const corrida = (r: MdRun) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic, color: "222222", size: 22, font: FONTE });

  // Texto vindo em MARKDOWN → títulos/negrito/itálico/listas/tabelas de verdade.
  const renderMarkdown = (texto: string) => {
    for (const b of parseMarkdown(texto)) {
      if (b.kind === "heading") {
        filhos.push(new Paragraph({
          spacing: { before: 150, after: 60 },
          heading: b.level === 1 ? HeadingLevel.HEADING_1 : b.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          children: b.runs.map((r) => new TextRun({ text: r.text, bold: true, italics: r.italic, color: b.level <= 2 ? c.contrast : c.primary, size: b.level === 1 ? 30 : b.level === 2 ? 26 : 23, font: FONTE })),
        }));
      } else if (b.kind === "bullet") {
        filhos.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 50 }, children: b.runs.map(corrida) }));
      } else if (b.kind === "ordered") {
        filhos.push(new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: b.index + ". ", bold: true, size: 22, font: FONTE, color: c.primary }), ...b.runs.map(corrida)] }));
      } else if (b.kind === "table") {
        filhos.push(tabela(b.header, b.rows));
        filhos.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      } else {
        filhos.push(new Paragraph({ spacing: { after: 140, line: 300 }, children: b.runs.map(corrida) }));
      }
    }
  };

  /** Uma linha de cartões, como TABELA de 1×N — é como o Word faz colunas. */
  const cartoes = (celulas: DocxParagraph[][]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        // Só a divisória VERTICAL, e clara: é o que separa os cartões sem
        // desenhar uma caixa em volta de cada um, que num documento de texto
        // pesaria mais que o conteúdo.
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: c.borda },
      },
      rows: [new TableRow({ children: celulas.map((ps) => new TableCell({ margins: { top: 120, bottom: 120, left: 160, right: 160 }, children: ps })) })],
    });

  for (const bl of spec.blocos) {
    if (bl.tipo === "secao") {
      // Quebra de página + faixa: no Word o divisor de assunto é o começo de uma
      // folha, senão ele vira só mais um título no meio do texto.
      filhos.push(new Paragraph({ pageBreakBefore: true, spacing: { after: 0 }, children: [] }));
      filhos.push(
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: c.primary },
          spacing: { before: 0, after: bl.subtitulo ? 0 : 200 },
          children: [new TextRun({ text: "  " + bl.titulo, bold: true, size: 34, color: "FFFFFF", font: FONTE })],
        }),
      );
      if (bl.subtitulo)
        filhos.push(
          new Paragraph({
            shading: { type: ShadingType.CLEAR, fill: c.primary },
            spacing: { after: 200 },
            children: [new TextRun({ text: "  " + bl.subtitulo, size: 20, color: "E7DCF2", font: FONTE })],
          }),
        );
    } else if (bl.tipo === "destaques") {
      if (bl.titulo) filhos.push(tituloSecao(bl.titulo));
      filhos.push(
        cartoes(
          bl.itens.map((it) => [
            new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: it.valor, bold: true, size: 44, color: semCerquilha(MARCA.destaque), font: FONTE })] }),
            new Paragraph({ spacing: { after: it.nota ? 30 : 0 }, children: [new TextRun({ text: it.rotulo, bold: true, size: 20, font: FONTE })] }),
            ...(it.nota ? [new Paragraph({ children: [new TextRun({ text: it.nota, size: 16, color: "6B6577", font: FONTE })] })] : []),
          ]),
        ),
      );
      filhos.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
    } else if (bl.tipo === "cards") {
      if (bl.titulo) filhos.push(tituloSecao(bl.titulo));
      filhos.push(
        cartoes(
          bl.itens.map((it) => [
            new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: it.titulo, bold: true, size: 22, color: c.primary, font: FONTE })] }),
            new Paragraph({ children: [new TextRun({ text: it.texto, size: 19, color: "444444", font: FONTE })] }),
          ]),
        ),
      );
      filhos.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
    } else if (bl.tipo === "texto") {
      if (bl.titulo) filhos.push(tituloSecao(bl.titulo));
      renderMarkdown(bl.texto);
    } else if (bl.tipo === "tabela") {
      if (bl.titulo) filhos.push(tituloSecao(bl.titulo));
      filhos.push(tabela(bl.colunas, bl.linhas));
      filhos.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    } else if (bl.tipo === "grafico") {
      const g = bl.grafico;
      filhos.push(tituloSecao(g.titulo || "Gráfico"));
      // Guard POR GRÁFICO: o XML nativo não sabe combo nem radar. Antes o Word só caía
      // para imagem se algo LANÇASSE, e no documento INTEIRO — então um combo saía como
      // barras. Agora só ESTE gráfico vira imagem; os outros seguem nativos (editáveis).
      const podeNativo = nativo && CHART_SUPORTE[g.tipo]?.docxNativo !== false;
      if (podeNativo) {
        // Marcador que será trocado pelo gráfico NATIVO após gerar o .docx.
        const marker = `@@KBCHART${chartsNativos.length}@@`;
        chartsNativos.push({ marker, xml: chartXml(g, chartCols(c)) });
        filhos.push(new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: marker, font: FONTE })] }));
      } else {
        try {
          let img;
          try {
            const png = await svgToPng(chartSvg(g, chartCols(c)));
            img = new ImageRun({ type: "png", data: png, transformation: { width: 500, height: 288 } });
          } catch {
            img = new ImageRun({ type: "svg", data: Buffer.from(chartSvg(g, chartCols(c))), transformation: { width: 500, height: 288 }, fallback: { type: "png", data: FALLBACK_PNG } });
          }
          filhos.push(new Paragraph({ spacing: { after: 140 }, children: [img] }));
        } catch {
          filhos.push(tabela(["Categoria", ...g.series.map((s) => s.nome)], g.categorias.map((cat, i) => [cat, ...g.series.map((s) => String(s.valores[i] ?? ""))])));
          filhos.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
        }
      }
    }
    // A nota do bloco: a linha em itálico que diz o que aquilo mostra. No PPTX
    // o mesmo campo vira notas do apresentador.
    if ("nota" in bl && bl.nota) {
      filhos.push(
        new Paragraph({
          spacing: { after: 160 },
          children: [new TextRun({ text: bl.nota, italics: true, size: 17, color: "6B6577", font: FONTE })],
        }),
      );
    }
  }

  const rodape = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: c.borda } },
        children: [
          new TextRun({ text: `${brand.marca}   •   `, size: 16, color: c.primary, font: FONTE, bold: true }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888", font: FONTE }),
        ],
      }),
    ],
  });

  // Avisos de degradação (tipo de gráfico trocado por limitação do formato). Ficam
  // NO arquivo — o usuário precisa saber que o que ele vê não é o que pediu.
  for (const a of spec.avisos ?? []) {
    filhos.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: "⚠ " + a, italics: true, size: 17, color: "6B6577", font: FONTE })] }));
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: FONTE, size: 22 } } } },
    sections: [{ properties: {}, footers: { default: rodape }, children: filhos }],
  });
  let buf: Buffer = Buffer.from(await Packer.toBuffer(doc));
  // Injeta os gráficos NATIVOS (troca os marcadores). Se der erro, o wrapper
  // renderDocx cai para a versão com imagem.
  if (nativo && chartsNativos.length) buf = await injectDocxCharts(buf, chartsNativos);
  return {
    filename: slug(spec.titulo, "docx"),
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    base64: buf.toString("base64"),
  };
}

// ── PowerPoint (pptx) — layout widescreen com identidade da marca ────────────
async function renderPptx(spec: ReportSpec, brand: BrandInfo): Promise<OutFile> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.33" × 7.5" (16:9)
  const c = paleta(brand);
  const FONTE = "Calibri";
  const W = 13.33;

  // Master das telas de conteúdo: barra superior + acento + rodapé + nº do slide.
  pres.defineSlideMaster({
    title: "NATCORP",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: "100%", h: 0.62, fill: { color: c.primary } } },
      { rect: { x: 0, y: 0.62, w: "100%", h: 0.06, fill: { color: c.secondary } } },
      { rect: { x: 0, y: 7.18, w: "100%", h: 0.32, fill: { color: c.contrast } } },
      { text: { text: brand.marca, options: { x: 0.4, y: 7.18, w: 9, h: 0.32, color: "FFFFFF", fontSize: 9, align: "left", valign: "middle", fontFace: FONTE } } },
      // O logo na barra superior, à direita — é onde o deck o põe em todo slide
      // de conteúdo. Branco, porque a barra é da cor da marca.
      {
        image: {
          x: W - 1.75, y: 0.13, w: 1.35, h: 1.35 / LOGO_BRANCO.proporcao,
          data: logoDataUrl(LOGO_BRANCO),
        },
      },
    ],
    slideNumber: { x: 12.4, y: 7.2, w: 0.6, h: 0.28, color: "FFFFFF", fontSize: 9, align: "right", fontFace: FONTE },
  });

  const chartColors = [c.primary, c.secondary, c.contrast, mixWhite(c.primary, 0.4), mixWhite(c.secondary, 0.4)];
  // Tipos nativos do PowerPoint. Antes esta tabela cobria 6 e o `|| "bar"` abaixo
  // transformava radar/empilhado/combo em barras SEM AVISO. Agora cobre o que o PPT
  // sabe desenhar; o que ele não sabe já chegou aqui trocado por `degradarTipo`.
  const tipoChart: Record<string, string> = {
    colunas: "bar", colunas_emp: "bar", barras: "bar", barras_emp: "bar",
    linha: "line", area: "area", area_emp: "area", combo: "bar",
    pizza: "pie", rosca: "doughnut", radar: "radar",
  };
  const empilhadoPpt = new Set(["colunas_emp", "barras_emp", "area_emp"]);

  /**
   * A faixa em degradê num slide.
   *
   * O pptxgenjs não faz degradê em forma. São 60 retângulos colados — num slide
   * de 13,33" dão 0,22" cada, que ninguém separa a olho.
   *
   * Duas armadilhas, e as duas apareceram na primeira tentativa como listras
   * escuras verticais:
   *
   *  · `line: { width: 0 }` NÃO desliga a borda. No OOXML largura zero vira
   *    *hairline* — a menor linha que o renderizador consegue desenhar, que é
   *    1px. Sessenta retângulos viravam sessenta traços. O interruptor é
   *    `line: { type: "none" }`.
   *  · a conversão polegada→EMU arredonda, então retângulos exatamente colados
   *    deixam fresta. A sobreposição de meio passo custa nada e fecha.
   */
  const faixaPpt = (sl: ReturnType<typeof pres.addSlide>, y: number, h: number) => {
    const n = 60;
    const passo = W / n;
    degrade(n).forEach((hex: string, i: number) => {
      sl.addShape(pres.ShapeType.rect, {
        x: i * passo,
        y,
        w: passo * 1.5,
        h,
        fill: { color: semCerquilha(hex) },
        line: { type: "none" },
      });
    });
  };

  /**
   * A CAPA — refeita em 17/08.
   *
   * Ela era roxo CHAPADO enquanto o PDF e os slides de seção já tinham o degradê
   * da marca: a primeira coisa que se vê era a única que não parecia material da
   * Natcorp ("o primeiro slide não está com um novo layout" — Igor).
   *
   * O espaçamento também mudou. Antes o título estava em y=2.0, o filete em 3.2 e
   * o subtítulo em 3.5 — tudo empilhado no meio, com um vazio grande embaixo. A
   * versão nova ancora o bloco mais abaixo e abre respiro entre as três linhas:
   * capa formal é meia página vazia de propósito, não conteúdo espremido.
   */
  const capa = pres.addSlide();
  faixaPpt(capa, 0, 7.5);
  capa.addImage({ x: 0.9, y: 0.75, w: 2.1, h: 2.1 / LOGO_BRANCO.proporcao, data: logoDataUrl(LOGO_BRANCO) });
  capa.addShape(pres.ShapeType.rect, { x: 0.9, y: 3.35, w: 1.3, h: 0.06, fill: { color: c.secondary }, line: { type: "none" } });
  capa.addText(spec.titulo, {
    x: 0.9, y: 3.75, w: W - 3.2, h: 1.4,
    fontSize: 34, bold: true, color: "FFFFFF", align: "left", valign: "top",
    lineSpacingMultiple: 1.15, fontFace: FONTE,
  });
  if (spec.subtitulo)
    capa.addText(spec.subtitulo, {
      x: 0.9, y: 5.3, w: W - 3.2, h: 0.8,
      fontSize: 15, color: "E7DCF2", align: "left", valign: "top", lineSpacingMultiple: 1.3, fontFace: FONTE,
    });
  capa.addText(`${brand.marca}   ·   ${brand.dataHoje}`, {
    x: 0.9, y: 6.75, w: W - 1.8, h: 0.4, fontSize: 11, color: "C9B8DC", align: "left", fontFace: FONTE,
  });


  for (const b of spec.blocos) {
    /**
     * SEÇÃO ocupa o slide INTEIRO e não usa o master.
     *
     * Um divisor de assunto com a mesma barra e o mesmo rodapé dos slides de
     * conteúdo não divide nada — ele precisa parecer outra coisa. É o mesmo
     * recurso do deck, onde as aberturas de capítulo são a faixa escura cheia.
     */
    if (b.tipo === "secao") {
      const sec = pres.addSlide();
      faixaPpt(sec, 0, 7.5);
      sec.addImage({ x: W - 2.0, y: 0.4, w: 1.5, h: 1.5 / LOGO_BRANCO.proporcao, data: logoDataUrl(LOGO_BRANCO) });
      sec.addShape(pres.ShapeType.rect, { x: 0.9, y: 3.05, w: 1.3, h: 0.06, fill: { color: c.secondary }, line: { width: 0 } });
      sec.addText(b.titulo, { x: 0.9, y: 3.3, w: W - 1.8, h: 1.0, fontSize: 34, bold: true, color: "FFFFFF", fontFace: FONTE });
      if (b.subtitulo) sec.addText(b.subtitulo, { x: 0.9, y: 4.35, w: W - 1.8, h: 0.6, fontSize: 15, color: "E7DCF2", fontFace: FONTE });
      if (b.nota) sec.addNotes(b.nota);
      continue;
    }

    const slide = pres.addSlide({ masterName: "NATCORP" });
    const tituloSlide = (t: string) =>
      slide.addText(t, { x: 0.4, y: 0.02, w: W - 1.6, h: 0.6, fontSize: 18, bold: true, color: "FFFFFF", align: "left", valign: "middle", fontFace: FONTE });

    if (b.tipo === "texto") {
      tituloSlide(spec.titulo);
      // Markdown → runs com título/negrito/itálico/lista (o modelo escreve em md).
      const objs: Array<{ text: string; options: Record<string, unknown> }> = [];
      const blocos = parseMarkdown(b.texto);
      blocos.forEach((mb) => {
        if (mb.kind === "table") {
          objs.push({ text: mb.header.join("   |   "), options: { bold: true, fontSize: 12, color: c.contrast, fontFace: FONTE, breakLine: true } });
          mb.rows.forEach((r) => objs.push({ text: r.join("   |   "), options: { fontSize: 12, color: "333333", fontFace: FONTE, breakLine: true } }));
          return;
        }
        const cab = mb.kind === "heading";
        const base = cab ? { bold: true, fontSize: mb.level === 1 ? 20 : 17, color: c.contrast } : { fontSize: 15, color: "333333" };
        mb.runs.forEach((r, ri) => {
          const ult = ri === mb.runs.length - 1;
          objs.push({
            text: (mb.kind === "ordered" && ri === 0 ? mb.index + ". " : "") + r.text,
            options: {
              ...base,
              bold: (base as { bold?: boolean }).bold || r.bold || false,
              italic: r.italic || false,
              fontFace: FONTE,
              bullet: mb.kind === "bullet" && ri === 0 ? { code: "2022" } : false,
              breakLine: ult,
              paraSpaceAfter: ult ? (cab ? 4 : 8) : 0,
            },
          });
        });
      });
      /**
       * Respiro. "Letras muito coladas, linhas muito grudadas" (Igor, 17/08).
       *
       * O pptxgenjs não aplica entrelinha por padrão: 15pt de texto com
       * entrelinha 1,0 num slide de 13" fica denso como corpo de contrato.
       * 1,35 é o que separa as linhas sem virar espaçamento duplo — e a margem
       * lateral abriu de 0,7" para 0,9", porque texto que encosta na borda lê
       * como se tivesse sido cortado.
       */
      slide.addText(objs.length ? objs : [{ text: b.texto, options: { fontSize: 15, color: "333333", fontFace: FONTE } }], {
        x: 0.9, y: 1.15, w: W - 1.8, h: 5.6, valign: "top", lineSpacingMultiple: 1.35,
      });
    } else if (b.tipo === "destaques") {
      // Números grandes lado a lado. Larguras iguais: colunas de tamanhos
      // diferentes deixam de parecer uma faixa e viram três coisas soltas.
      tituloSlide(b.titulo || spec.titulo);
      const n = b.itens.length;
      const gap = 0.35;
      const w = (W - 1.0 - gap * (n - 1)) / n;
      b.itens.forEach((it, i) => {
        const x = 0.5 + i * (w + gap);
        slide.addShape(pres.ShapeType.roundRect, { x, y: 2.0, w, h: 2.6, fill: { color: "F7F5FA" }, line: { color: c.borda, width: 0.5 }, rectRadius: 0.06 });
        slide.addShape(pres.ShapeType.rect, { x, y: 2.0, w, h: 0.07, fill: { color: c.secondary }, line: { width: 0 } });
        slide.addText(it.valor, { x: x + 0.25, y: 2.35, w: w - 0.5, h: 0.9, fontSize: 40, bold: true, color: semCerquilha(MARCA.destaque), fontFace: FONTE });
        slide.addText(it.rotulo, { x: x + 0.25, y: 3.25, w: w - 0.5, h: 0.4, fontSize: 14, bold: true, color: "333333", fontFace: FONTE });
        if (it.nota) slide.addText(it.nota, { x: x + 0.25, y: 3.65, w: w - 0.5, h: 0.7, fontSize: 11, color: "6B6577", fontFace: FONTE });
      });
    } else if (b.tipo === "cards") {
      tituloSlide(b.titulo || spec.titulo);
      const n = b.itens.length;
      const gap = 0.35;
      const w = (W - 1.0 - gap * (n - 1)) / n;
      b.itens.forEach((it, i) => {
        const x = 0.5 + i * (w + gap);
        slide.addShape(pres.ShapeType.roundRect, { x, y: 1.6, w, h: 3.4, fill: { color: "FFFFFF" }, line: { color: c.borda, width: 0.75 }, rectRadius: 0.06 });
        // O losango da marca como marcador do cartão — `diamond` é nativo aqui,
        // sem a conversão de centro que o pdf-lib exige.
        slide.addShape(pres.ShapeType.diamond, { x: x + 0.25, y: 1.9, w: 0.26, h: 0.26, fill: { color: c.primary }, line: { width: 0 } });
        slide.addText(it.titulo, { x: x + 0.62, y: 1.85, w: w - 0.9, h: 0.4, fontSize: 15, bold: true, color: "333333", fontFace: FONTE });
        slide.addText(it.texto, { x: x + 0.25, y: 2.45, w: w - 0.5, h: 2.3, fontSize: 12, color: "6B6577", valign: "top", lineSpacingMultiple: 1.3, fontFace: FONTE });
      });
    } else if (b.tipo === "tabela") {
      tituloSlide(b.titulo || "Tabela");
      const header = b.colunas.map((col) => ({ text: col, options: { bold: true, color: "FFFFFF", fill: { color: c.primary }, align: "center", valign: "middle", fontFace: FONTE } }));
      /**
       * QUANTAS LINHAS CABEM DE VERDADE NUM SLIDE.
       *
       * O corte era 24 e o slide transbordava: as últimas linhas saíam pela
       * borda de baixo e o aviso "+N linhas", posicionado num `y` fixo de 6.75",
       * caía POR CIMA dos dados. Duas coisas erradas pelo mesmo motivo — os
       * números eram chute, não conta.
       *
       * Agora é conta: da altura útil (do topo do conteúdo até o rodapé do
       * master, menos a linha do aviso) dividida pela altura da linha. Se
       * alguém mexer no master ou no tamanho da fonte, o corte acompanha.
       *
       * E é o formato decidindo a densidade, como o Igor escolheu: quem precisa
       * das 300 linhas abre o Excel; num slide, tabela que não cabe não informa,
       * atrapalha.
       */
      const LINHA_H = 0.3;
      const TOPO = 1.0;
      const RODAPE = 7.18; // início da barra do master
      const cabem = Math.max(3, Math.floor((RODAPE - TOPO - 0.4) / LINHA_H) - 1); // −1 do cabeçalho
      const mostradas = b.linhas.slice(0, cabem);
      const linhas = mostradas.map((row, i) =>
        b.colunas.map((_, j) => ({ text: row[j] ?? "", options: { fill: { color: i % 2 ? c.zebra : "FFFFFF" }, color: "333333", fontFace: FONTE } })),
      );
      slide.addTable([header, ...linhas], { x: 0.5, y: TOPO, w: W - 1.0, fontSize: 11, border: { type: "solid", color: c.borda, pt: 0.5 }, valign: "middle", rowH: LINHA_H });
      if (b.linhas.length > cabem) {
        // Logo ABAIXO da última linha desenhada, não num `y` fixo: com menos
        // linhas que o teto, um `y` fixo deixaria o aviso solto no meio do vazio.
        const y = TOPO + (mostradas.length + 1) * LINHA_H + 0.08;
        slide.addText(`+${b.linhas.length - cabem} linhas — a tabela completa está na versão Excel`, {
          x: 0.5, y, w: W - 1, h: 0.28, fontSize: 9, italic: true, color: "8A8A8A", fontFace: FONTE,
        });
      }
    } else if (b.tipo === "grafico") {
      const g = b.grafico;
      tituloSlide(g.titulo || "Gráfico");
      const ct = tipoChart[g.tipo] || "bar";
      try {
        const data = g.series.map((s) => ({ name: s.nome, labels: g.categorias, values: s.valores }));
        const ehFatia = g.tipo === "pizza" || g.tipo === "rosca";
        /**
         * LEGENDA E VALORES — o gráfico saía mudo.
         *
         * A regra anterior era `showLegend: g.series.length > 1`, escrita
         * pensando em barras, onde a legenda nomeia SÉRIES. Numa pizza existe uma
         * série só e são as CATEGORIAS que carregam o sentido — então a condição
         * excluía justamente o tipo que mais precisa dela. O resultado era uma
         * roda de fatias coloridas sem dizer qual filial é qual.
         *
         * `showValue` estava fixo em `false`: nenhum gráfico mostrava número.
         * Numa apresentação isso obriga quem apresenta a ler o valor em voz alta
         * ou a mandar todo mundo abrir o Excel.
         *
         * O teto de 24 rótulos é o que impede o remédio de virar doença: 12
         * categorias × 3 séries são 36 números empilhados sobre as barras, e aí
         * o gráfico fica menos legível do que sem nada.
         */
        const rotulos = g.categorias.length * g.series.length;
        slide.addChart(ct as never, data, {
          x: 0.6, y: 1.0, w: W - 1.2, h: 5.5,
          barDir: g.tipo === "colunas" || g.tipo === "colunas_emp" || g.tipo === "combo" ? "col" : "bar",
          ...(empilhadoPpt.has(g.tipo) ? { barGrouping: "stacked", barOverlapPct: 100 } : {}),
          chartColors,
          showLegend: ehFatia || g.series.length > 1,
          legendPos: "b",
          legendFontSize: 11,
          // Fatia mostra PORCENTAGEM (é o que a pizza responde); o resto, o valor.
          /**
           * Rótulo FORA da fatia, em texto escuro.
           *
           * Dentro exigiria escolher entre branco e escuro sem saber a cor da
           * fatia: a paleta alterna claro e escuro de propósito (para sobreviver
           * à impressão em preto-e-branco), então qualquer cor fixa some em
           * metade das fatias. Fora, o fundo é sempre o branco do slide.
           */
          ...(ehFatia
            ? { showPercent: true, showValue: false, dataLabelFontSize: 11, dataLabelColor: semCerquilha(MARCA.texto), dataLabelPosition: "outEnd" }
            : { showValue: rotulos <= 24, dataLabelFontSize: 10, dataLabelColor: semCerquilha(MARCA.textoSuave), dataLabelPosition: "outEnd" }),
          showTitle: false,
          catAxisLabelFontSize: 11,
          valAxisLabelFontSize: 11,
          catAxisLabelFontFace: FONTE, valAxisLabelFontFace: FONTE, legendFontFace: FONTE,
          dataLabelFontFace: FONTE,
        });
      } catch {
        const header = [{ text: "Categoria", options: { bold: true, color: "FFFFFF", fill: { color: c.primary } } }, ...g.series.map((s) => ({ text: s.nome, options: { bold: true, color: "FFFFFF", fill: { color: c.primary } } }))];
        const linhas = g.categorias.map((cat, i) => [{ text: cat }, ...g.series.map((s) => ({ text: String(s.valores[i] ?? "") }))]);
        slide.addTable([header, ...linhas], { x: 0.5, y: 1.0, w: W - 1, fontSize: 11, border: { type: "solid", color: c.borda, pt: 0.5 } });
      }
    }
    // A NOTA vira NOTAS DO APRESENTADOR — o campo que carrega a narrativa sem
    // custar uma segunda passada de IA. No PDF e no Word ela é a linha em
    // itálico sob o bloco; aqui, o que a pessoa lê enquanto apresenta.
    if ("nota" in b && b.nota) slide.addNotes(b.nota);
  }

  // Avisos de degradação num slide final — melhor dizer do que deixar o usuário
  // achar que o gráfico saiu como pediu.
  if (spec.avisos?.length) {
    const s = pres.addSlide({ masterName: "NATCORP" });
    s.addText("Observações", { x: 0.5, y: 0.35, w: W - 1, h: 0.5, fontSize: 22, bold: true, color: c.primary, fontFace: FONTE });
    s.addText(spec.avisos.map((a) => ({ text: "⚠ " + a, options: { breakLine: true } })), { x: 0.5, y: 1.1, w: W - 1, h: 4, fontSize: 13, color: "555555", fontFace: FONTE });
  }
  const buf = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
  return {
    filename: slug(spec.titulo, "pptx"),
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    base64: Buffer.from(buf).toString("base64"),
  };
}
