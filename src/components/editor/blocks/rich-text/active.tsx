"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import type { RichTextHandle } from "./rich-text";

type ActiveRef = { current: RichTextHandle | null };

const Ctx = createContext<ActiveRef | null>(null);

/**
 * Guarda qual <RichText> está em foco, para a barra de ferramentas do topo
 * conseguir formatar a seleção atual (os botões usam onMouseDown+preventDefault
 * para não tirar o foco/seleção do texto).
 */
export function ActiveRichTextProvider({ children }: { children: ReactNode }) {
  const ref = useRef<RichTextHandle | null>(null);
  return <Ctx.Provider value={ref}>{children}</Ctx.Provider>;
}

export function useActiveRichText(): ActiveRef | null {
  return useContext(Ctx);
}
