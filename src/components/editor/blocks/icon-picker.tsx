"use client";

import { createElement, useState } from "react";
import { Ban, ChevronDown } from "lucide-react";
import { ICONS, ICON_GROUPS } from "@/lib/blocks/icons";

/** Renderiza um ícone do catálogo pela chave (createElement evita o aviso de
 *  "componente criado durante o render" do compilador do React). */
function renderIcon(key: string | undefined, className: string) {
  const Icon = key ? ICONS[key] : undefined;
  return Icon ? createElement(Icon, { className }) : null;
}

/** Seletor de ícone da biblioteca (lucide), agrupado por tema. */
export function IconPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (key: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const hasIcon = !!(value && ICONS[value]);

  const q = query.trim().toLowerCase();
  const groups = ICON_GROUPS.map((g) => ({
    ...g,
    keys: g.keys.filter((k) => ICONS[k] && (!q || k.toLowerCase().includes(q))),
  })).filter((g) => g.keys.length > 0);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-bg px-2 py-1.5 text-sm hover:border-primary"
      >
        <span className="flex items-center gap-2">
          {hasIcon ? renderIcon(value, "size-4 text-primary") : <Ban className="size-4 text-text-muted" />}
          <span className={hasIcon ? "" : "text-text-muted"}>{hasIcon ? value : "Sem ícone"}</span>
        </span>
        <ChevronDown className="size-4 text-text-muted" />
      </button>

      {open && (
        <div className="mt-1 rounded-lg border border-border bg-surface p-2 shadow-2">
          <div className="mb-2 flex gap-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ícone…"
              className="w-full rounded-md border border-border bg-bg px-2 py-1 text-xs outline-none focus:border-primary"
            />
            <button
              type="button"
              title="Remover ícone"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className="rounded-md border border-border px-2 text-xs text-text-muted hover:border-primary hover:text-primary"
            >
              <Ban className="size-3.5" />
            </button>
          </div>
          <div className="max-h-56 overflow-auto">
            {groups.map((g) => (
              <div key={g.label} className="mb-2">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  {g.label}
                </p>
                <div className="grid grid-cols-8 gap-1">
                  {g.keys.map((k) => (
                    <button
                      key={k}
                      type="button"
                      title={k}
                      onClick={() => {
                        onChange(k);
                        setOpen(false);
                      }}
                      className={`flex size-7 items-center justify-center rounded-md border ${
                        value === k ? "border-primary text-primary" : "border-transparent text-text-muted"
                      } hover:border-primary hover:text-primary`}
                    >
                      {renderIcon(k, "size-4")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="py-4 text-center text-xs text-text-muted">Nenhum ícone encontrado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
