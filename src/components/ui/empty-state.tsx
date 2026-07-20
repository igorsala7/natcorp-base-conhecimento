import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Estado vazio COM ação. Estado vazio sem saída é um beco sem saída: o usuário
 * chegou onde queria e a tela só diz que não há nada.
 *
 * A caixa tracejada era copiada em cinco telas com medidas diferentes.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && <Icon className="mb-3 size-6 text-text-muted" />}
      <p className="font-medium">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
