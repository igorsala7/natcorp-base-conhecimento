"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type TocItem = { id: string; text: string; level: number };

/** Índice da página com scroll-spy (destaca a seção visível). */
export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
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
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Nesta página
      </div>
      <ul className="border-l border-border">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l-2 py-1.5 leading-snug transition-colors",
                item.level === 3 ? "pl-6" : "pl-3",
                active === item.id
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-text-muted hover:border-brand-gray-300 hover:text-text dark:hover:border-brand-gray-700",
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
