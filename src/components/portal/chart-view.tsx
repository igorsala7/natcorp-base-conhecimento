"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  ZAxis,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
} from "recharts";
import type { ChartData, ChartRow } from "@/lib/blocks/schema";
import { chartIsCircular } from "@/lib/blocks/schema";

/**
 * Render de gráfico (Recharts) — usado no portal E no editor (prévia). É o mesmo
 * `ChartData` para todos os tipos: trocar o tipo NÃO mexe nos dados. Client-only
 * porque Recharts mede o container; o corpo do artigo é server component e só
 * monta este `<ChartView>`.
 */

// Paleta: marca primeiro (roxo/rosa/azul), depois cores distintas p/ +séries.
const PALETTE = [
  "#511C76",
  "#C95788",
  "#2C1A63",
  "#2563EB",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#0EA5E9",
  "#EC4899",
];

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function mediana(vals: number[]): number | null {
  const xs = vals.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m]! : (xs[m - 1]! + xs[m]!) / 2;
}

const eixoStyle = { fontSize: 12, fill: "var(--color-text-muted)" };
const gridStroke = "var(--color-border)";

export function ChartView({ data }: { data: ChartData }) {
  const { chartType, xKey, series, zKey, title, legend = true, grid = true } = data;
  const rows = data.rows ?? [];
  const cor = (i: number) => series[i]?.color || PALETTE[i % PALETTE.length];

  // Coage os valores das séries (e Z) para número — CSV/planilha vem como texto.
  const dados: ChartRow[] = rows.map((r) => {
    const o: ChartRow = { ...r };
    for (const s of series) o[s.key] = num(r[s.key]);
    if (zKey) o[zKey] = num(r[zKey]);
    return o;
  });

  const med =
    data.showMedian && series.length
      ? mediana(dados.flatMap((r) => series.map((s) => num(r[s.key]))))
      : null;

  const vazio = dados.length === 0 || series.length === 0;

  const comum = (
    <>
      {grid && <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />}
      <Tooltip
        contentStyle={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          fontSize: 13,
        }}
      />
      {legend && series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
      {med != null && (
        <ReferenceLine
          y={med}
          stroke="#C95788"
          strokeDasharray="5 4"
          label={{ value: `Mediana ${med}`, position: "right", fill: "#C95788", fontSize: 11 }}
        />
      )}
    </>
  );

  function grafico() {
    switch (chartType) {
      case "column":
      case "stackedColumn":
        return (
          <BarChart data={dados}>
            {comum}
            <XAxis dataKey={xKey} tick={eixoStyle} />
            <YAxis tick={eixoStyle} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={cor(i)}
                radius={[4, 4, 0, 0]}
                stackId={chartType === "stackedColumn" ? "s" : undefined}
              />
            ))}
          </BarChart>
        );
      case "bar":
        return (
          <BarChart data={dados} layout="vertical">
            {comum}
            <XAxis type="number" tick={eixoStyle} />
            <YAxis type="category" dataKey={xKey} tick={eixoStyle} width={110} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={cor(i)} radius={[0, 4, 4, 0]} />
            ))}
          </BarChart>
        );
      case "line":
        return (
          <LineChart data={dados}>
            {comum}
            <XAxis dataKey={xKey} tick={eixoStyle} />
            <YAxis tick={eixoStyle} />
            {series.map((s, i) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={cor(i)}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        );
      case "area":
      case "stackedArea":
        return (
          <AreaChart data={dados}>
            {comum}
            <XAxis dataKey={xKey} tick={eixoStyle} />
            <YAxis tick={eixoStyle} />
            {series.map((s, i) => (
              <Area
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={cor(i)}
                fill={cor(i)}
                fillOpacity={0.18}
                strokeWidth={2}
                stackId={chartType === "stackedArea" ? "s" : undefined}
              />
            ))}
          </AreaChart>
        );
      case "combo":
        return (
          <ComposedChart data={dados}>
            {comum}
            <XAxis dataKey={xKey} tick={eixoStyle} />
            <YAxis tick={eixoStyle} />
            {series.map((s, i) =>
              i === 0 ? (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={cor(i)} radius={[4, 4, 0, 0]} />
              ) : (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stroke={cor(i)}
                  strokeWidth={2}
                  dot={false}
                />
              ),
            )}
          </ComposedChart>
        );
      case "pie":
      case "donut": {
        const chave = series[0]!.key;
        return (
          <PieChart>
            <Tooltip
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                fontSize: 13,
              }}
            />
            {legend && <Legend wrapperStyle={{ fontSize: 12 }} />}
            <Pie
              data={dados}
              dataKey={chave}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius="80%"
              innerRadius={chartType === "donut" ? "55%" : 0}
              paddingAngle={chartType === "donut" ? 2 : 0}
              label={(e: { name?: string }) => e.name ?? ""}
            >
              {dados.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        );
      }
      case "scatter":
      case "bubble": {
        const xNum = series[0]?.key ?? xKey;
        const yNum = series[1]?.key ?? series[0]?.key ?? xKey;
        return (
          <ScatterChart>
            {comum}
            <XAxis type="number" dataKey={xNum} name={series[0]?.label ?? xKey} tick={eixoStyle} />
            <YAxis type="number" dataKey={yNum} name={series[1]?.label ?? ""} tick={eixoStyle} />
            {chartType === "bubble" && zKey && <ZAxis type="number" dataKey={zKey} range={[60, 600]} />}
            <Scatter data={dados} fill={cor(0)} />
          </ScatterChart>
        );
      }
      case "radar":
        return (
          <RadarChart data={dados}>
            <PolarGrid stroke={gridStroke} />
            <PolarAngleAxis dataKey={xKey} tick={eixoStyle} />
            <PolarRadiusAxis tick={eixoStyle} />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                fontSize: 13,
              }}
            />
            {legend && series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s, i) => (
              <Radar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={cor(i)}
                fill={cor(i)}
                fillOpacity={0.18}
              />
            ))}
          </RadarChart>
        );
      default:
        return <div />;
    }
  }

  return (
    <figure className="not-prose my-6">
      {title && (
        <figcaption className="mb-2 text-center text-sm font-semibold text-text">{title}</figcaption>
      )}
      {vazio ? (
        <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-text-muted">
          Sem dados para exibir — adicione dados nas propriedades do gráfico.
        </div>
      ) : (
        <div className="w-full" style={{ height: chartIsCircular(chartType) ? 300 : 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            {grafico()}
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}
