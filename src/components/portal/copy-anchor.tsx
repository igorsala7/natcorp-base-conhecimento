"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

/** Botão de copiar o link com âncora de um heading. */
export function CopyAnchor({ anchor }: { anchor: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copiar link para esta seção"
      onClick={async () => {
        const url = `${window.location.origin}${window.location.pathname}#${anchor}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-2 inline-flex align-middle text-text-muted opacity-0 transition group-hover:opacity-100"
    >
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
    </button>
  );
}
