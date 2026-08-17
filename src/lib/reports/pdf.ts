import "server-only";
import { PDFDocument, StandardFonts, rgb, degrees, type PDFImage, type PDFPage, type PDFFont, type RGB } from "pdf-lib";
import type { OutFile } from "@/lib/integrations/documents";
import type { ReportSpec, ReportBlock } from "./report-spec";
import type { ChartSpec } from "@/lib/chat/chart-spec";
import { medianOf, linReg } from "@/lib/chat/chart-spec";
import { chartSvg } from "./chart-svg";
import { parseMarkdown, type MdRun } from "./markdown";
import { tokenizarRuns } from "./tokens";
import { winAnsiSafe } from "./winansi";
import { MARCA, CORES_GRAFICO, degrade, paraUnidade, ROSA, ROXO as ROXO_MARCA, clarear } from "./marca";
import { LOGO_BRANCO, logoPng } from "./assets/logo";

/**
 * Gera o PDF do relatório com pdf-lib (fontes-padrão embutidas → texto sempre
 * renderiza e fica selecionável, sem arquivo de fonte, roda no node:slim).
 * Layout de marca: faixa de cabeçalho, título, blocos (texto/tabela/gráfico) e
 * rodapé com paginação. Gráficos desenhados como VETOR (retângulos/linhas).
 */

export type BrandInfo = { marca: string; primariaHex: string; dataHoje: string; secundariaHex?: string };

const A4 = { w: 595.28, h: 841.89 };
const M = 48; // margem lateral
const HEADER_H = 66;
const FOOTER_H = 32;
const CONTENT_W = A4.w - M * 2;

/** `#RRGGBB` → `RGB` do pdf-lib. A conversão mora em `marca.ts`. */
function cor(hex: string): RGB {
  const [r, g, b] = paraUnidade(hex);
  return rgb(r, g, b);
}
function mix(c: RGB, white: number): RGB {
  return rgb(c.red + (1 - c.red) * white, c.green + (1 - c.green) * white, c.blue + (1 - c.blue) * white);
}

/**
 * As cores do documento vêm todas de `marca.ts`.
 *
 * Antes eram literais de `rgb(0.1, 0.1, 0.12)` cravados aqui — perto o bastante
 * dos neutros da UI para ninguém notar, longe o bastante para o documento e a
 * tela nunca combinarem de verdade.
 */
const COR = {
  texto: cor(MARCA.texto),
  muted: cor(MARCA.textoSuave),
  border: cor(MARCA.borda),
  branco: cor("#FFFFFF"),
  regua: cor(MARCA.regua),
  destaque: cor(MARCA.destaque),
};

type Ctx = {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  /**
   * O logo embutido UMA vez e reusado em todas as páginas.
   *
   * `embedPng` por página gravaria o mesmo PNG N vezes dentro do PDF — num
   * relatório de 40 páginas seriam 40 cópias de 11 KB. O pdf-lib reusa o objeto
   * quando se reusa o `PDFImage`.
   *
   * Opcional porque o desenho não pode depender dele: se o embed falhar, o
   * documento sai com o nome escrito e não sai quebrado.
   */
  logo?: PDFImage;
  primary: RGB;
  zebra: RGB;
  page: PDFPage;
  y: number; // cursor "topo" (coord PDF, y-up); desce ao longo do desenho
  pages: PDFPage[];
  brand: BrandInfo;
};

function fmtNum(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1).replace(".", ",") + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(1).replace(".", ",") + "k";
  return String(Math.round(v * 100) / 100).replace(".", ",");
}
/** Trunca `txt` para caber em `maxW` (na fonte/size dados), com reticências. */
function trunc(font: PDFFont, txt: string, size: number, maxW: number): string {
  txt = winAnsiSafe(String(txt ?? ""));
  if (font.widthOfTextAtSize(txt, size) <= maxW) return txt;
  while (txt.length > 1 && font.widthOfTextAtSize(txt + "…", size) > maxW) txt = txt.slice(0, -1);
  return txt + "…";
}
/** Quebra `txt` em linhas que cabem em `maxW`. */
function wrap(font: PDFFont, txt: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const paragrafo of winAnsiSafe(String(txt ?? "")).split(/\n/)) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean);
    let linha = "";
    for (const p of palavras) {
      const tent = linha ? linha + " " + p : p;
      if (font.widthOfTextAtSize(tent, size) > maxW && linha) {
        out.push(linha);
        linha = p;
      } else linha = tent;
    }
    out.push(linha);
  }
  return out;
}

