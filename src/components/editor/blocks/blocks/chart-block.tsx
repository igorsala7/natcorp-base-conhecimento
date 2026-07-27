"use client";

import type { Block } from "@/lib/blocks/schema";
import { CHART_TYPES } from "@/lib/blocks/schema";
import { ChartView } from "@/components/portal/chart-view";
import type { BlockEditProps } from "../edit-types";

/**
 * Gráfico no editor: mostra a PRÉVIA (mesmo componente do portal). A edição —
 * tipo, dados, X/Y/Z, mediana, colar/importar CSV — vive no painel de
 * propriedades (object-properties.tsx), então o bloco em si é só visual.
 */
export function ChartBlock({ block }: BlockEditProps) {
  const b = block as Extract<Block, { type: "chart" }>;
  const rotulo = CHART_TYPES.find((t) => t.type === b.data.chartType)?.label ?? "Gráfico";
  return (
    <div className="overflow-hidden rounded-lg border border-dashed border-border bg-surface-2">
      <div className="border-b border-border px-3 py-1.5 text-xs text-text-muted">
        Gráfico · {rotulo}
      </div>
      <div className="px-2">
        <ChartView data={b.data} />
      </div>
    </div>
  );
}
