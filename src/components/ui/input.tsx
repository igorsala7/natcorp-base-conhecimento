import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Aparência única para TODO controle de formulário (input, select, textarea).
 * Sem isto, cada tela reinventa altura, raio e borda — é o que faz o
 * formulário parecer montado por pessoas diferentes.
 */
export const controlClass = cn(
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text",
  "placeholder:text-text-muted",
  "transition-colors",
  // Foco do catálogo: borda roxa + anel de 2px (box-shadow via ring). O anel
  // substitui o outline e é sempre visível — a acessibilidade do foco vem dele.
  "focus:outline-none focus:border-brand-purple-400 focus:ring-2 focus:ring-brand-purple-100 dark:focus:ring-brand-purple-900",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-[invalid=true]:border-rose-500",
);

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        // A altura vem do padding (py-2 + text-sm ≈ 38px), como no catálogo;
        // em toque o alvo real cresce pelo espaçamento do Field.
        className={cn(controlClass, className)}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
