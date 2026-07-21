"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Search, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, controlClass } from "@/components/ui/input";
import type { ThemeLink } from "@/lib/portal/theme";

/** Artigo publicado do espaço, para o seletor de destaques. */
export type ArtigoDisponivel = { id: string; title: string; href: string };

/**
 * Seletor de estilo em cartões-rádio (hero e categorias usam o mesmo).
 * Miniatura desenhada em CSS puro — uma imagem estática mentiria o tema.
 */
export function SeletorEstilo<T extends string>({
  legenda,
  valor,
  opcoes,
  onChange,
}: {
  legenda: string;
  valor: T;
  opcoes: { value: T; rotulo: string; thumb: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-text">{legenda}</legend>
      <div className="grid grid-cols-3 gap-2">
        {opcoes.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer flex-col gap-1.5 rounded-lg border p-2 transition-colors ${
              valor === o.value
                ? "border-primary bg-brand-purple-50 dark:bg-brand-purple-950/30"
                : "border-border hover:border-border-strong"
            }`}
          >
            <input
              type="radio"
              name={legenda}
              value={o.value}
              checked={valor === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span className="block h-12 overflow-hidden rounded-md border border-border bg-bg">
              {o.thumb}
            </span>
            <span
              className={`text-center text-xs ${valor === o.value ? "font-medium text-primary" : "text-text-muted"}`}
            >
              {o.rotulo}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Editor de lista de links {rótulo, URL} — cabeçalho e rodapé usam o mesmo. */
export function LinksEditor({
  links,
  max,
  onChange,
}: {
  links: ThemeLink[];
  max: number;
  onChange: (links: ThemeLink[]) => void;
}) {
  const set = (i: number, patch: Partial<ThemeLink>) =>
    onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            value={l.label}
            onChange={(e) => set(i, { label: e.target.value })}
            placeholder="Rótulo"
            aria-label={`Rótulo do link ${i + 1}`}
            className="w-32 shrink-0"
            maxLength={40}
          />
          <Input
            value={l.url}
            onChange={(e) => set(i, { url: e.target.value })}
            placeholder="https://… ou /caminho"
            aria-label={`Endereço do link ${i + 1}`}
            className="min-w-0 flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            title="Remover link"
            onClick={() => onChange(links.filter((_, j) => j !== i))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      {links.length < max && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...links, { label: "", url: "" }])}
        >
          <Plus className="size-4" /> Adicionar link
        </Button>
      )}
    </div>
  );
}

/**
 * Curadoria dos "Artigos em destaque": busca no publicado, adiciona, remove e
 * reordena. Guarda só os IDs — o título vem sempre da árvore atual, então um
 * artigo renomeado não deixa um destaque desatualizado.
 */
export function DestaquesPicker({
  featured,
  disponiveis,
  max = 6,
  onChange,
}: {
  featured: string[];
  disponiveis: ArtigoDisponivel[];
  max?: number;
  onChange: (ids: string[]) => void;
}) {
  const [busca, setBusca] = useState("");
  const porId = useMemo(() => new Map(disponiveis.map((a) => [a.id, a])), [disponiveis]);

  const q = busca.trim().toLowerCase();
  const sugestoes = q
    ? disponiveis
        .filter((a) => !featured.includes(a.id) && a.title.toLowerCase().includes(q))
        .slice(0, 6)
    : [];

  const mover = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= featured.length) return;
    const next = [...featured];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {featured.length > 0 && (
        <ul className="space-y-1.5">
          {featured.map((id, i) => {
            const artigo = porId.get(id);
            return (
              <li
                key={id}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5"
              >
                <Star className="size-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {artigo?.title ?? "Artigo não publicado (não aparece na home)"}
                </span>
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  title="Subir"
                  className="rounded p-1 text-text-muted hover:text-text disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === featured.length - 1}
                  title="Descer"
                  className="rounded p-1 text-text-muted hover:text-text disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(featured.filter((f) => f !== id))}
                  title="Remover dos destaques"
                  className="rounded p-1 text-text-muted hover:text-brand-pink-700"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {featured.length < max ? (
        <div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar artigo publicado…"
              aria-label="Buscar artigo para destacar"
              className={`${controlClass} pl-8`}
            />
          </div>
          {sugestoes.length > 0 && (
            <ul className="mt-1 overflow-hidden rounded-md border border-border bg-surface">
              {sugestoes.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([...featured, a.id]);
                      setBusca("");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2"
                  >
                    <Plus className="size-3.5 shrink-0 text-text-muted" />
                    <span className="truncate">{a.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-text-muted">Máximo de {max} destaques.</p>
      )}
    </div>
  );
}
