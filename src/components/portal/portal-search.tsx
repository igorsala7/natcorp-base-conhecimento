"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Sparkles, LifeBuoy, CornerDownLeft, Clock } from "lucide-react";
import { searchPortal, type PortalHit } from "@/app/(portal)/actions";
import { AskAiPanel } from "@/components/portal/ask-ai";
import { useFocoPreso } from "@/components/ui/use-foco-preso";

const OPEN_EVENT = "portal:open-search";
const ASK_EVENT = "portal:open-ai";
const RECENT_KEY = (slug: string) => `kb.portal.recent.${slug}`;

/** Botão que abre o painel "Perguntar à IA". */
export function AskTrigger({
  label = "Perguntar à IA",
  tone = "default",
}: {
  label?: string;
  /** `band`: versão para fundo escuro/colorido (o hero com faixa da home). */
  tone?: "default" | "band";
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(ASK_EVENT))}
      className={
        tone === "band"
          ? "flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/15 px-2.5 py-1.5 text-sm font-medium text-white transition hover:bg-white/25"
          : "flex items-center gap-1.5 rounded-lg border border-primary/40 bg-brand-purple-50 px-2.5 py-1.5 text-sm font-medium text-primary transition hover:bg-brand-purple-100 dark:bg-brand-purple-950/40 dark:hover:bg-brand-purple-950/60"
      }
    >
      <SparklesMini />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function SparklesMini() {
  return <Sparkles className="size-4" />;
}

