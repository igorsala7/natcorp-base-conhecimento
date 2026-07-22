import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-fg shadow-1 hover:bg-primary-hover hover:shadow-2",
        // Outline do catálogo: superfície branca, texto discreto, e o hover
        // "acende" a marca (borda + texto roxos) em vez de escurecer o fundo.
        secondary:
          "gap-1.5 border border-border bg-surface text-xs text-text-muted hover:border-brand-purple-300 hover:text-brand-purple-700 dark:hover:border-brand-purple-700 dark:hover:text-brand-purple-300",
        // Outline de alerta (ex.: Despublicar).
        warning:
          "gap-1.5 border border-amber-300 bg-amber-50 text-xs text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50",
        ghost: "text-text-muted hover:bg-surface-2 hover:text-text",
        accent: "bg-accent text-accent-fg shadow-1 hover:opacity-90 hover:shadow-2",
        danger: "bg-rose-600 text-white shadow-1 hover:bg-rose-700 hover:shadow-2",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2",
        lg: "px-6 py-2.5",
        // Botão de ícone do catálogo: 32×32, svg 16px (herdado da base).
        icon: "size-8",
      },
    },
    compoundVariants: [
      // Outline no tamanho padrão segue o catálogo à risca: px-3 py-2 text-xs.
      { variant: "secondary", size: "md", class: "px-3" },
      { variant: "warning", size: "md", class: "px-3" },
      // Botão de ícone destrutivo é sutil: cor só aparece no hover.
      {
        variant: "danger",
        size: "icon",
        class:
          "bg-transparent text-text-muted shadow-none hover:bg-rose-50 hover:text-rose-600 hover:shadow-none dark:hover:bg-rose-950/30 dark:hover:text-rose-400",
      },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
