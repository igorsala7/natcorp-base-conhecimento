"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BlockType } from "@/lib/blocks/schema";
import { slashBlocks, CATEGORIES, COMING_SOON, type BlockMeta } from "@/lib/blocks/registry.meta";

type Props = {
  rect: DOMRect;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function SlashMenu({ rect, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
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

  const flat = groups.flatMap((g) => g.items);

  function choose(i: number) {
    const item = flat[i];
    if (item) onSelect(item.type);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
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
          placeholder="Buscar bloco…"
          className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
        />
        <div className="max-h-72 overflow-auto p-1">
          {groups.map((g) => (
            <div key={g.cat.key}>
              <p className="px-2 pb-0.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
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
                    {b.label}
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
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-muted">Em breve</span>
                    </div>
                  );
                })}
            </div>
          ))}
          {flat.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-text-muted">Nenhum bloco encontrado.</p>
          )}
        </div>
      </div>
    </>
  );
}
