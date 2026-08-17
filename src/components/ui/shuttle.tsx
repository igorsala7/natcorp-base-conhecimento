"use client";

import { useMemo, useState } from "react";
import { ChevronsRight, ChevronsLeft } from "lucide-react";
import { SearchInput } from "./search-input";
import { cn } from "@/lib/utils";

export type ShuttleItem = { id: string; label: string; sub?: string };

/** Normaliza para busca (minúsculas, sem acento). */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Transfer-list (shuttle) com busca: duas colunas — Disponíveis × Selecionadas.
 * Clicar num item o move de lado; os botões movem todos os visíveis. A busca
 * filtra as duas colunas ao mesmo tempo. Controlado por `selected`/`onChange`.
 */
export function Shuttle({
  items,
  selected,
  onChange,
  leftTitle = "Disponíveis",
  rightTitle = "Selecionadas",
  emptyLeft = "Nada disponível.",
  emptyRight = "Nenhum selecionado.",
}: {
  items: ShuttleItem[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  leftTitle?: string;
  rightTitle?: string;
  emptyLeft?: string;
  emptyRight?: string;
}) {
  const [q, setQ] = useState("");
  const nq = norm(q.trim());

  const { available, chosen } = useMemo(() => {
    const casa = (i: ShuttleItem) => !nq || norm(i.label).includes(nq) || (i.sub ? norm(i.sub).includes(nq) : false);
    const av: ShuttleItem[] = [];
    const ch: ShuttleItem[] = [];
    for (const i of items) {
      if (!casa(i)) continue;
      (selected.has(i.id) ? ch : av).push(i);
    }
    return { available: av, chosen: ch };
  }, [items, selected, nq]);

  function set(next: Set<string>) {
    onChange(next);
  }
  function toggle(id: string) {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    set(n);
  }
  function addAllVisible() {
    const n = new Set(selected);
    for (const i of available) n.add(i.id);
    set(n);
  }
  function removeAllVisible() {
    const n = new Set(selected);
    for (const i of chosen) n.delete(i.id);
    set(n);
  }

  return (
    <div className="flex flex-col gap-2">
      <SearchInput value={q} onChange={setQ} label="Filtrar itens" placeholder="Filtrar…" />
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <Column
          title={leftTitle}
          count={available.length}
          items={available}
          empty={emptyLeft}
          onItem={toggle}
        />
        <div className="flex flex-col justify-center gap-1.5">
          <button
            type="button"
            onClick={addAllVisible}
            disabled={available.length === 0}
            title="Selecionar todos os visíveis"
            className="rounded-md border border-border bg-surface p-1.5 text-text-muted hover:text-text disabled:opacity-40"
          >
            <ChevronsRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={removeAllVisible}
            disabled={chosen.length === 0}
            title="Remover todos os visíveis"
            className="rounded-md border border-border bg-surface p-1.5 text-text-muted hover:text-text disabled:opacity-40"
          >
            <ChevronsLeft className="size-4" />
          </button>
        </div>
        <Column
          title={rightTitle}
          count={chosen.length}
          items={chosen}
          empty={emptyRight}
          onItem={toggle}
        />
      </div>
    </div>
  );
}

function Column({
  title,
  count,
  items,
  empty,
  onItem,
}: {
  title: string;
  count: number;
  items: ShuttleItem[];
  empty: string;
  onItem: (id: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border bg-surface-2/40">
      <div className="flex items-center justify-between border-b border-border px-2.5 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</span>
        <span className="text-xs tabular-nums text-text-muted">{count}</span>
      </div>
      {/* overflow-auto = rola nos DOIS eixos; o <ul> w-max cresce até o item
          mais largo (min-w-full mantém linhas curtas ocupando a coluna toda),
          então rótulos longos NÃO são cortados: rola na horizontal. */}
      <div className="slim-scroll max-h-56 min-h-[6rem] overflow-auto p-1">
        {items.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-text-muted">{empty}</p>
        ) : (
          <ul className="w-max min-w-full">
            {items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => onItem(i.id)}
                  title={i.sub ? `${i.label} — ${i.sub}` : i.label}
                  className={cn(
                    "flex w-full flex-col whitespace-nowrap rounded-md px-2 py-1.5 text-left text-sm text-text",
                    "hover:bg-[var(--color-primary)]/8 focus:bg-[var(--color-primary)]/8 focus:outline-none",
                  )}
                >
                  <span>{i.label}</span>
                  {i.sub && <span className="text-xs text-text-muted">{i.sub}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
