import Link from "next/link";
import { cn } from "@/lib/utils";

/** Abas entre as duas visões de rastreio (mesmos parâmetros p_*): conversas do
 *  chat e acessos às páginas. Preserva a documentação selecionada. */
export function TrackingTabs({ current, spaceId }: { current: "conversas" | "acessos"; spaceId: string }) {
  const tabs = [
    { key: "conversas", label: "Conversas", href: `/admin/conversas?space=${spaceId}` },
    { key: "acessos", label: "Acessos às páginas", href: `/admin/acessos?space=${spaceId}` },
  ] as const;
  return (
    <div className="mt-5 inline-flex rounded-lg border border-border bg-surface p-0.5">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={current === t.key ? "page" : undefined}
          className={cn(
            "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
            current === t.key
              ? "bg-primary text-white shadow-1"
              : "text-text-muted hover:text-text",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
