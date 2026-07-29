"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChartView } from "./chart-view";
import { CHART_TIPOS, specToChartData, specToCsv, type ChartSpec, type ChartTipo } from "@/lib/chat/chart-spec";

const fmtNum = (v: number | undefined) => Number(v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Aba (Gráfico / Tabela). */
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors " +
        (active ? "border-primary/40 bg-primary/10 text-primary" : "border-transparent text-text-muted hover:text-text")
      }
    >
      {children}
    </button>
  );
}

/** Relatório tabular dos dados do gráfico (categorias × séries + total). */
function ChartTable({ spec }: { spec: ChartSpec }) {
  const cols = ["Categoria", ...spec.series.map((s) => s.nome)];
  return (
    <div className="max-h-[320px] overflow-auto">
      {spec.titulo && <div className="mb-2 text-center text-sm font-semibold text-text">{spec.titulo}</div>}
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th
                key={i}
                className={"sticky top-0 bg-primary px-2.5 py-1.5 font-semibold text-white " + (i ? "text-right" : "text-left")}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.categorias.map((cat, r) => (
            <tr key={r} className={r % 2 ? "bg-black/[.03]" : ""}>
              <td className="border-b border-border px-2.5 py-1.5 text-left">{cat}</td>
              {spec.series.map((s, si) => (
                <td key={si} className="border-b border-border px-2.5 py-1.5 text-right">
                  {fmtNum(s.valores[r])}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="border-t-2 border-border px-2.5 py-1.5 text-left font-bold">Total</td>
            {spec.series.map((s, si) => (
              <td key={si} className="border-t-2 border-border px-2.5 py-1.5 text-right font-bold">
                {fmtNum(s.valores.reduce((a, b) => a + (b || 0), 0))}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Dispara o download de um conteúdo (data URL). */
function baixar(nome: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = nome;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Serializa o <svg> do Recharts em PNG (fundo branco) e baixa. */
function exportarPng(container: HTMLElement | null, nome: string) {
  const svg = container?.querySelector("svg");
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    try {
      baixar(nome + ".png", canvas.toDataURL("image/png"));
    } catch {
      /* canvas "sujo" (raro): ignora */
    }
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
}

/** Card de gráfico interativo no Ask-AI do portal: troca de tipo + exportar CSV/PNG. */
export function AskAiChart({ spec }: { spec: ChartSpec }) {
  const [tipo, setTipo] = useState<ChartTipo>(spec.tipo);
  const [view, setView] = useState<"grafico" | "tabela">("grafico");
  const ref = useRef<HTMLDivElement>(null);
  const nome = spec.titulo || "grafico";
  const atual: ChartSpec = { ...spec, tipo };
  const grafico = view === "grafico";
  return (
    <div className="mt-2.5 rounded-xl border border-border bg-surface p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-end gap-1">
        <TabBtn active={grafico} onClick={() => setView("grafico")}>
          Gráfico
        </TabBtn>
        <TabBtn active={!grafico} onClick={() => setView("tabela")}>
          Tabela
        </TabBtn>
      </div>
      {grafico ? (
        <div ref={ref}>
          <ChartView data={specToChartData(atual)} />
        </div>
      ) : (
        <ChartTable spec={spec} />
      )}
      <div className="mt-1 flex items-center gap-2">
        {grafico && (
          <select
            aria-label="Tipo do gráfico"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as ChartTipo)}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text"
          >
            {CHART_TIPOS.map((t) => (
              <option key={t.tipo} value={t.tipo}>
                {t.label}
              </option>
            ))}
          </select>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() =>
            baixar(nome + ".csv", "data:text/csv;charset=utf-8," + encodeURIComponent("﻿" + specToCsv(atual)))
          }
          className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
        >
          ⬇ CSV
        </button>
        {grafico && (
          <button
            type="button"
            onClick={() => exportarPng(ref.current, nome)}
            className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
          >
            ⬇ PNG
          </button>
        )}
      </div>
    </div>
  );
}
