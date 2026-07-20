import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tabela densa do admin (usuários, auditoria). As duas telas tinham a MESMA
 * string de classes copiada — aqui a convenção vive num lugar só.
 *
 * Densidade produtiva (SAP Fiori / Microsoft Learn): linhas justas, cabeçalho
 * discreto, separação horizontal apenas. Grade completa pesa e atrapalha a
 * varredura vertical, que é como se lê uma tabela.
 */
export function DataTable({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    // O scroll fica AQUI dentro: uma tabela larga nunca pode fazer a página
    // rolar na horizontal.
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className={cn("w-full text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function DataHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-border bg-surface-2">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 align-top", className)} {...props}>
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-border transition-colors last:border-0 hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

/** Linha de "nada aqui" ocupando a tabela inteira. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-text-muted">
        {children}
      </td>
    </tr>
  );
}
