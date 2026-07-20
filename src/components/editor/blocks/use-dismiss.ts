"use client";

import { useEffect, type RefObject } from "react";

/**
 * Fecha um popover ao clicar fora dele ou apertar Esc.
 *
 * Existe porque a barra do editor tem mais de um menu suspenso, e cada um
 * repetindo o mesmo `addEventListener` é onde nasce a inconsistência (um fecha
 * no Esc, o outro não).
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  aberto: boolean,
  fechar: () => void,
) {
  useEffect(() => {
    if (!aberto) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) fechar();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, aberto, fechar]);
}
