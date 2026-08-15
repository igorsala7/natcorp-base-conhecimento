"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";
import { cn } from "@/lib/utils";
import { scrollToElement } from "@/lib/portal/scroll";

export type TocItem = { id: string; text: string; level: number };

/** Índice da página com scroll-spy (destaca a seção visível). */
export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null);

  // Mesma lógica da árvore principal: ativo = TOPMOST na faixa de leitura, com
  // MARGEM DE SEGURANÇA abaixo do cabeçalho fixo (senão um item com fiapo no topo
  // continuava destacado). Ver [reading-scroll.tsx].
  useEffect(() => {
    if (items.length === 0) return;
    const visiveis = new Set<string>();
    const header = document.querySelector("header");
    const margemTopo = Math.round(header?.getBoundingClientRect().height ?? 0) + 48;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visiveis.add(entry.target.id);
          else visiveis.delete(entry.target.id);
        }
        const topo = items.find((it) => visiveis.has(it.id));
        if (topo) setActive(topo.id);
      },
      { rootMargin: `-${margemTopo}px 0px -55% 0px`, threshold: 0 },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Índice da página" className="text-[0.8125rem]">
      <div className="mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-text-muted">
        <List className="size-3.5" /> Nesta página
      </div>
      <ul className="border-l border-border">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                // Rola com a MESMA lógica da árvore (fixa o alvo enquanto imagens
                // carregam) em vez do hash nativo, que caía em posição obsoleta.
                const el = document.getElementById(item.id);
                if (el) {
                  e.preventDefault();
                  scrollToElement(el);
                }
              }}
              aria-current={active === item.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l-2 py-1 text-[0.8125rem] leading-[1.4] transition-colors",
                item.level === 3 ? "pl-6" : "pl-3",
                active === item.id
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-text-muted hover:border-brand-gray-300 hover:text-primary dark:hover:border-brand-gray-700",
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
