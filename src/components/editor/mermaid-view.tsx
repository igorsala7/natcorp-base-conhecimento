"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Renderiza um diagrama Mermaid (fluxograma, sequência, pizza, etc.). */
export function MermaidView({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    let cancelled = false;
    if (!code.trim()) {
      if (ref.current) ref.current.innerHTML = "";
      setError(null);
      return;
    }
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
        const id = "m" + rawId.replace(/[^a-zA-Z0-9]/g, "");
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro no diagrama");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, rawId]);

  return (
    <div className="my-5 overflow-hidden rounded-lg border border-border bg-surface shadow-1">
      {error ? (
        <div className="m-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 font-mono text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          Diagrama inválido: {error}
        </div>
      ) : (
        <div className="flex justify-center overflow-x-auto p-5">
          <div ref={ref} className="[&_svg]:h-auto [&_svg]:max-w-full" />
        </div>
      )}
    </div>
  );
}
