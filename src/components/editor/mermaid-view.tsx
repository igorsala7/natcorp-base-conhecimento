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
    <div className="my-4 flex justify-center overflow-x-auto rounded-lg border border-border bg-surface p-4">
      {error ? (
        <span className="text-sm text-brand-pink-700">Diagrama inválido: {error}</span>
      ) : (
        <div ref={ref} className="[&_svg]:max-w-full" />
      )}
    </div>
  );
}