/**
 * A FAIXA EM DEGRADÊ — o elemento que mais identifica o material da Natcorp.
 *
 * O pdf-lib não tem degradê. Desenho as paradas de `degrade()` como fatias
 * verticais coladas: numa faixa A4 são ~5pt cada, que nenhum olho separa, e 120
 * retângulos não pesam em lugar nenhum. A alternativa seria embutir um PNG, que
 * custaria uma imagem por página e perderia a nitidez em zoom.
 *
 * O `+1` na largura da fatia é o que evita a listra branca de meio ponto entre
 * elas — arredondamento de subpixel aparece como faixa zebrada quando o leitor
 * de PDF renderiza em escala alta.
 */
function faixaDegrade(page: PDFPage, x: number, y: number, w: number, h: number, n = 120) {
  const paradas = degrade(n);
  const passo = w / n;
  paradas.forEach((hex, i) => {
    page.drawRectangle({ x: x + i * passo, y, width: passo + 1, height: h, color: cor(hex) });
  });
}

/**
 * Os losangos da marca como textura da faixa.
 *
 * É o mesmo motivo do deck: a forma do logo, grande, quase invisível, sangrando
 * pela borda. Quadrado girado a 45° em vez de path — o pdf-lib rotaciona
 * retângulo nativamente, e `drawSvgPath` inverte o eixo Y, que é uma armadilha
 * boa de evitar num arquivo que já tem coordenada suficiente.
 */
/**
 * Um losango CENTRADO em `(cx, cy)`, com meia-diagonal `r`.
 *
 * O pdf-lib gira o retângulo em torno do canto inferior-esquerdo, não do centro.
 * Um quadrado de lado `s` em `(x, y)` girado 45° vira um losango com o vértice
 * DE BAIXO em `(x, y)` e o centro em `(x, y + s/√2)` — meia diagonal acima de
 * onde a intuição coloca. Na primeira tentativa isso cortou os losangos no topo
 * da faixa e eles viraram um zigue-zague.
 *
 * A conversão fica aqui, uma vez: quem chamar posiciona pensando no centro, que
 * é como se pensa em forma.
 */
function desenharLosango(page: PDFPage, cx: number, cy: number, r: number, cor_: RGB, opacity = 1) {
  const lado = r * Math.SQRT2;
  page.drawRectangle({ x: cx, y: cy - r, width: lado, height: lado, rotate: degrees(45), color: cor_, opacity });
}

/**
 * Os losangos da marca como textura da faixa.
 *
 * É o mesmo motivo do deck: a forma do logo, grande, quase invisível, sangrando
 * pela borda direita. Sobrepostos e com opacidade baixa — quem olha vê textura,
 * não desenho, que é o papel dela.
 */
function losangosDaFaixa(page: PDFPage, y: number, h: number, opacidade = 0.05) {
  const r = h * 0.62;
  for (let i = 0; i < 4; i++) desenharLosango(page, A4.w - 30 - i * r * 1.15, y + h / 2, r, COR.branco, opacidade);
}

function novaPagina(ctx: Ctx) {
  const page = ctx.doc.addPage([A4.w, A4.h]);
  ctx.pages.push(page);
  ctx.page = page;
  faixaDegrade(page, 0, A4.h - HEADER_H, A4.w, HEADER_H);
  losangosDaFaixa(page, A4.h - HEADER_H, HEADER_H);
  if (ctx.logo) {
    const h = 20;
    page.drawImage(ctx.logo, { x: M, y: A4.h - HEADER_H / 2 - h / 2, width: h * LOGO_BRANCO.proporcao, height: h });
  } else {
    // Sem logo o documento continua saindo, com o nome escrito. Um relatório
    // sem marca é pior que um relatório sem logo.
    const marca = trunc(ctx.bold, ctx.brand.marca || "Natcorp", 15, CONTENT_W - 90);
    page.drawText(marca, { x: M, y: A4.h - HEADER_H / 2 - 5, size: 15, font: ctx.bold, color: COR.branco });
  }
  const tag = "Relatório";
  page.drawText(tag, {
    x: A4.w - M - ctx.font.widthOfTextAtSize(tag, 11),
    y: A4.h - HEADER_H / 2 - 4,
    size: 11,
    font: ctx.font,
    color: cor(clarear(MARCA.faixa[2], 0.55)),
  });
  ctx.y = A4.h - HEADER_H - 28;
}

/**
 * A CAPA — que não existia.
 *
 * O PDF começava direto no conteúdo: faixa, título e já a primeira tabela. Para
 * quem recebe o arquivo por e-mail e abre no celular, isso não se apresenta —
 * não diz de quem é, do que trata nem de quando.
 *
 * O desenho segue o arquétipo dominante do deck institucional: faixa escura em
 * degradê ocupando o terço superior, título grande em branco dentro dela,
 * subtítulo e data embaixo no claro, com o filete rosa entre os dois.
 *
 * Página própria, com `addPage` direto e não `novaPagina`: a capa não leva a
 * faixa de cabeçalho comum nem entra na conta de conteúdo.
 */
