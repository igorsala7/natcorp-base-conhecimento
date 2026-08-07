"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Botão de copiar com confirmação DENTRO do próprio botão.
 *
 * O feedback fica no botão, e não num toast global, de propósito: numa tela de
 * log o usuário copia vários blocos em sequência, e um toast que diz só
 * "Copiado." não informa QUAL deles foi copiado.
 *
 * `navigator.clipboard` é `undefined` fora de contexto seguro (HTTP puro), daí
 * o acesso opcional — sem ele o clique lançaria e derrubaria o render.
 */
export function CopyButton({
  text,
  label = "Copiar",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // dentro de cartão clicável, copiar não deve abrir/fechar
        void navigator.clipboard?.writeText(text);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      }}
      title={label}
      className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:border-primary hover:text-primary ${className}`}
    >
      {copiado ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      <span aria-live="polite">{copiado ? "Copiado" : label}</span>
    </button>
  );
}