/** Botão que abre a busca. Use no header (compacto) ou no hero (grande). */
export function SearchTrigger({
  variant = "header",
  placeholder = "Buscar na documentação…",
}: {
  variant?: "header" | "hero";
  placeholder?: string;
}) {
  const open = () => window.dispatchEvent(new CustomEvent(OPEN_EVENT));
  if (variant === "hero") {
    // Variante grande do hero: borda white/20 (vive sobre a faixa escura) e
    // anel de foco de 4px em white/25 no lugar do outline padrão.
    return (
      <button
        type="button"
        onClick={open}
        className="flex w-full items-center gap-3 rounded-lg border border-white/20 bg-surface px-5 py-3.5 text-left text-text-muted shadow-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/25"
      >
        <Search className="size-5 shrink-0" />
        <span className="flex-1 text-base">{placeholder}</span>
        <kbd className="hidden rounded-sm border border-border bg-surface-2 px-2 py-0.5 font-mono text-2xs text-text-muted sm:inline">
          ⌘K
        </kbd>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Buscar"
      className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm text-text-muted shadow-1 transition hover:border-brand-purple-300 focus-visible:border-brand-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-100 dark:hover:border-brand-purple-700 dark:focus-visible:border-brand-purple-700 dark:focus-visible:ring-brand-purple-900"
    >
      <Search className="size-4" />
      <span className="hidden sm:inline">Buscar</span>
      <kbd className="hidden rounded-sm border border-border bg-surface-2 px-2 py-0.5 font-mono text-2xs text-text-muted sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}

/**
 * Camada interativa do portal (montada uma vez no shell): modal de busca
 * (Cmd+K) + painel "Perguntar à IA". Abre via evento global ou atalho.
 */
export function PortalAssistant({
  spaceSlug,
  supportUrl,
  sugestoes,
}: {
  spaceSlug: string;
  supportUrl?: string;
  /** Perguntas de partida do assistente (tema do espaço → `ia.sugestoes`). */
  sugestoes?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PortalHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [ask, setAsk] = useState<{ open: boolean; question?: string }>({ open: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  // Busca do portal é modal: sem a armadilha, Tab saía do painel e percorria os
  // links do artigo por trás do scrim. O mesmo hook do Dialog/Sheet.
  useFocoPreso(open, painelRef, () => setOpen(false));

  // Abre por atalho (⌘K/Ctrl+K, "/") e por evento global.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onAsk = () => {
      setOpen(false);
      setAsk({ open: true });
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (
        e.key === "/" &&
        !/input|textarea/i.test((e.target as HTMLElement)?.tagName ?? "")
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(ASK_EVENT, onAsk);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(ASK_EVENT, onAsk);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (open) {
      setQ("");
      setHits([]);
      setActive(0);
      try {
        setRecent(JSON.parse(localStorage.getItem(RECENT_KEY(spaceSlug)) || "[]"));
      } catch {
        setRecent([]);
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, spaceSlug]);

  // Busca com debounce.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const t = setTimeout(async () => {
      const r = await searchPortal(spaceSlug, term);
      setHits(r);
      setActive(0);
      setLoading(false);
    }, 150);
    return () => clearTimeout(t);
  }, [q, open, spaceSlug]);

  const go = useCallback(
    (hit: PortalHit) => {
      const term = q.trim();
      if (term) {
        const next = [term, ...recent.filter((r) => r !== term)].slice(0, 6);
        localStorage.setItem(RECENT_KEY(spaceSlug), JSON.stringify(next));
      }
      setOpen(false);
      router.push(hit.url);
    },
    [q, recent, router, spaceSlug],
  );

  function openAsk() {
    setOpen(false);
    setAsk({ open: true, question: q.trim() || undefined });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hits[active]) go(hits[active]!);
      else if (q.trim().length >= 2) openAsk();
    }
  }

  const term = q.trim();
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
        >
          <div
            className="absolute inset-0 bg-black/40 motion-safe:animate-[fade_150ms_ease-out]"
            onClick={() => setOpen(false)}
            role="presentation"
          />
          {/* `role="dialog"` desceu do invólucro para o PAINEL: no invólucro ele
              englobava o scrim, e o leitor de tela anunciava o fundo como parte
              do diálogo. Com `aria-modal` e o foco preso, o resto da página sai
              da árvore de acessibilidade — que é o que o atributo promete. */}
          <div
            ref={painelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Buscar na documentação"
            className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2 motion-safe:animate-[scalein_150ms_ease-out]"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-5 shrink-0 text-text-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Buscar na documentação…"
                aria-label="Buscar"
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-text-muted"
              />
              <kbd className="hidden rounded-sm border border-border bg-surface-2 px-2 py-0.5 font-mono text-2xs text-text-muted sm:inline">
                Esc
              </kbd>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {/* Sem termo → buscas recentes */}
              {term.length < 2 && recent.length > 0 && (
                <div className="px-3 py-2">
                  <p className="mb-1 text-xs font-medium text-text-muted">Buscas recentes</p>
                  {recent.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setQ(r)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2"
                    >
                      <Clock className="size-4 text-text-muted" /> {r}
                    </button>
                  ))}
                </div>
              )}
              {term.length < 2 && recent.length === 0 && (
                <p className="px-4 py-5 text-center text-sm text-text-muted">
                  Digite para buscar nesta documentação.
                </p>
              )}

              {/* Carregando */}
              {term.length >= 2 && loading && (
                <div className="space-y-2 p-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />
                  ))}
                </div>
              )}

              {/* Resultados: linhas de sangria total com divisor fraco entre
                  elas (o último item fica sem), como no dropdown da referência. */}
              {term.length >= 2 && !loading && hits.length > 0 && (
                <ul className="divide-y divide-brand-gray-100 dark:divide-brand-gray-800">
                  {hits.map((h, i) => (
                    <li key={h.node_id + i}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(h)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                          i === active ? "bg-brand-purple-50/60 dark:bg-brand-purple-950/30" : ""
                        }`}
                      >
                        <FileText className="mt-0.5 size-4 shrink-0 text-text-muted" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{h.title}</span>
                          {h.heading_path && (
                            <span className="block truncate text-xs text-text-muted">
                              {h.heading_path}
                            </span>
                          )}
                          {h.snippet && (
                            <span
                              className="mt-0.5 block line-clamp-1 text-xs text-text-muted"
                              // ts_headline devolve HTML com <b> nos termos.
                              dangerouslySetInnerHTML={{ __html: h.snippet }}
                            />
                          )}
                        </span>
                        {i === active && (
                          <CornerDownLeft className="mt-0.5 size-3.5 shrink-0 text-text-muted" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Sem resultado → Ask-AI + contato */}
              {term.length >= 2 && !loading && hits.length === 0 && (
                <div className="px-4 py-5 text-center">
                  <p className="text-sm text-text-muted">
                    Nenhum resultado para <span className="font-medium text-text">“{term}”</span>.
                  </p>
                  <button
                    type="button"
                    onClick={openAsk}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg"
                  >
                    <Sparkles className="size-4" /> Perguntar à IA
                  </button>
                  {supportUrl && (
                    <a
                      href={supportUrl}
                      className="mt-2 flex items-center justify-center gap-1 text-xs text-text-muted hover:text-primary"
                    >
                      <LifeBuoy className="size-3.5" /> Falar com o suporte
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé: sempre oferece o Ask-AI */}
            {term.length >= 2 && (
              <div className="border-t border-border px-3 py-2">
                <button
                  type="button"
                  onClick={openAsk}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-primary hover:bg-surface-2"
                >
                  <Sparkles className="size-4" /> Perguntar à IA sobre “{term}”
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <AskAiPanel
        spaceSlug={spaceSlug}
        open={ask.open}
        initialQuestion={ask.question}
        sugestoes={sugestoes}
        onClose={() => setAsk({ open: false })}
      />
    </>
  );
}