function desenharCapa(ctx: Ctx, spec: ReportSpec) {
  const page = ctx.doc.addPage([A4.w, A4.h]);
  ctx.pages.push(page);
  const H = A4.h * 0.42;
  faixaDegrade(page, 0, A4.h - H, A4.w, H);
  losangosDaFaixa(page, A4.h - H, H, 0.07);

  // Marca no topo da faixa, acima do título — é a primeira coisa que se lê.
  if (ctx.logo) {
    const h = 34;
    page.drawImage(ctx.logo, { x: M, y: A4.h - 52 - h, width: h * LOGO_BRANCO.proporcao, height: h });
  } else {
    page.drawText(trunc(ctx.bold, ctx.brand.marca || "Natcorp", 12, CONTENT_W), {
      x: M, y: A4.h - 56, size: 12, font: ctx.bold, color: cor(clarear(MARCA.faixa[2], 0.6)),
    });
  }

  // Título dentro da faixa, quebrando em até 3 linhas de baixo para cima, para
  // que o bloco fique ancorado no rodapé da faixa por mais longo que ele seja.
  const linhas = wrap(ctx.bold, spec.titulo, 30, CONTENT_W).slice(0, 3);
  let y = A4.h - H + 54 + (linhas.length - 1) * 36;
  for (const l of linhas) {
    page.drawText(l, { x: M, y, size: 30, font: ctx.bold, color: COR.branco });
    y -= 36;
  }

  // O filete rosa: separa a faixa do claro e é assinatura da marca.
  page.drawRectangle({ x: M, y: A4.h - H - 26, width: 96, height: 4, color: COR.regua });

  if (spec.subtitulo) {
    let sy = A4.h - H - 56;
    for (const l of wrap(ctx.font, spec.subtitulo, 13, CONTENT_W).slice(0, 4)) {
      page.drawText(l, { x: M, y: sy, size: 13, font: ctx.font, color: COR.muted });
      sy -= 18;
    }
  }

  /**
   * O losango grande sangrando pela borda direita.
   *
   * Sem ele a metade de baixo da capa fica um vazio branco — e vazio numa capa
   * não lê como respiro, lê como página que não terminou de carregar. É o mesmo
   * recurso do deck (a forma da marca, grande, cortada pela margem), em tom
   * claro para não competir com o título.
   *
   * Os três concêntricos dão a profundidade do logo, que tem losangos
   * sobrepostos — um só ficaria chapado.
   */
  const cx = A4.w + 40;
  const cy = A4.h * 0.24;
  desenharLosango(page, cx, cy, 250, cor(clarear(ROXO_MARCA, 0.9)));
  desenharLosango(page, cx, cy, 190, cor(clarear(ROXO_MARCA, 0.84)));
  desenharLosango(page, cx, cy, 120, cor(clarear(ROSA, 0.86)));

  page.drawText(ctx.brand.dataHoje, { x: M, y: M + 18, size: 9.5, font: ctx.font, color: COR.muted });
}

/** Garante `h` pontos livres antes do rodapé; senão abre nova página. */
function ensure(ctx: Ctx, h: number) {
  if (ctx.y - h < M + FOOTER_H) novaPagina(ctx);
}

function paragrafo(ctx: Ctx, txt: string, size: number, font: PDFFont, color: RGB, gapDepois = 6) {
  const lh = size * 1.4;
  for (const linha of wrap(font, txt, size, CONTENT_W)) {
    ensure(ctx, lh);
    ctx.page.drawText(linha, { x: M, y: ctx.y - size, size, font, color });
    ctx.y -= lh;
  }
  ctx.y -= gapDepois;
}

