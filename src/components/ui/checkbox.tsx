"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * CAIXA DE SELEÇÃO.
 *
 * Havia 67 `<input type="checkbox">` crus no produto, cada um com seu tamanho,
 * seu espaçamento e seu foco. Alguns tinham rótulo clicável, outros não — e um
 * rótulo que não alterna a caixa é um alvo de 16px onde deveria haver um alvo
 * do tamanho do texto.
 *
 * ── Checkbox × Switch ───────────────────────────────────────────────────────
 * Esta distinção precisa estar escrita, senão os dois viram sinônimos em duas
 * semanas:
 *
 *   · `Checkbox` — o valor só vale depois de SALVAR. É o caso de formulário.
 *   · `Switch`   — o efeito é imediato e reversível (ligar uma tool, ativar uma
 *                  chave). Um switch dentro de formulário mente: parece que já
 *                  ligou, e não ligou.
 *
 * Na dúvida, `Checkbox`. Um switch que na verdade precisa de "Salvar" é pior
 * que uma caixa que poderia ter sido switch.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Obrigatório: caixa sem rótulo é um alvo sem nome para leitor de tela. */
  label: ReactNode;
  /** A consequência da escolha, quando ela não é óbvia pelo rótulo. */
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const auto = useId();
  const meuId = id ?? auto;

  return (
    <label
      htmlFor={meuId}
      className={cn(
        "flex items-start gap-2.5",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      )}
    >
      <input
        id={meuId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        // `mt-0.5` alinha a caixa com a PRIMEIRA linha do rótulo, não com o
        // centro do bloco — em rótulo de duas linhas, centralizar deixa a caixa
        // flutuando no meio do texto.
        className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-[var(--color-primary)]"
      />
      <span className="min-w-0 text-xs">
        <span className="font-medium text-text">{label}</span>
        {description && <span className="block text-text-muted">{description}</span>}
      </span>
    </label>
  );
}
