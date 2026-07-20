"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Ctx = {
  /** Artigo visível agora (destacado na árvore lateral). */
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  /** Artigos que estão NESTA página: clicar neles rola, em vez de navegar. */
  onPage: Map<string, string>; // nodeId → âncora
  setOnPage: (m: Map<string, string>) => void;
};

const ActiveArticleCtx = createContext<Ctx | null>(null);

/**
 * Liga a leitura (scroll) à árvore lateral: o conteúdo informa qual artigo está
 * visível e quais artigos estão na página; a navegação usa isso para destacar o
 * item certo e para rolar em vez de recarregar.
 */
export function ActiveArticleProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [onPage, setOnPageState] = useState<Map<string, string>>(new Map());
  const setOnPage = useCallback((m: Map<string, string>) => setOnPageState(m), []);
  const value = useMemo(
    () => ({ activeId, setActiveId, onPage, setOnPage }),
    [activeId, onPage, setOnPage],
  );
  return <ActiveArticleCtx.Provider value={value}>{children}</ActiveArticleCtx.Provider>;
}

export function useActiveArticle(): Ctx | null {
  return useContext(ActiveArticleCtx);
}