function desenharTabela(ctx: Ctx, colunas: string[], linhas: string[][], titulo?: string) {
  if (titulo) paragrafo(ctx, titulo, 12, ctx.bold, COR.texto, 4);

  // Larguras por CONTEÚDO (não divisão igual): cada coluna pede o que precisa, com teto.
  // Se a soma couber, usa proporcional (nada espremido); senão reduz a fonte; se ainda
  // não couber, TROCA para layout de registros (rótulo: valor) — evita a tabela
  // "extremamente espremida" quando há muitas colunas.
  const naturais = (s: number) =>
    colunas.map((c, i) => {
      let w = ctx.bold.widthOfTextAtSize(String(c ?? ""), s);
      for (const linha of linhas) w = Math.max(w, ctx.font.widthOfTextAtSize(String(linha[i] ?? ""), s));
      return Math.min(w + 12, CONTENT_W * 0.45); // padding + teto p/ 1 coluna não estourar
    });
  let size = 9.5;
  let nat = naturais(size);
  let soma = nat.reduce((a, b) => a + b, 0);
  if (soma > CONTENT_W) {
    size = 7.5; // 1ª saída: fonte menor cabe mais colunas
    nat = naturais(size);
    soma = nat.reduce((a, b) => a + b, 0);
    if (soma > CONTENT_W) {
      desenharRegistros(ctx, colunas, linhas); // 2ª saída: reformata, sem espremer
      return;
    }
  }
  // Distribui a folga proporcionalmente (colunas mais largas ganham mais espaço).
  const folga = CONTENT_W - soma;
  const larg = nat.map((w) => w + (folga * w) / soma);
  const xIni = larg.map((_, i) => M + larg.slice(0, i).reduce((a, b) => a + b, 0));
  const padY = 6;

  const desenharCabecalho = () => {
    const hH = size + padY * 2;
    ensure(ctx, hH);
    ctx.page.drawRectangle({ x: M, y: ctx.y - hH, width: CONTENT_W, height: hH, color: ctx.primary });
    colunas.forEach((c, i) => {
      ctx.page.drawText(trunc(ctx.bold, c, size, larg[i]! - 10), {
        x: xIni[i]! + 5,
        y: ctx.y - size - padY,
        size,
        font: ctx.bold,
        color: COR.branco,
      });
    });
    ctx.y -= hH;
  };

  desenharCabecalho();
  linhas.forEach((linha, r) => {
    // Altura da linha = maior nº de linhas quebradas entre as células.
    const wrapped = colunas.map((_, i) => wrap(ctx.font, linha[i] ?? "", size, larg[i]! - 10));
    const nLinhas = Math.max(1, ...wrapped.map((w) => w.length));
    const rowH = nLinhas * (size * 1.28) + padY;
    if (ctx.y - rowH < M + FOOTER_H) {
      novaPagina(ctx);
      desenharCabecalho(); // repete o cabeçalho na nova página
    }
    if (r % 2 === 1) {
      ctx.page.drawRectangle({ x: M, y: ctx.y - rowH, width: CONTENT_W, height: rowH, color: ctx.zebra });
    }
    wrapped.forEach((cel, i) => {
      cel.forEach((txt, li) => {
        ctx.page.drawText(txt, {
          x: xIni[i]! + 5,
          y: ctx.y - size - padY / 2 - li * (size * 1.28),
          size,
          font: ctx.font,
          color: COR.texto,
        });
      });
    });
    // Linha divisória inferior.
    ctx.page.drawLine({
      start: { x: M, y: ctx.y - rowH },
      end: { x: M + CONTENT_W, y: ctx.y - rowH },
      thickness: 0.5,
      color: COR.border,
    });
    ctx.y -= rowH;
  });
  ctx.y -= 12;
}

/**
 * Layout de REGISTROS (rótulo: valor por linha) — usado quando a tabela teria colunas
 * espremidas demais (muitas colunas / conteúdo largo). Cada linha vira um bloco legível
 * em toda a largura, sem perder nenhum dado.
 */
function desenharRegistros(ctx: Ctx, colunas: string[], linhas: string[][]) {
  const size = 9.5;
  linhas.forEach((linha, r) => {
    // Cabeçalho do bloco: a 1ª coluna (nome/matrícula) — ou "Registro N".
    const rotulo0 = String(colunas[0] ?? "").trim();
    const val0 = String(linha[0] ?? "").trim();
    const cab = val0 ? (rotulo0 ? `${rotulo0}: ${val0}` : val0) : `Registro ${r + 1}`;
    ensure(ctx, size * 1.6);
    paragrafo(ctx, cab, 10, ctx.bold, COR.texto, 2);
    // Demais colunas como "Coluna: valor" (pula vazias).
    for (let i = 1; i < colunas.length; i++) {
      const val = String(linha[i] ?? "").trim();
      if (!val) continue;
      paragrafo(ctx, `${colunas[i]}: ${val}`, size, ctx.font, COR.texto, 1);
    }
    // Divisória entre registros.
    ctx.y -= 4;
    ensure(ctx, 8);
    ctx.page.drawLine({ start: { x: M, y: ctx.y }, end: { x: M + CONTENT_W, y: ctx.y }, thickness: 0.5, color: COR.border });
    ctx.y -= 8;
  });
  ctx.y -= 6;
}

