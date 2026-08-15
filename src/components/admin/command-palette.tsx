"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, FileText, Search } from "lucide-react";
import { searchContent, registrarBusca, type SearchHit } from "@/app/(admin)/admin/(app)/search-actions";
import { buscarDestinos } from "@/lib/admin/busca-destinos";
import { Button } from "@/components/ui/button";
import { eyebrowLabel } from "@/components/ui/field";

const RECENT_KEY = "kb.recentSearches";

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveRecent(q: string) {
  const list = [q, ...loadRecent().filter((x) => x !== q)].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

/** Command palette de busca (Cmd/Ctrl+K). Debounce 150ms, teclado, recentes. */
export function CommandPalette({ permissoes = [] }: { permissoes?: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Atalho global de abertura.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("kb:open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("kb:open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setRecent(loadRecent());
  }, [open]);

  /**
   * Destinos são LOCAIS — o mapa de rotas está no bundle. Nada de debounce nem
   * de espera: enquanto o artigo ainda está vindo do banco, "ir para" já
   * respondeu. É o que faz a paleta poder substituir metade do menu.
   */
  const destinos = useMemo(() => buscarDestinos(query, new Set(permissoes)), [query, permissoes]);

  // Busca com debounce de 150ms (sincroniza com um sistema externo — a RPC).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 2) {
      setHits([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    debounce.current = setTimeout(async () => {
      const res = await searchContent(query);
      setHits(res.hits);
      setError(res.error ?? null);
      setActive(0);
      setLoading(false);
    }, 150);
  }, [query]);

  const go = useCallback(
    (hit: SearchHit) => {
      const q = query.trim();
      if (q) {
        saveRecent(q);
        // O registro acontece AQUI, quando a busca serviu — não a cada tecla.
        // Antes, digitar "férias" gravava `fé`, `féri`, `féria`, `férias`: três
        // linhas com zero resultado alimentando a métrica de "lacuna de
        // documentação" do Painel. O time fabricava buraco de conteúdo digitando.
        void registrarBusca(q, hits.length, "admin");
      }
      setOpen(false);
      setQuery("");
      router.push(`/admin/conteudo/${hit.node_id}`);
    },
    [router, query, hits.length],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      go(hits[active]);
    }
  }

  if (!open) return null;

  // Agrupa por categoria (raiz do heading_path).
  const groups = new Map<string, SearchHit[]>();
  for (const h of hits) {
    const cat = h.heading_path?.split(" > ")[0] ?? "Geral";
    const list = groups.get(cat) ?? [];
    list.push(h);
    groups.set(cat, list);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 text-text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar artigos, telas e ações…"
            className="h-12 flex-1 bg-transparent text-sm focus:outline-none"
          />
          <kbd className="rounded border border-border px-1.5 text-xs text-text-muted">
            ESC
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-auto p-2">
          {/* Destinos primeiro: são instantâneos e cobrem a navegação, que é o
              trabalho que o menu deixou de fazer ao encolher de 18 para 9. */}
          {destinos.length > 0 && (
            <div className="mb-1">
              <div className={`${eyebrowLabel} px-3 py-1`}>Ir para</div>
              {destinos.map((d) => {
                const Icone = d.icone;
                return (
                  <Button
                    key={d.href}
                    variant="ghost"
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      router.push(d.href);
                    }}
                    className="w-full justify-start gap-2.5 px-3 py-2 font-normal"
                  >
                    {Icone && <Icone className="shrink-0 text-text-muted" aria-hidden="true" />}
                    <span className="min-w-0 flex-1 truncate text-left">
                      {d.contexto && <span className="text-text-muted">{d.contexto} › </span>}
                      {d.rotulo}
                    </span>
                  </Button>
                );
              })}
            </div>
          )}

          {loading && <p className="px-3 py-4 text-sm text-text-muted">Buscando…</p>}

          {!loading && error && (
            <p className="px-3 py-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {!loading && !error && query.trim().length >= 2 && hits.length === 0 && destinos.length === 0 && (
            <p className="px-3 py-4 text-sm text-text-muted">
              Nada encontrado para “{query}”.
            </p>
          )}

          {!loading && query.trim().length < 2 && recent.length > 0 && (
            <div>
              <div className={`${eyebrowLabel} px-3 py-1`}>
                Buscas recentes
              </div>
              {recent.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setQuery(r)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2"
                >
                  <Clock className="size-4 text-text-muted" />
                  {r}
                </button>
              ))}
            </div>
          )}

          {[...groups.entries()].map(([cat, list]) => (
            <div key={cat} className="mb-2">
              <div className={`${eyebrowLabel} px-3 py-1`}>
                {cat}
              </div>
              {list.map((hit) => {
                const globalIdx = hits.indexOf(hit);
                return (
                  <button
                    key={hit.node_id}
                    type="button"
                    onMouseEnter={() => setActive(globalIdx)}
                    onClick={() => go(hit)}
                    className={
                      globalIdx === active
                        ? "flex w-full items-start gap-2 rounded-md bg-brand-purple-50 px-3 py-2 text-left dark:bg-brand-purple-950/40"
                        : "flex w-full items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-surface-2"
                    }
                  >
                    <FileText className="mt-0.5 size-4 shrink-0 text-text-muted" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {hit.title}
                      </span>
                      <span
                        className="block truncate text-xs text-text-muted [&_b]:text-primary"
                        dangerouslySetInnerHTML={{ __html: hit.snippet }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
