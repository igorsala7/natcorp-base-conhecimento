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
  rotulo = "Tabela",
  ...props
}: React.HTMLAttributes<HTMLTableElement> & {
  /** Nome da região rolável, anunciado ao chegar nela pelo teclado. */
  rotulo?: string;
}) {
  return (
    /**
     * O scroll fica AQUI dentro: uma tabela larga nunca pode fazer a página
     * rolar na horizontal.
     *
     * ── E quem rola precisa ALCANÇAR ────────────────────────────────────────
     * Um contêiner com `overflow-x-auto` rola com a roda do mouse e com o
     * gesto de arrastar, e não rola com o teclado: sem `tabIndex`, ele nunca
     * recebe foco, e as setas continuam rolando a PÁGINA. Numa tabela de nove
     * colunas a 1024px, as últimas colunas ficam inalcançáveis para quem não
     * usa mouse — o dado existe e não há como chegar nele.
     *
     * `role="region"` + nome: a parada de tabulação a mais só se justifica se,
     * ao chegar nela, o leitor de tela disser o que é.
     */
    <div
      tabIndex={0}
      role="region"
      aria-label={rotulo}
      className="overflow-x-auto rounded-lg border border-border"
    >
      <table className={cn("w-full text-sm", className)} {...props}>
        {/**
         * A REGIÃO tem nome; a TABELA também precisa do dela.
         *
         * A árvore de acessibilidade mostrava quatro nós `table` sem nome
         * nenhum na tela Sistema. O `aria-label` da região só é anunciado ao
         * ENTRAR nela — quem usa o modo de navegação por tabelas (o jeito
         * normal de ler dado tabular com leitor de tela) pula direto de tabela
         * em tabela e ouvia só "tabela, 4 colunas". Nenhuma ferramenta
         * automática reclama disso: `axe` não exige nome em tabela.
         *
         * `<caption>` e não outro `aria-label`: é o mecanismo que o HTML já tem
         * para isso, e o `sr-only` o mantém fora da tela — o título visível da
         * seção já está logo acima.
         */}
        <caption className="sr-only">{rotulo}</caption>
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
