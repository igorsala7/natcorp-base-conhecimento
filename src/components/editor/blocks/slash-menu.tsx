"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
import type { BlockType, ChartType } from "@/lib/blocks/schema";
import { CHART_TYPES } from "@/lib/blocks/schema";
import { slashBlocks, CATEGORIES, COMING_SOON, type BlockMeta } from "@/lib/blocks/registry.meta";

type Props = {
  rect: DOMRect;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
  /** Inserir um gráfico já com o tipo escolhido no submenu "Gráficos". */
  onSelectChart?: (chartType: ChartType) => void;
  /** Snippets da documentação — inserir trecho reutilizável por NOME. */
  snippets?: { key: string; title: string }[];
  onSelectSnippet?: (key: string) => void;
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function SlashMenu({ rect, onSelect, onClose, onSelectChart, snippets = [], onSelectSnippet }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Submenu "Gráficos": clicar no bloco Gráfico abre a lista de tipos aqui.
  const [sub, setSub] = useState<null | "chart">(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => slashBlocks(), []);
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return all;
    return all.filter(
      (b) => norm(b.label).includes(q) || b.keywords.some((k) => norm(k).includes(q)),
    );
  }, [all, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Agrupa por categoria, na ordem de CATEGORIES.
  const groups = CATEGORIES.map((cat) => ({
    cat,
    items: filtered.filter((b) => b.category === cat.key),
  })).filter((g) => g.items.length > 0 || g.cat.comingSoon);

  const snippetsFiltrados = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return snippets;
    return snippets.filter((sn) => norm(sn.title).includes(q));
  }, [snippets, query]);

  // Itens "planos" para navegação por teclado: blocos primeiro, snippets no fim.
  const flat: ({ kind: "block"; type: BlockType } | { kind: "snippet"; key: string })[] = [
    ...groups.flatMap((g) => g.items.map((b) => ({ kind: "block" as const, type: b.type }))),
    ...snippetsFiltrados.map((sn) => ({ kind: "snippet" as const, key: sn.key })),
  ];

  // Tipos de gráfico do submenu (filtrados pela busca também).
  const chartItems = useMemo(() => {
    const q = norm(query.trim());
    return q ? CHART_TYPES.filter((t) => norm(t.label).includes(q)) : CHART_TYPES;
  }, [query]);

  function choose(i: number) {
    if (sub === "chart") {
      const t = chartItems[i];
      if (t) onSelectChart?.(t.type);
      return;
    }
    const item = flat[i];
    if (!item) return;
    if (item.kind === "block") {
      // Gráfico não insere direto: abre o submenu com os tipos.
      if (item.type === "chart" && onSelectChart) {
        setSub("chart");
        setActive(0);
        setQuery("");
        return;
      }
      onSelect(item.type);
    } else onSelectSnippet?.(item.key);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const n = sub === "chart" ? chartItems.length : flat.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(n - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (sub) {
        setSub(null);
        setActive(0);
      } else onClose();
    } else if (e.key === "ArrowLeft" && sub) {
      e.preventDefault();
      setSub(null);
      setActive(0);
    }
  }

  // Posiciona abaixo do caret/bloco, sem sair da viewport.
  const top = Math.min(rect.bottom + 6, window.innerHeight - 340);
  const left = Math.min(rect.left, window.innerWidth - 300);

  let flatIndex = -1;

  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div
        className="fixed z-50 w-72 overflow-hidden rounded-lg border border-border bg-surface shadow-2"
        style={{ top, left }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={sub === "chart" ? "Buscar tipo de gráfico…" : "Buscar bloco…"}
          className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
        />
        <div className="max-h-72 overflow-auto p-1">
          {sub === "chart" && (
            <div>
              <button
                type="button"
                onClick={() => {
                  setSub(null);
                  setActive(0);
                }}
                className="mb-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-text-muted hover:bg-surface-2"
              >
                <ChevronLeft className="size-3.5" /> Gráficos
              </button>
              {chartItems.map((t, i) => (
                <button
                  key={t.type}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => onSelectChart?.(t.type)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm ${
                    active === i ? "bg-surface-2" : ""
                  }`}
                >
                  <span className="flex size-7 items-center justify-center rounded-md border border-border">
                    <BarChart3 className="size-4" />
                  </span>
                  {t.label}
                </button>
              ))}
              {chartItems.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-text-muted">Nenhum tipo.</p>
              )}
            </div>
          )}
          {sub !== "chart" &&
            groups.map((g) => (
            <div key={g.cat.key}>
              <p className="px-2 pb-0.5 pt-2 text-2xs font-medium uppercase tracking-wide text-text-muted">
                {g.cat.label}
              </p>
              {g.items.map((b: BlockMeta) => {
                flatIndex++;
                const i = flatIndex;
                const Icon = b.icon;
                return (
                  <button
                    key={b.type}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm ${
                      active === i ? "bg-surface-2" : ""
                    }`}
                  >
                    <span className="flex size-7 items-center justify-center rounded-md border border-border">
                      <Icon className="size-4" />
                    </span>
                    <span className="flex-1">{b.label}</span>
                    {b.type === "chart" && onSelectChart && (
                      <ChevronRight className="size-4 text-text-muted" />
                    )}
                  </button>
                );
              })}
              {g.cat.comingSoon &&
                COMING_SOON.filter((c) => c.category === g.cat.key).map((c) => {
                  const Icon = c.icon;
                  return (
                    <div
                      key={c.label}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm opacity-50"
                    >
                      <span className="flex size-7 items-center justify-center rounded-md border border-border">
                        <Icon className="size-4" />
                      </span>
                      <span className="flex-1">{c.label}</span>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-2xs text-text-muted">Em breve</span>
                    </div>
                  );
                })}
            </div>
          ))}
          {sub !== "chart" && snippetsFiltrados.length > 0 && (
            <div>
              <p className="px-2 pb-0.5 pt-2 text-2xs font-medium uppercase tracking-wide text-text-muted">
                Snippets (reutilizáveis)
              </p>
              {snippetsFiltrados.map((sn) => {
                flatIndex++;
                const i = flatIndex;
                return (
                  <button
                    key={sn.key}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm ${
                      active === i ? "bg-surface-2" : ""
                    }`}
                  >
                    <span className="flex size-7 items-center justify-center rounded-md border border-dashed border-border text-2xs font-semibold">
                      ↺
                    </span>
                    {sn.title}
                  </button>
                );
              })}
            </div>
          )}
          {sub !== "chart" && flat.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-text-muted">Nenhum bloco encontrado.</p>
          )}
        </div>
      </div>
    </>
  );
}