/** Desenha um gráfico (vetor) dentro de uma caixa; `top` é o y do topo (y-up). */
function desenharGrafico(ctx: Ctx, spec: ChartSpec, top: number, boxH: number) {
  const x = M;
  const w = CONTENT_W;
  const page = ctx.page;
  const cats = spec.categorias;
  const series = spec.series;
  const pal = (i: number) => cor(CORES_GRAFICO[i % CORES_GRAFICO.length]!);

  if (spec.titulo) {
    page.drawText(trunc(ctx.bold, spec.titulo, 12, w), { x, y: top - 12, size: 12, font: ctx.bold, color: COR.texto });
  }
  const areaTop = top - (spec.titulo ? 22 : 4);
  const areaH = boxH - (spec.titulo ? 22 : 4);

  // Pizza/rosca → barra 100% empilhada + legenda (limpo e sem paths de arco).
  if (spec.tipo === "pizza" || spec.tipo === "rosca") {
    const vals = cats.map((_, i) => Math.max(0, series[0]?.valores[i] ?? 0));
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const barH = 26;
    const barY = areaTop - barH;
    let cx = x;
    vals.forEach((v, i) => {
      const seg = (v / total) * w;
      page.drawRectangle({ x: cx, y: barY, width: seg, height: barH, color: pal(i) });
      cx += seg;
    });
    // Legenda em duas colunas.
    let ly = barY - 18;
    const colLeg = w / 2;
    cats.forEach((c, i) => {
      const col = i % 2;
      const lx = x + col * colLeg;
      if (col === 0 && i > 0) ly -= 16;
      page.drawRectangle({ x: lx, y: ly - 8, width: 9, height: 9, color: pal(i) });
      const pct = Math.round((vals[i]! / total) * 100);
      page.drawText(trunc(ctx.font, `${c} — ${pct}%`, 9.5, colLeg - 22), {
        x: lx + 14,
        y: ly - 8,
        size: 9.5,
        font: ctx.font,
        color: COR.texto,
      });
    });
    return;
  }

  // Eixos cartesianos (colunas/barras/linha/área).
  let vmax = -Infinity;
  let vmin = Infinity;
  for (const s of series) for (const v of s.valores) { if (v > vmax) vmax = v; if (v < vmin) vmin = v; }
  if (vmax === -Infinity) return;
  vmin = Math.min(0, vmin);
  if (vmax === vmin) vmax = vmin + 1;
  const span = vmax - vmin;

  const padL = 42;
  const legendH = series.length > 1 ? 16 : 0;
  const plotX = x + padL;
  const plotW = w - padL - 6;
  // Rótulos do eixo X: ROTACIONA quando não cabem na largura da banda (antes eram
  // truncados a "…" e ficavam ilegíveis) e reserva mais espaço embaixo (padB).
  const ehBarras = spec.tipo === "barras";
  const bandTmp = plotW / Math.max(1, cats.length);
  let maxLabW = 0;
  if (!ehBarras) for (const c of cats) { const lw = ctx.font.widthOfTextAtSize(String(c ?? ""), 8); if (lw > maxLabW) maxLabW = lw; }
  const girar = !ehBarras && maxLabW > bandTmp - 2;
  const padB = girar ? Math.min(54, Math.max(22, Math.ceil(maxLabW * 0.72) + 8)) : 22;
  const plotTop = areaTop - legendH;
  const plotBottom = areaTop - areaH + padB;
  const plotH = plotTop - plotBottom;
  if (plotH <= 10) return;

  // Legenda (topo) para múltiplas séries.
  if (legendH) {
    let lx = plotX;
    series.forEach((s, i) => {
      page.drawRectangle({ x: lx, y: areaTop - 11, width: 9, height: 9, color: pal(i) });
      const nm = trunc(ctx.font, s.nome, 9, 120);
      page.drawText(nm, { x: lx + 13, y: areaTop - 11, size: 9, font: ctx.font, color: COR.texto });
      lx += 13 + ctx.font.widthOfTextAtSize(nm, 9) + 16;
    });
  }

  const valorY = (v: number) => plotBottom + (plotH * (v - vmin)) / span;
  const zeroY = valorY(0);
  // Grade + rótulos do eixo de valor.
  for (let g = 0; g <= 4; g++) {
    const vv = vmin + (span * g) / 4;
    const gy = valorY(vv);
    page.drawLine({ start: { x: plotX, y: gy }, end: { x: plotX + plotW, y: gy }, thickness: 0.5, color: COR.border });
    page.drawText(fmtNum(vv), { x: x, y: gy - 3, size: 8, font: ctx.font, color: COR.muted });
  }

  const band = plotW / Math.max(1, cats.length);
  if (spec.tipo === "barras") {
    // Barras horizontais: recalcula com eixo trocado.
    const bandH = plotH / Math.max(1, cats.length);
    const zeroX = plotX + (plotW * (0 - vmin)) / span;
    // Afina os rótulos (1 a cada `passoB`) quando as barras ficam finas demais p/ o texto.
    const passoB = Math.max(1, Math.ceil((9 / Math.max(1, bandH))));
    cats.forEach((c, ci) => {
      const by = plotTop - bandH * ci;
      if (ci % passoB === 0) page.drawText(trunc(ctx.font, c, 8, padL - 4), { x, y: by - bandH / 2 - 3, size: 8, font: ctx.font, color: COR.muted });
      const sh = (bandH * 0.7) / series.length;
      series.forEach((s, si) => {
        const v = s.valores[ci] ?? 0;
        const bw = (plotW * v) / span;
        page.drawRectangle({ x: zeroX, y: by - bandH * 0.15 - sh * (si + 1), width: bw, height: sh * 0.86, color: pal(si) });
      });
    });
  } else {
    // Rótulos de categoria no eixo X: rotacionados quando não cabem, e AFINADOS (1 a cada
    // `passo`) quando há muitos, para não virarem uma mancha ilegível.
    const passoX = Math.max(1, Math.ceil(cats.length / Math.max(1, Math.floor(plotW / (girar ? 15 : 26)))));
    cats.forEach((c, ci) => {
      if (ci % passoX !== 0) return;
      if (girar) {
        page.drawText(trunc(ctx.font, String(c ?? ""), 8, padB * 1.32), {
          x: plotX + band * ci + band / 2 - 2, y: plotBottom - 4, size: 8, font: ctx.font, color: COR.muted, rotate: degrees(-45),
        });
      } else {
        page.drawText(trunc(ctx.font, String(c ?? ""), 8, band), {
          x: plotX + band * ci + 2, y: plotBottom - 12, size: 8, font: ctx.font, color: COR.muted,
        });
      }
    });
    if (spec.tipo === "colunas") {
      const sw = (band * 0.7) / series.length;
      cats.forEach((_, ci) => {
        series.forEach((s, si) => {
          const v = s.valores[ci] ?? 0;
          const vy = valorY(v);
          const bx = plotX + band * ci + band * 0.15 + sw * si;
          page.drawRectangle({ x: bx, y: Math.min(vy, zeroY), width: sw * 0.9, height: Math.abs(vy - zeroY), color: pal(si) });
        });
      });
    } else {
      // linha / área
      series.forEach((s, si) => {
        const col = pal(si);
        const pts = cats.map((_, ci) => ({ x: plotX + band * ci + band / 2, y: valorY(s.valores[ci] ?? 0) }));
        if (spec.tipo === "area") {
          // Preenche com faixas verticais finas (só retângulos, coords limpas).
          pts.forEach((p) => {
            page.drawRectangle({ x: p.x - 1, y: Math.min(p.y, zeroY), width: 2, height: Math.abs(p.y - zeroY), color: col, opacity: 0.18 });
          });
        }
        for (let i = 1; i < pts.length; i++) {
          page.drawLine({ start: pts[i - 1]!, end: pts[i]!, thickness: 1.5, color: col });
        }
      });
    }
  }

  // Mediana e tendência (quando marcadas na spec) — nunca em pizza/rosca.
  const med = spec.mediana ? medianOf(series.flatMap((s) => s.valores)) : null;
  if (med != null) {
    const corMed = cor(ROSA);
    if (spec.tipo === "barras") {
      const mx = plotX + (plotW * (med - vmin)) / span;
      page.drawLine({ start: { x: mx, y: plotBottom }, end: { x: mx, y: plotTop }, thickness: 1, color: corMed, dashArray: [4, 3] });
      page.drawText("Mediana " + fmtNum(med), { x: Math.min(mx + 3, plotX + plotW - 52), y: plotTop - 8, size: 7.5, font: ctx.font, color: corMed });
    } else {
      const my = valorY(med);
      page.drawLine({ start: { x: plotX, y: my }, end: { x: plotX + plotW, y: my }, thickness: 1, color: corMed, dashArray: [4, 3] });
      const lbl = "Mediana " + fmtNum(med);
      page.drawText(lbl, { x: plotX + plotW - ctx.font.widthOfTextAtSize(lbl, 7.5), y: my + 3, size: 7.5, font: ctx.font, color: corMed });
    }
  }
  if (spec.tendencia && spec.tipo !== "barras") {
    const reg = linReg(series[0]!.valores);
    if (reg) {
      const corT = cor(MARCA.faixa[0]);
      const clY = (y: number) => Math.max(plotBottom, Math.min(plotTop, y));
      const xa = plotX + band / 2;
      const xb = plotX + band * (cats.length - 1) + band / 2;
      const ya = clY(valorY(reg.a));
      const yb = clY(valorY(reg.a + reg.b * (cats.length - 1)));
      page.drawLine({ start: { x: xa, y: ya }, end: { x: xb, y: yb }, thickness: 1.5, color: corT, dashArray: [5, 3] });
      const lblT = "Tendência: " + (reg.b > 0 ? "alta" : reg.b < 0 ? "queda" : "estável");
      page.drawText(lblT, { x: xb - ctx.font.widthOfTextAtSize(lblT, 7.5), y: yb + 4, size: 7.5, font: ctx.font, color: corT });
    }
  }
}

