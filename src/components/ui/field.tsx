import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Campo de formulário canônico: rótulo VISÍVEL, texto de ajuda persistente e
 * erro logo abaixo do campo (não em um resumo no topo).
 *
 * Placeholder não é rótulo: some quando o usuário digita e é o erro de forma
 * mais comum em formulários. Aqui o rótulo é obrigatório por tipagem.
 *
 * Duas formas de associar rótulo e controle, ambas válidas:
 *  - com `htmlFor` → associação explícita (permite `aria-describedby` ligando
 *    hint e erro ao controle, então prefira esta);
 *  - sem `htmlFor` → o próprio `<label>` envolve o controle. Útil quando o
 *    conteúdo é gerado e não há id estável para distribuir.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const Rotulo = (
    <>
      {label}
      {required && (
        <span className="ml-0.5 text-accent" aria-hidden="true">
          *
        </span>
      )}
    </>
  );

  const auxiliar = (
    <>
      {hint && !error && (
        <p
          id={htmlFor ? `${htmlFor}-hint` : undefined}
          className="mt-1.5 text-xs leading-relaxed text-text-muted"
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          id={htmlFor ? `${htmlFor}-erro` : undefined}
          role="alert"
          className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400"
        >
          {error}
        </p>
      )}
    </>
  );

  // Sem htmlFor: o label envolve o controle (associação implícita).
  // O espaçamento rótulo→controle vem do mb-1 do próprio eyebrowLabel.
  if (!htmlFor) {
    return (
      <label className={cn("block", className)}>
        <span className={eyebrowLabel}>{Rotulo}</span>
        {children}
        {auxiliar}
      </label>
    );
  }

  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={eyebrowLabel}>
        {Rotulo}
      </label>
      {children}
      {auxiliar}
    </div>
  );
}

/** Label de formulário no padrão da referência: eyebrow em caps discreto. */
export const eyebrowLabel =
  "mb-1 block text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted";

/** Eyebrow de seção: menor, mais pesado e mais espaçado que o rótulo. */
export const eyebrow =
  "text-2xs font-bold uppercase tracking-[0.1em] text-brand-gray-400";

/** Ids de `aria-describedby` para ligar o input ao hint/erro do `Field`. */
export function fieldAria(id: string, opts: { hint?: boolean; error?: boolean }) {
  const ids = [opts.error ? `${id}-erro` : null, opts.hint && !opts.error ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    "aria-invalid": opts.error ? true : undefined,
    "aria-describedby": ids || undefined,
  } as const;
}
