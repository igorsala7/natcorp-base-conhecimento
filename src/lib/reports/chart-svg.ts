import type { ChartSpec } from "@/lib/chat/chart-spec";

/**
 * Gera um GRÁFICO como SVG (string pura, sem dependências).
 *
 * É o renderizador CANÔNICO do servidor: serve o Word (imagem), o Excel (via
 * resvg → PNG) e o PDF (para os tipos que o desenho vetorial do pdf-lib não cobre).
 * Cada tipo adicionado aqui aparece nos três de uma vez.
 *
 * Cobertura: pizza, rosca, radar, colunas, colunas_emp, barras, barras_emp, linha,
 * area, area_emp e combo. Os tipos fora disso (dispersao/bolha/heatmap/candle) são
 * trocados ANTES de chegar aqui, por `degradarTipo` — com aviso ao usuário. Nada de
 * cair num `else` que desenha outra coisa em silêncio.
 */

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1).replace(".", ",") + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(1).replace(".", ",") + "k";
  return String(Math.round(v * 100) / 100).replace(".", ",");
};

export function chartSvg(spec: ChartSpec, colors: string[], W = 660, H = 380): string {
  const cor = (i: number) => colors[i % colors.length] || "#511C76";
  const cats = spec.categorias;
  const series = spec.series;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Calibri, Arial, sans-serif">`);
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  if (spec.titulo) parts.push(`<text x="${W / 2}" y="26" text-anchor="middle" font-size="16" font-weight="700" fill="#2C1A63">${esc(spec.titulo)}</text>`);

  const legendH = 26;
  const top = spec.titulo ? 44 : 20;
  const bottom = H - 40 - legendH;

  const legenda = () => {
    const y = H - 16;
    let x = 20;
    const out: string[] = [];
    series.forEach((s, i) => {
      out.push(`<rect x="${x}" y="${y - 9}" width="11" height="11" rx="2" fill="${cor(i)}"/>`);
      out.push(`<text x="${x + 16}" y="${y}" font-size="11" fill="#333">${esc(s.nome)}</text>`);
      x += 24 + s.nome.length * 6.2;
    });
    return out.join("");
  };

  if (spec.tipo === "pizza" || spec.tipo === "rosca") {
    const s = series[0];
    const vals = (s?.valores ?? []).map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0));
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = W / 2, cy = (top + bottom) / 2, r = Math.min(W, bottom - top) / 2 - 20;
    let ang = -Math.PI / 2;
    vals.forEach((v, i) => {
      const frac = v / total;
      const a2 = ang + frac * Math.PI * 2;
      const x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const large = frac > 0.5 ? 1 : 0;
      parts.push(`<path d="M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${cor(i)}" stroke="#fff" stroke-width="2"/>`);
      const mid = (ang + a2) / 2, lr = r * 0.62;
      if (frac > 0.05) parts.push(`<text x="${(cx + lr * Math.cos(mid)).toFixed(1)}" y="${(cy + lr * Math.sin(mid)).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${Math.round(frac * 100)}%</text>`);
      ang = a2;
    });
    if (spec.tipo === "rosca") parts.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="#fff"/>`);
    // Legenda por categoria (pizza usa categorias como fatias).
    let lx = 20;
    const ly = H - 16;
    cats.forEach((c, i) => {
      parts.push(`<rect x="${lx}" y="${ly - 9}" width="11" height="11" rx="2" fill="${cor(i)}"/>`);
      parts.push(`<text x="${lx + 16}" y="${ly}" font-size="11" fill="#333">${esc(c)}</text>`);
      lx += 24 + c.length * 6.2;
    });
    parts.push("</svg>");
    return parts.join("");
  }

  // RADAR (teia): compara várias dimensões de poucos itens. Polar, não cartesiano.
  if (spec.tipo === "radar") {
    const cx = W / 2, cy = (top + bottom) / 2;
    const r = Math.min(W / 2 - 70, (bottom - top) / 2 - 16);
    const n = Math.max(3, cats.length);
    let max = 0;
    for (const s of series) for (const v of s.valores) if (Number.isFinite(v) && v > max) max = v;
    max = max || 1;
    const ponto = (i: number, frac: number) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      return [cx + r * frac * Math.cos(a), cy + r * frac * Math.sin(a)] as const;
    };
    for (let anel = 1; anel <= 4; anel++) {
      const d = cats.map((_c, i) => { const p = ponto(i, anel / 4); return `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`; }).join(" ");
      parts.push(`<path d="${d} Z" fill="none" stroke="#eee"/>`);
    }
    cats.forEach((c, i) => {
      const p = ponto(i, 1);
      parts.push(`<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="#eee"/>`);
      const pl = ponto(i, 1.14);
      parts.push(`<text x="${pl[0].toFixed(1)}" y="${(pl[1] + 3).toFixed(1)}" text-anchor="middle" font-size="10" fill="#555">${esc(c.slice(0, 12))}</text>`);
    });
    series.forEach((s, si) => {
      const d = cats.map((_c, i) => {
        const p = ponto(i, Math.max(0, s.valores[i] ?? 0) / max);
        return `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
      }).join(" ");
      parts.push(`<path d="${d} Z" fill="${cor(si)}" fill-opacity="0.16" stroke="${cor(si)}" stroke-width="2"/>`);
    });
    if (series.length > 1) parts.push(legenda());
    parts.push("</svg>");
    return parts.join("");
  }

  // Eixos cartesianos (colunas/barras/linha/área/combo, empilhados ou não).
  const empilhado = spec.tipo === "colunas_emp" || spec.tipo === "barras_emp" || spec.tipo === "area_emp";
  const horizontal = spec.tipo === "barras" || spec.tipo === "barras_emp";
  const left = 46, right = W - 20;
  const plotW = right - left, plotH = bottom - top;
  const val = (si: number, ci: number) => Math.max(0, series[si]?.valores[ci] ?? 0);
  let max = 0;
  if (empilhado) {
    // Empilhado: a escala é a SOMA da categoria, não o maior valor isolado.
    cats.forEach((_c, ci) => { const soma = series.reduce((a, _s, si) => a + val(si, ci), 0); if (soma > max) max = soma; });
  } else {
    for (const s of series) for (const v of s.valores) if (Number.isFinite(v) && v > max) max = v;
  }
  max = max || 1;
  const nTicks = 4;
  for (let t = 0; t <= nTicks; t++) {
    const y = bottom - (plotH * t) / nTicks;
    parts.push(`<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="#eee"/>`);
    parts.push(`<text x="${left - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#999">${fmt((max * t) / nTicks)}</text>`);
  }

  if (horizontal) {
    const bandH = plotH / cats.length;
    cats.forEach((c, ci) => {
      if (empilhado) {
        let x = left;
        series.forEach((_s, si) => {
          const w = (val(si, ci) / max) * plotW;
          parts.push(`<rect x="${x.toFixed(1)}" y="${(top + ci * bandH + bandH * 0.15).toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${(bandH * 0.7).toFixed(1)}" fill="${cor(si)}"/>`);
          x += w;
        });
      } else {
        const bh = (bandH * 0.7) / series.length;
        series.forEach((_s, si) => {
          const w = (val(si, ci) / max) * plotW;
          const y = top + ci * bandH + bandH * 0.15 + si * bh;
          parts.push(`<rect x="${left}" y="${y.toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${(bh * 0.9).toFixed(1)}" fill="${cor(si)}" rx="2"/>`);
        });
      }
      parts.push(`<text x="${left - 6}" y="${(top + ci * bandH + bandH / 2 + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#555">${esc(c.slice(0, 14))}</text>`);
    });
  } else {
    const bandW = plotW / cats.length;
    cats.forEach((c, ci) => {
      parts.push(`<text x="${(left + ci * bandW + bandW / 2).toFixed(1)}" y="${(bottom + 14).toFixed(1)}" text-anchor="middle" font-size="10" fill="#555">${esc(c.slice(0, 12))}</text>`);
    });
    // COMBO: 1ª série em colunas, as demais em linha (sobrepostas).
    const seriesColuna = spec.tipo === "combo" ? [0] : spec.tipo === "colunas" || spec.tipo === "colunas_emp" ? series.map((_s, i) => i) : [];
    const seriesLinha = series.map((_s, i) => i).filter((i) => !seriesColuna.includes(i));
    if (seriesColuna.length) {
      if (empilhado) {
        cats.forEach((_c, ci) => {
          let y = bottom;
          seriesColuna.forEach((si) => {
            const h = (val(si, ci) / max) * plotH;
            y -= h;
            parts.push(`<rect x="${(left + ci * bandW + bandW * 0.15).toFixed(1)}" y="${y.toFixed(1)}" width="${(bandW * 0.7).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" fill="${cor(si)}"/>`);
          });
        });
      } else {
        const bw = (bandW * 0.7) / seriesColuna.length;
        cats.forEach((_c, ci) => {
          seriesColuna.forEach((si, k) => {
            const h = (val(si, ci) / max) * plotH;
            const x = left + ci * bandW + bandW * 0.15 + k * bw;
            parts.push(`<rect x="${x.toFixed(1)}" y="${(bottom - h).toFixed(1)}" width="${(bw * 0.9).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" fill="${cor(si)}" rx="2"/>`);
          });
        });
      }
    }
    // Linha / área (também as séries "extras" do combo). Área empilhada acumula.
    const acumulado = cats.map(() => 0);
    seriesLinha.forEach((si) => {
      const pts = cats.map((_c, ci) => {
        const v = empilhado ? (acumulado[ci] = (acumulado[ci] ?? 0) + val(si, ci)) : val(si, ci);
        return [left + ci * bandW + bandW / 2, bottom - (v / max) * plotH] as const;
      });
      const d = pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
      if (spec.tipo === "area" || spec.tipo === "area_emp") {
        const area = `${d} L ${pts[pts.length - 1]![0].toFixed(1)} ${bottom} L ${pts[0]![0].toFixed(1)} ${bottom} Z`;
        parts.push(`<path d="${area}" fill="${cor(si)}" fill-opacity="${empilhado ? "0.5" : "0.18"}"/>`);
      }
      parts.push(`<path d="${d}" fill="none" stroke="${cor(si)}" stroke-width="2.5"/>`);
      pts.forEach((p) => parts.push(`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${cor(si)}"/>`));
    });
  }

  if (series.length > 1) parts.push(legenda());
  parts.push("</svg>");
  return parts.join("");
}
