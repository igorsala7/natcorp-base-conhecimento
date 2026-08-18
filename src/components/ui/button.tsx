import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
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
        // O `text-xs` saiu daqui: fixo na variante, ele vencia o `size` e um
        // `size="lg"` secundário vinha com letra de 12px. Agora o tamanho manda,
        // e `sm` continua entregando o 12px do catálogo.
        secondary:
          "gap-1.5 border border-border bg-surface text-text-muted hover:border-brand-purple-300 hover:text-brand-purple-700 dark:hover:border-brand-purple-700 dark:hover:text-brand-purple-300",
        /* Outline de alerta (ex.: Despublicar). Em token: eram nove classes
           cruas com `dark:` à mão, e o `hover` escurecia trocando de degrau da
           escala — o que não existe num token. `brightness-95` faz o mesmo em
           qualquer tema, sem uma segunda cor para manter em sincronia. */
        warning:
          "gap-1.5 border border-warning-line bg-warning-soft text-warning hover:brightness-95",
        ghost: "text-text-muted hover:bg-surface-2 hover:text-text",
        accent: "bg-accent text-accent-fg shadow-1 hover:opacity-90 hover:shadow-2",
        danger: "bg-danger text-danger-on shadow-1 hover:opacity-90 hover:shadow-2",
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
      { variant: "secondary", size: "md", class: "px-3 text-xs" },
      { variant: "warning", size: "md", class: "px-3 text-xs" },
      // Botão de ícone destrutivo é sutil: cor só aparece no hover.
      {
        variant: "danger",
        size: "icon",
        class:
          "bg-transparent text-text-muted shadow-none hover:bg-danger-soft hover:text-danger hover:shadow-none",
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
  /**
   * Ação em curso. Desabilita, anuncia `aria-busy` e troca o ícone-líder pelo
   * giro — sem ADICIONAR um segundo ícone, que faria o botão crescer.
   *
   * Existe porque a alternativa era o que o produto tinha: 33 `animate-spin`
   * montados à mão, cada um com seu tamanho e sua posição, e o overlay
   * bloqueante de tela cheia usado para coisas que cabiam num botão. Feedback
   * de ação pertence ao controle que a disparou.
   */
  loading?: boolean;
  /** Texto durante a espera. Sem isto, o rótulo permanece — que é o certo para
   *  botão curto ("Salvar"), mas mente em ação longa ("Publicar" → "Publicando…"). */
  loadingLabel?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingLabel, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // `asChild` delega a marcação ao filho — injetar o spinner ali quebraria o
    // Slot (que exige um único filho). Nesse modo o loading só desabilita.
    const conteudo =
      loading && !asChild ? (
        <>
          {/* aria-hidden: quem anuncia a espera é o aria-busy do botão, não o ícone. */}
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      );
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-carregando={loading || undefined}
        {...props}
      >
        {conteudo}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
