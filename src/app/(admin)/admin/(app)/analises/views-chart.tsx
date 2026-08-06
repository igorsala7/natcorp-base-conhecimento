"use client";

import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { eyebrowLabel } from "@/components/ui/field";
import { controlClass } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { Select } from "@/components/ui/select";
import { comBase } from "@/lib/base-path";

type Ponto = { day: string; spaceId: string; views: number };

const W = 720;
const H = 180;
const PAD = { top: 12, right: 8, bottom: 22, left: 36 };

/**
 * Views por dia (90 dias) — série única, linha de 2px na cor da marca com
 * preenchimento sutil, grade recessiva, crosshair + tooltip no hover e filtro
 * por documentação. Sem legenda: uma série só, o título nomeia. Os valores
 * completos saem pelo CSV (visão de tabela).
 */
export function ViewsChart({
  pontos,
  spaces,
}: {
  pontos: Ponto[];
  spaces: { id: string; name: string }[];
}) {
  const [spaceId, setSpaceId] = useState<string>("all");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const serie = useMemo(() => {
    const porDia = new Map<string, number>();
    for (const p of pontos) {
      if (spaceId !== "all" && p.spaceId !== spaceId) continue;
      porDia.set(p.day, (porDia.get(p.day) ?? 0) + p.views);
    }
    // Dias contínuos (90): dia sem visita = 0, senão a linha mente pulando gaps.
    const dias: { day: string; views: number }[] = [];
    const hoje = new Date();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(hoje.getTime() - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      dias.push({ day: key, views: porDia.get(key) ?? 0 });
    }
    return dias;
  }, [pontos, spaceId]);

  const max = Math.max(1, ...serie.map((s) => s.views));
  const x = (i: number) => PAD.left + (i / (serie.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);

  const linha = serie.map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(s.views).toFixed(1)}`).join(" ");
  const area = `${linha} L${x(serie.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  const fmt = (day: string) => {
    const [, m, d] = day.split("-");
    return `${d}/${m}`;
  };

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const frac = (px - PAD.left) / (W - PAD.left - PAD.right);
    const i = Math.round(frac * (serie.length - 1));
    setHover(i >= 0 && i < serie.length ? i : null);
  }

  const gridY = [0.5, 1].map((f) => Math.round(max * f));

  return (
    <Surface elevation={1} padding="md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className={eyebrowLabel}>Visualizações por dia (90 dias)</p>
        <div className="flex items-center gap-2">
          <Select
            value={spaceId}
            onChange={(v) => setSpaceId(v)}
            aria-label="Filtrar por documentação"
            className={`${controlClass} h-8 w-auto text-xs`}
          >
            <option value="all">Todas as documentações</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <a
            href={comBase("/admin/analises/export")}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-text-muted transition-colors hover:border-primary hover:text-primary"
            title="Baixar os dados completos em CSV"
          >
            <Download className="size-3.5" /> CSV
          </a>
        </div>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Gráfico de visualizações por dia nos últimos 90 dias"
          className="block w-full"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* grade recessiva */}
          {gridY.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--color-border)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 6}
                y={y(v) + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--color-text-muted)"
              >
                {v}
              </text>
            </g>
          ))}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--color-border)"
            strokeWidth="1"
          />

          <path d={area} fill="var(--color-primary)" opacity="0.08" />
          <path d={linha} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" />

          {/* eixo X: primeiro, meio, último */}
          {[0, Math.floor(serie.length / 2), serie.length - 1].map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle"}
              fontSize="10"
              fill="var(--color-text-muted)"
            >
              {fmt(serie[i]!.day)}
            </text>
          ))}

          {hover !== null && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={y(0)}
                stroke="var(--color-text-muted)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={x(hover)}
                cy={y(serie[hover]!.views)}
                r="4"
                fill="var(--color-primary)"
                stroke="var(--color-surface)"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-2"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: `translateX(${hover > serie.length / 2 ? "-100%" : "0"})`,
            }}
          >
            <span className="font-medium tabular-nums">{serie[hover]!.views}</span>{" "}
            <span className="text-text-muted">
              visualizaç{serie[hover]!.views === 1 ? "ão" : "ões"} · {fmt(serie[hover]!.day)}
            </span>
          </div>
        )}
      </div>
    </Surface>
  );
}
