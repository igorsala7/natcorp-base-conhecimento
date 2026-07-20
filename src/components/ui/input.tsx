import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Aparência única para TODO controle de formulário (input, select, textarea).
 * Sem isto, cada tela reinventa altura, raio e borda — é o que faz o
 * formulário parecer montado por pessoas diferentes.
 */
export const controlClass = cn(
  // border-strong, não border: o limite de um controle precisa de 3:1 (WCAG
  // 1.4.11). O hairline decorativo desaparece para quem enxerga pouco.
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text",
  "placeholder:text-text-muted",
  "transition-colors hover:border-text-muted",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-[invalid=true]:border-red-500",
);

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        // h-10 = 40px; em toque o alvo real cresce pelo espaçamento do Field.
        className={cn(controlClass, "h-10", className)}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
