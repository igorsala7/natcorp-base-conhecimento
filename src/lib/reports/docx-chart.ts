import "server-only";
import JSZip from "jszip";
import type { ChartSpec } from "@/lib/chat/chart-spec";

/**
 * GRÁFICO NATIVO do Word (DrawingML chart). A lib `docx` não gera gráficos, então:
 *  1) o texto do documento recebe um marcador único onde o gráfico deve entrar;
 *  2) depois de gerado o .docx, injetamos as partes OOXML do gráfico e trocamos o
 *     marcador por um <w:drawing> que referencia o chart — resultando num gráfico
 *     EDITÁVEL no Word (não uma imagem).
 * Em qualquer falha, o chamador cai para a imagem (nunca corrompe o arquivo).
 */

const C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hex = (c: string) => (c || "#511C76").replace("#", "").toUpperCase().slice(0, 6);
const colLetra = (i: number) => String.fromCharCode(66 + Math.min(i, 23)); // B, C, D…

function strCache(vals: string[]): string {
  return `<c:strCache><c:ptCount val="${vals.length}"/>` + vals.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join("") + "</c:strCache>";
}
function numCache(vals: number[]): string {
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${vals.length}"/>` + vals.map((v, i) => `<c:pt idx="${i}"><c:v>${Number.isFinite(v) ? v : 0}</c:v></c:pt>`).join("") + "</c:numCache>";
}
const catRef = (cats: string[]) => `<c:cat><c:strRef><c:f>Sheet1!$A$2:$A$${cats.length + 1}</c:f>${strCache(cats)}</c:strRef></c:cat>`;
const valRef = (vals: number[], col: number) => `<c:val><c:numRef><c:f>Sheet1!$${colLetra(col)}$2:$${colLetra(col)}$${vals.length + 1}</c:f>${numCache(vals)}</c:numRef></c:val>`;
const txRef = (nome: string, col: number) => `<c:tx><c:strRef><c:f>Sheet1!$${colLetra(col)}$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${esc(nome)}</c:v></c:pt></c:strCache></c:strRef></c:tx>`;

/** XML do chartSpace (gráfico nativo) para uma spec + cores da marca. */
export function chartXml(spec: ChartSpec, colors: string[]): string {
  const cats = spec.categorias;
  const cor = (i: number) => hex(colors[i % colors.length]!);
  const tipo = spec.tipo;
  const AX1 = 111111111, AX2 = 222222222;

  const titulo = spec.titulo
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr b="1" sz="1300"><a:solidFill><a:srgbClr val="2C1A63"/></a:solidFill></a:defRPr></a:pPr><a:r><a:rPr lang="pt-BR" b="1" sz="1300"><a:solidFill><a:srgbClr val="2C1A63"/></a:solidFill></a:rPr><a:t>${esc(spec.titulo)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
    : `<c:autoTitleDeleted val="1"/>`;

  let plot = "";
  let axes = "";
  if (tipo === "pizza" || tipo === "rosca") {
    const s = spec.series[0];
    const vals = (s?.valores ?? []).map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0));
    const dpts = cats.map((_c, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${cor(i)}"/></a:solidFill></c:spPr></c:dPt>`).join("");
    const tag = tipo === "rosca" ? "doughnutChart" : "pieChart";
    plot = `<c:${tag}><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${txRef(s?.nome ?? "Série", 0)}${dpts}<c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/></c:dLbls>${catRef(cats)}${valRef(vals, 0)}</c:ser>${tipo === "rosca" ? '<c:holeSize val="50"/>' : ""}</c:${tag}>`;
  } else {
    const sers = spec.series
      .map((s, si) => {
        const vals = s.valores.map((v) => (Number.isFinite(v) ? v : 0));
        const linhaSmooth = tipo === "linha" || tipo === "area" ? '<c:smooth val="0"/>' : "";
        return `<c:ser><c:idx val="${si}"/><c:order val="${si}"/>${txRef(s.nome, si)}<c:spPr><a:solidFill><a:srgbClr val="${cor(si)}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="${cor(si)}"/></a:solidFill></a:ln></c:spPr>${catRef(cats)}${valRef(vals, si)}${linhaSmooth}</c:ser>`;
      })
      .join("");
    if (tipo === "linha") plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:marker val="1"/><c:axId val="${AX1}"/><c:axId val="${AX2}"/></c:lineChart>`;
    else if (tipo === "area") plot = `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:axId val="${AX1}"/><c:axId val="${AX2}"/></c:areaChart>`;
    else {
      const dir = tipo === "barras" ? "bar" : "col";
      plot = `<c:barChart><c:barDir val="${dir}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers}<c:gapWidth val="90"/><c:axId val="${AX1}"/><c:axId val="${AX2}"/></c:barChart>`;
    }
    const horiz = tipo === "barras";
    axes =
      `<c:catAx><c:axId val="${AX1}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${horiz ? "l" : "b"}"/><c:crossAx val="${AX2}"/></c:catAx>` +
      `<c:valAx><c:axId val="${AX2}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${horiz ? "b" : "l"}"/><c:crossAx val="${AX1}"/></c:valAx>`;
  }

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<c:chartSpace xmlns:c="${C}" xmlns:a="${A}" xmlns:r="${R}"><c:chart>${titulo}<c:plotArea><c:layout/>${plot}${axes}</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`
  );
}

/** Run com o <w:drawing> que referencia o chart (substitui o marcador). */
function drawingRun(rId: string, id: number): string {
  return (
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="${WP}">` +
    `<wp:extent cx="5486400" cy="3200400"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${id}" name="Gráfico ${id}"/><wp:cNvGraphicFramePr/>` +
    `<a:graphic xmlns:a="${A}"><a:graphicData uri="${C}"><c:chart xmlns:c="${C}" xmlns:r="${R}" r:id="${rId}"/></a:graphicData></a:graphic>` +
    `</wp:inline></w:drawing></w:r>`
  );
}

/** Injeta os gráficos nativos no .docx já gerado (troca cada marcador pelo chart). */
export async function injectDocxCharts(buf: Buffer, charts: { marker: string; xml: string }[]): Promise<Buffer> {
  if (!charts.length) return buf;
  const zip = await JSZip.loadAsync(buf);
  let docXml = await zip.file("word/document.xml")!.async("string");
  let rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
  let ct = await zip.file("[Content_Types].xml")!.async("string");

  charts.forEach((ch, k) => {
    const i = k + 1;
    const rId = "rIdKbChart" + i;
    zip.file(`word/charts/chart${i}.xml`, ch.xml);
    zip.file(
      `word/charts/_rels/chart${i}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
    );
    rels = rels.replace("</Relationships>", `<Relationship Id="${rId}" Type="${R}/chart" Target="charts/chart${i}.xml"/></Relationships>`);
    ct = ct.replace("</Types>", `<Override PartName="/word/charts/chart${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
    // Troca o RUN que contém o marcador pelo run do desenho (mantém o parágrafo).
    const re = new RegExp(`<w:r\\b[^>]*>(?:(?!</w:r>)[\\s\\S])*?${ch.marker}(?:(?!</w:r>)[\\s\\S])*?</w:r>`);
    docXml = docXml.replace(re, drawingRun(rId, i));
  });

  zip.file("word/document.xml", docXml);
  zip.file("word/_rels/document.xml.rels", rels);
  zip.file("[Content_Types].xml", ct);
  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}