/** Desenha runs (negrito/itálico) com quebra de linha, fontes mescladas. */
function drawRuns(ctx: Ctx, runs: MdRun[], size: number, color: RGB, indent = 0, gap = 6) {
  const maxW = CONTENT_W - indent;
  const lh = size * 1.45;
  const spaceW = ctx.font.widthOfTextAtSize(" ", size);
  const toks = tokenizarRuns(runs);
  if (!toks.length) { ctx.y -= gap; return; }
  ensure(ctx, lh);
  let x = M + indent;
  toks.forEach((tok, i) => {
    const f = tok.negrito ? ctx.bold : ctx.font;
    const w = f.widthOfTextAtSize(tok.texto, size);
    // O espaço vem ANTES do token e só quando ele não cola — é o que impede o
    // "colaboradores ," que aparecia em todo negrito seguido de pontuação.
    const espaco = i === 0 || tok.colado ? 0 : spaceW;
    if (x > M + indent && x + espaco + w > M + indent + maxW) {
      ctx.y -= lh;
      ensure(ctx, lh);
      x = M + indent;
    } else {
      x += espaco;
    }
    ctx.page.drawText(tok.texto, { x, y: ctx.y - size, size, font: f, color });
    x += w;
  });
  ctx.y -= lh + gap;
}

