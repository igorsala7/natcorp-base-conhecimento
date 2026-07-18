"use client";

import { useState, type ReactNode } from "react";

/** Abas do portal: alterna a aba visível (server renderiza o conteúdo). */
export function PortalTabs({
  labels,
  panels,
}: {
  labels: string[];
  panels: ReactNode[];
}) {
  const [active, setActive] = useState(0);
  return (
    <div className="my-4 rounded-lg border border-border">
      <div className="flex gap-1 border-b border-border bg-surface-2 p-1">
        {labels.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={
              i === active
                ? "rounded px-3 py-1 text-sm font-medium text-primary"
                : "rounded px-3 py-1 text-sm text-text-muted hover:text-text"
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-4">{panels[active]}</div>
    </div>
  );
}
