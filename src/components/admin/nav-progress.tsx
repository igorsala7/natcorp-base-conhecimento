"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Barra fina de progresso no topo durante a navegação entre páginas — o clássico
 * "top loader". Dá retorno imediato ao clicar num link ou num item da árvore,
 * enquanto a próxima página carrega.
 *
 * Duas fontes acendem a barra:
 *  - clique em QUALQUER `<a>` interno (sidebar, breadcrumbs, cards) — capturado
 *    no documento, sem instrumentar link por link;
 *  - `nav.navigate(href)` — para navegação programática (abrir artigo da árvore),
 *    que usa `useTransition` e sabe exatamente quando a rota terminou de montar.
 */
type NavApi = {
  navigate: (href: string, opts?: { scroll?: boolean }) => void;
  /** Acende a barra manualmente (ex.: antes de um router.push próprio). */
  start: () => void;
};

const NavContext = createContext<NavApi | null>(null);

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav precisa de <NavProvider> na árvore.");
  return ctx;
}

export function NavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [anchorAtivo, setAnchorAtivo] = useState(false);
  const ativo = isPending || anchorAtivo;

  // Rota trocou de fato → apaga a barra acesa por clique em link. Sincroniza
  // com o pathname do router (sistema externo), por isso o setState no efeito.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnchorAtivo(false);
  }, [pathname]);

  // Rede de segurança: nunca deixa a barra presa (navegação cancelada,
  // link que só muda a âncora, etc.).
  useEffect(() => {
    if (!anchorAtivo) return;
    const t = setTimeout(() => setAnchorAtivo(false), 8000);
    return () => clearTimeout(t);
  }, [anchorAtivo]);

  const start = useCallback(() => setAnchorAtivo(true), []);
  const navigate = useCallback(
    (href: string, opts?: { scroll?: boolean }) => {
      startTransition(() => router.push(href, opts));
    },
    [router],
  );

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Só clique simples de navegação — deixa passar novo-abas, download, etc.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const alvo = e.target as HTMLElement | null;
      const a = alvo?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || a.target === "_blank" || a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Mesma página (só query/âncora igual) não navega.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setAnchorAtivo(true);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const api = useMemo<NavApi>(() => ({ navigate, start }), [navigate, start]);

  return (
    <NavContext.Provider value={api}>
      <NavBar ativo={ativo} />
      {children}
    </NavContext.Provider>
  );
}

/** A barrinha em si: sobe até 90% enquanto navega e completa ao terminar. */
function NavBar({ ativo }: { ativo: boolean }) {
  const [estado, setEstado] = useState({ largura: 0, visivel: false });

  useEffect(() => {
    if (ativo) {
      // A transição CSS longa faz os 90% subirem devagar, dando sensação de carga.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEstado({ largura: 90, visivel: true });
      return;
    }
    setEstado((s) => (s.visivel ? { largura: 100, visivel: true } : s));
    const t = setTimeout(() => setEstado({ largura: 0, visivel: false }), 300);
    return () => clearTimeout(t);
  }, [ativo]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[150] h-0.5">
      <div
        className="h-full bg-primary transition-all ease-out"
        style={{
          width: `${estado.largura}%`,
          opacity: estado.visivel ? 1 : 0,
          transitionDuration: ativo ? "600ms" : "200ms",
        }}
      />
    </div>
  );
}