/** Renderiza um texto em MARKDOWN (títulos/negrito/itálico/listas/tabelas). */
function desenharMarkdown(ctx: Ctx, texto: string) {
  // Saneia ANTES de parsear: os runs (negrito/itálico/listas) já saem WinAnsi-safe,
  // então o drawRuns nunca recebe emoji e o pdf-lib não quebra.
  for (const b of parseMarkdown(winAnsiSafe(texto))) {
    if (b.kind === "heading") {
      ctx.y -= 4;
      const size = b.level === 1 ? 15 : b.level === 2 ? 13 : 11.5;
      drawRuns(ctx, b.runs.map((r) => ({ ...r, bold: true })), size, ctx.primary, 0, 6);
    } else if (b.kind === "bullet") {
      ensure(ctx, 11 * 1.45);
      ctx.page.drawText("•", { x: M + 4, y: ctx.y - 11, size: 11, font: ctx.bold, color: ctx.primary });
      drawRuns(ctx, b.runs, 11, COR.texto, 16, 4);
    } else if (b.kind === "ordered") {
      ensure(ctx, 11 * 1.45);
      ctx.page.drawText(b.index + ".", { x: M + 2, y: ctx.y - 11, size: 11, font: ctx.bold, color: ctx.primary });
      drawRuns(ctx, b.runs, 11, COR.texto, 18, 4);
    } else if (b.kind === "table") {
      desenharTabela(ctx, b.header, b.rows);
      ctx.y -= 6;
    } else {
      drawRuns(ctx, b.runs, 11, COR.texto, 0, 8);
    }
  }
}

/**
 * Tipos desenhados em VETOR aqui (nítidos em qualquer zoom). O resto — empilhados,
 * combo, radar — vem de `chart-svg.ts` rasterizado: melhor uma imagem correta do que
 * um vetor bonito da forma ERRADA, que era o que acontecia antes (tudo que este
 * arquivo não reconhecia caía no ramo de linha, em silêncio).
 */
/**
 * `pizza` e `rosca` SAÍRAM daqui em 16/08/2026, e a razão é que o vetor deste
 * arquivo mentia: `desenharGrafico` desenhava uma BARRA 100% EMPILHADA com
 * legenda e chamava de pizza. Números certos, forma errada, sem aviso.
 *
 * O `chart-svg.ts` já desenha a pizza de verdade, com arcos — só nunca era
 * chamado para isso. Agora as duas rasterizam por lá.
 */
const PDF_VETOR: ReadonlySet<string> = new Set(["barras", "colunas", "linha", "area"]);

function desenharBloco(ctx: Ctx, b: ReportBlock, imagem?: PDFImage) {
  if (b.tipo === "texto") {
    desenharMarkdown(ctx, b.texto);
  } else if (b.tipo === "tabela") {
    desenharTabela(ctx, b.colunas, b.linhas, b.titulo);
  } else if (b.tipo === "grafico") {
    const boxH = 250;
    ensure(ctx, boxH + 6);
    if (imagem) {
      /**
       * Encolhe pelos DOIS lados, preservando a proporção.
       *
       * Antes a largura era fixa em `CONTENT_W` e só a altura levava
       * `Math.min(boxH, …)`. Uma imagem 900×520 pede 288pt de altura nessa
       * largura; o teto cortava para 210 e a figura achatava 27%. Passou anos
       * sem aparecer porque a única forma que denuncia distorção é o círculo —
       * e o PDF não desenhava círculo nenhum até a pizza virar pizza de verdade.
       *
       * Centraliza o que sobrar: um gráfico estreito encostado à esquerda numa
       * página de tabelas largas parece desalinhamento, não escolha.
       */
      const escala = Math.min(CONTENT_W / imagem.width, boxH / imagem.height);
      const w = imagem.width * escala;
      const h = imagem.height * escala;
      ctx.page.drawImage(imagem, { x: M + (CONTENT_W - w) / 2, y: ctx.y - h, width: w, height: h });
    } else {
      desenharGrafico(ctx, b.grafico, ctx.y, boxH);
    }
    ctx.y -= boxH + 12;
  }
}

