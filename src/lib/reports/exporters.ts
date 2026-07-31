import "server-only";
import type { Paragraph as DocxParagraph, Table as DocxTable } from "docx";
import type { Worksheet as XlsxWorksheet, Fill as XlsxFill, Border as XlsxBorder } from "exceljs";
import type { OutFile } from "@/lib/integrations/documents";
import type { ReportSpec } from "./report-spec";
import { renderReportPdf, type BrandInfo } from "./pdf";
import { parseMarkdown, runsText, type MdRun } from "./markdown";
import { chartSvg } from "./chart-svg";
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
function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
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
      linhas.push(b.colunas.map(csvCell).join(","));
      for (const row of b.linhas) linhas.push(b.colunas.map((_, i) => csvCell(row[i] ?? "")).join(","));
      linhas.push("");
    } else if (b.tipo === "grafico") {
      const g = b.grafico;
      linhas.push(csvCell(g.titulo || "Gráfico"));
      linhas.push(["Categoria", ...g.series.map((s) => s.nome)].map(csvCell).join(","));
      g.categorias.forEach((cat, i) =>
        linhas.push([cat, ...g.series.map((s) => String(s.valores[i] ?? ""))].map(csvCell).join(",")),
      );
      linhas.push("");
    }
  }
  // BOM p/ o Excel abrir UTF-8 corretamente.
  const csv = "﻿" + linhas.join("\r\n");
  return { filename: slug(spec.titulo, "csv"), mimeType: "text/csv", base64: Buffer.from(csv, "utf8").toString("base64") };
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
  // Aba principal: título + subtítulo + textos + gráficos (imagem).
  const capa = wb.addWorksheet(nomeAba("Relatório", usados));
  capa.mergeCells(1, 1, 1, 6);
  const tCell = capa.getCell(1, 1);
  tCell.value = spec.titulo;
  tCell.font = { bold: true, size: 18, color: { argb: argb(c.primary) } };
  capa.getRow(1).height = 26;
  let row = 2;
  if (spec.subtitulo) {
    capa.mergeCells(row, 1, row, 6);
    const sc = capa.getCell(row, 1);
    sc.value = spec.subtitulo;
    sc.font = { color: { argb: "FF666666" }, size: 11 };
    row++;
  }
  capa.getCell(row, 1).value = brand.dataHoje;
  capa.getCell(row, 1).font = { color: { argb: "FF999999" }, size: 9, italic: true };
  row += 2;

  for (const b of spec.blocos) {
    if (b.tipo === "texto") {
      for (const mb of parseMarkdown(b.texto)) {
        if (mb.kind === "table") {
          row = escreverTabela(capa, mb.header, mb.rows, row) + 1;
          continue;
        }
        const txt = mb.kind === "ordered" ? `${mb.index}. ${runsText(mb.runs)}` : mb.kind === "bullet" ? `•  ${runsText(mb.runs)}` : runsText(mb.runs);
        const cell = capa.getCell(row, 1);
        cell.value = txt;
        if (mb.kind === "heading") cell.font = { bold: true, size: mb.level === 1 ? 14 : 12, color: { argb: argb(c.contrast) } };
        row++;
      }
      row++;
    } else if (b.tipo === "grafico") {
      const g = b.grafico;
      const hc = capa.getCell(row, 1);
      hc.value = g.titulo || "Gráfico";
      hc.font = { bold: true, size: 12, color: { argb: argb(c.contrast) } };
      row++;
      try {
        const png = await svgToPng(chartSvg(g, chartCols(c)));
        const imgId = wb.addImage({ buffer: png as unknown as Parameters<typeof wb.addImage>[0]["buffer"], extension: "png" });
        capa.addImage(imgId, { tl: { col: 0, row: row - 1 }, ext: { width: 520, height: 300 } });
        row += 17;
      } catch {
        row = escreverTabela(capa, ["Categoria", ...g.series.map((s) => s.nome)], g.categorias.map((cat, i) => [cat, ...g.series.map((s) => String(s.valores[i] ?? ""))]), row) + 1;
      }
    }
  }
  capa.getColumn(1).width = Math.max(capa.getColumn(1).width || 0, 26);

  // Cada tabela → aba própria estilizada (cabeçalho fixo + filtro).
  let n = 0;
  for (const b of spec.blocos) {
    if (b.tipo !== "tabela") continue;
    n++;
    const ws = wb.addWorksheet(nomeAba(b.titulo || `Tabela ${n}`, usados));
    escreverTabela(ws, b.colunas, b.linhas, 1);
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: b.colunas.length } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
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

  // Cabeçalho de marca: barra colorida + título + subtítulo + data.
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

  for (const bl of spec.blocos) {
    if (bl.tipo === "texto") {
      renderMarkdown(bl.texto);
    } else if (bl.tipo === "tabela") {
      if (bl.titulo) filhos.push(tituloSecao(bl.titulo));
      filhos.push(tabela(bl.colunas, bl.linhas));
      filhos.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    } else if (bl.tipo === "grafico") {
      const g = bl.grafico;
      filhos.push(tituloSecao(g.titulo || "Gráfico"));
      if (nativo) {
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
    ],
    slideNumber: { x: 12.4, y: 7.2, w: 0.6, h: 0.28, color: "FFFFFF", fontSize: 9, align: "right", fontFace: FONTE },
  });

  const chartColors = [c.primary, c.secondary, c.contrast, mixWhite(c.primary, 0.4), mixWhite(c.secondary, 0.4)];
  const tipoChart: Record<string, string> = { colunas: "bar", barras: "bar", linha: "line", area: "area", pizza: "pie", rosca: "doughnut" };

  // Capa (fundo da marca + acento).
  const capa = pres.addSlide();
  capa.background = { color: c.primary };
  capa.addShape(pres.ShapeType.rect, { x: 0.9, y: 3.2, w: 4.2, h: 0.12, fill: { color: c.secondary } });
  capa.addText(spec.titulo, { x: 0.9, y: 2.0, w: W - 1.8, h: 1.1, fontSize: 40, bold: true, color: "FFFFFF", align: "left", fontFace: FONTE });
  if (spec.subtitulo) capa.addText(spec.subtitulo, { x: 0.9, y: 3.5, w: W - 1.8, h: 0.6, fontSize: 18, color: "F0E8F6", align: "left", fontFace: FONTE });
  capa.addText(`${brand.marca}   ·   ${brand.dataHoje}`, { x: 0.9, y: 6.6, w: W - 1.8, h: 0.4, fontSize: 12, color: "E7DCF2", align: "left", fontFace: FONTE });

  for (const b of spec.blocos) {
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
      slide.addText(objs.length ? objs : [{ text: b.texto, options: { fontSize: 15, color: "333333", fontFace: FONTE } }], { x: 0.7, y: 1.0, w: W - 1.4, h: 5.9, valign: "top" });
    } else if (b.tipo === "tabela") {
      tituloSlide(b.titulo || "Tabela");
      const header = b.colunas.map((col) => ({ text: col, options: { bold: true, color: "FFFFFF", fill: { color: c.primary }, align: "center", valign: "middle", fontFace: FONTE } }));
      const linhas = b.linhas.slice(0, 24).map((row, i) =>
        b.colunas.map((_, j) => ({ text: row[j] ?? "", options: { fill: { color: i % 2 ? c.zebra : "FFFFFF" }, color: "333333", fontFace: FONTE } })),
      );
      slide.addTable([header, ...linhas], { x: 0.5, y: 1.0, w: W - 1.0, fontSize: 11, border: { type: "solid", color: c.borda, pt: 0.5 }, valign: "middle", rowH: 0.3 });
      if (b.linhas.length > 24) slide.addText(`+${b.linhas.length - 24} linhas — veja a versão Excel/CSV`, { x: 0.5, y: 6.75, w: W - 1, h: 0.3, fontSize: 9, italic: true, color: "999999", fontFace: FONTE });
    } else if (b.tipo === "grafico") {
      const g = b.grafico;
      tituloSlide(g.titulo || "Gráfico");
      const ct = tipoChart[g.tipo] || "bar";
      try {
        const data = g.series.map((s) => ({ name: s.nome, labels: g.categorias, values: s.valores }));
        slide.addChart(ct as never, data, {
          x: 0.6, y: 1.0, w: W - 1.2, h: 5.7,
          barDir: g.tipo === "colunas" ? "col" : "bar",
          chartColors, showLegend: g.series.length > 1, legendPos: "b",
          showValue: false, showTitle: false,
          catAxisLabelFontFace: FONTE, valAxisLabelFontFace: FONTE, legendFontFace: FONTE,
        });
      } catch {
        const header = [{ text: "Categoria", options: { bold: true, color: "FFFFFF", fill: { color: c.primary } } }, ...g.series.map((s) => ({ text: s.nome, options: { bold: true, color: "FFFFFF", fill: { color: c.primary } } }))];
        const linhas = g.categorias.map((cat, i) => [{ text: cat }, ...g.series.map((s) => ({ text: String(s.valores[i] ?? "") }))]);
        slide.addTable([header, ...linhas], { x: 0.5, y: 1.0, w: W - 1, fontSize: 11, border: { type: "solid", color: c.borda, pt: 0.5 } });
      }
    }
  }

  const buf = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
  return {
    filename: slug(spec.titulo, "pptx"),
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    base64: Buffer.from(buf).toString("base64"),
  };
}
