"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { controlClass } from "./input";
import { cn } from "@/lib/utils";

/**
 * CAMPO DE BUSCA — a lupa, o campo e o botão de limpar, numa peça só.
 *
 * Este arranjo (wrapper `relative` + ícone `absolute` + campo com `pl-8`) estava
 * copiado em dez arquivos, e as cópias divergiram exatamente como o comentário
 * do `Toolbar` já previa. Três grafias para o mesmo controle:
 *
 *   · `cn(controlClass, "pl-8")`            → certo
 *   · `<Input className="pl-9" />`          → certo, com outro recuo
 *   · classe escrita à mão, com
 *     `outline-none focus:border-[var(--color-primary)]`  → SEM anel de foco
 *
 * A terceira é o defeito que importa: trocar a cor da borda não substitui o
 * anel. Quem navega por teclado perde de vista onde está, e a regra do
 * `globals.css` — "nunca `outline: none` sem substituto" — foi violada nas duas
 * telas que a copiaram… incluindo `ui/shuttle.tsx`, que é ele próprio um
 * primitivo. A divergência não parou na fronteira da pasta `ui/`.
 *
 * ── O botão de limpar ───────────────────────────────────────────────────────
 * Nenhuma das dez cópias tinha um. Para tirar o filtro era preciso selecionar o
 * texto e apagar — três gestos para desfazer um. Aqui ele aparece só quando há
 * o que limpar, devolve o foco ao campo (senão o foco cai no `<body>` e a
 * próxima tecla se perde) e some do fluxo de tabulação quando vazio.
 */
export const SearchInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
    value: string;
    onChange: (valor: string) => void;
    /**
     * Rótulo para leitor de tela. Obrigatório: `placeholder` NÃO é rótulo — some
     * quando se digita, e é o erro de forma mais comum em formulário.
     */
    label: string;
    className?: string;
    /** Classe do invólucro, para largura (`w-56`, `max-w-xs`, `flex-1`). */
    wrapperClassName?: string;
  }
>(function SearchInput(
  { value, onChange, label, placeholder = "Buscar…", className, wrapperClassName, ...props },
  ref,
) {
  const interno = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => interno.current!, []);

  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
      />
      <input
        ref={interno}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        placeholder={placeholder}
        // O anel de foco vem do `controlClass`, que é o ponto: um só lugar
        // decide como todo controle do produto acusa foco.
        className={cn(controlClass, "pl-8", value && "pr-8", className)}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            interno.current?.focus();
          }}
          aria-label={`Limpar ${label.toLowerCase()}`}
          className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
});