/** Carimba o rodapé (paginação + data) em todas as páginas ao final. */
function carimbarRodapes(ctx: Ctx) {
  // A CAPA fica de fora: ela já tem a data no rodapé, e "Página 1 de 8" numa
  // capa denuncia que a capa é só mais uma página. A numeração passa a contar o
  // CONTEÚDO, que é o que quem lê procura ao citar "veja a página 3".
  const conteudo = ctx.pages.slice(1);
  const total = conteudo.length;
  conteudo.forEach((page, i) => {
    page.drawLine({
      start: { x: M, y: FOOTER_H + 8 },
      end: { x: A4.w - M, y: FOOTER_H + 8 },
      thickness: 0.5,
      color: COR.border,
    });
    page.drawText(ctx.brand.dataHoje, { x: M, y: FOOTER_H - 6, size: 8, font: ctx.font, color: COR.muted });
    const pag = `Página ${i + 1} de ${total}`;
    page.drawText(pag, {
      x: A4.w - M - ctx.font.widthOfTextAtSize(pag, 8),
      y: FOOTER_H - 6,
      size: 8,
      font: ctx.font,
      color: COR.muted,
    });
  });
}

function nomeArquivo(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 50);
  return (base || "relatorio") + ".pdf";
}

/** Monta o PDF do relatório e devolve como OutFile (base64) para o canal entregar. */
export async function renderReportPdf(spec: ReportSpec, brand: BrandInfo): Promise<OutFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  /**
   * A cor vem da MARCA, não de `brand.primariaHex`.
   *
   * Decisão do Igor (16/08/2026): sempre Natcorp, em qualquer cliente. O campo
   * continua no tipo porque outras rotas o preenchem, mas o documento deixou de
   * obedecê-lo — quem configurou a cor da bolha do widget continua com ela na
   * bolha, e o relatório sai roxo Natcorp.
   */
  const primary = cor(ROXO_MARCA);
  const ctx: Ctx = { doc, font, bold, primary, zebra: cor(MARCA.zebra), page: null as unknown as PDFPage, y: 0, pages: [], brand };
  try {
    ctx.logo = await doc.embedPng(logoPng(LOGO_BRANCO));
  } catch (e) {
    // Best-effort: PNG corrompido não pode impedir a entrega do relatório.
    console.error("[pdf] não consegui embutir o logo:", e);
  }
  desenharCapa(ctx, spec);
  novaPagina(ctx);
  // Rasteriza ANTES do desenho (que é síncrono) os gráficos que este arquivo não
  // desenha em vetor — empilhados, combo, radar. Sem isto eles caíam no ramo de
  // linha e saíam com a forma errada, sem ninguém perceber.
  const imagens = new Map<number, PDFImage>();
  for (let i = 0; i < spec.blocos.length; i++) {
    const b = spec.blocos[i]!;
    if (b.tipo !== "grafico" || PDF_VETOR.has(b.grafico.tipo)) continue;
    try {
      const { Resvg } = await import("@resvg/resvg-js");
      const svg = chartSvg(b.grafico, CORES_GRAFICO, 900, 520);
      const png = new Resvg(svg, { fitTo: { mode: "width", value: 1100 }, background: "white" }).render().asPng();
      imagens.set(i, await doc.embedPng(Buffer.from(png)));
    } catch (e) {
      // Sem imagem, `desenharBloco` cai no vetor — que ao menos mostra os números.
      console.error("[pdf] falha ao rasterizar o gráfico:", e);
    }
  }
  spec.blocos.forEach((b, i) => desenharBloco(ctx, b, imagens.get(i)));
  // Avisos de degradação (tipo trocado por limitação do formato) — em vez de trocar
  // em silêncio, o arquivo DIZ o que mudou.
  if (spec.avisos?.length) {
    ensure(ctx, 30);
    for (const a of spec.avisos) paragrafo(ctx, "⚠ " + a, 8.5, ctx.font, COR.muted, 3);
  }
  carimbarRodapes(ctx);
  const bytes = await doc.save();
  return { filename: nomeArquivo(spec.titulo), mimeType: "application/pdf", base64: Buffer.from(bytes).toString("base64") };
}
