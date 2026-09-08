/**
 * Formatação da área de gestão. Puro, sem I/O.
 *
 * Números de fatura são lidos por gente que vai conferir na mão: crédito com 3
 * casas (a menor unidade que aparece — mil tokens), dinheiro com 2, e sempre
 * `pt-BR`, porque a tela é embutida num ERP em português e a mistura de
 * separadores é o tipo de detalhe que derruba a confiança no número.
 */

const CREDITOS = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const INTEIRO = new Intl.NumberFormat("pt-BR");

const USD = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export function fmtCreditos(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return CREDITOS.format(n);
}

export function fmtNumero(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return INTEIRO.format(n);
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return USD.format(n);
}

/** `null` vira travessão, nunca "R$ 0,00": sem cotação não há valor em real. */
export function fmtBrl(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return BRL.format(n);
}

export function fmtPercent(parte: number, total: number): string {
  if (!Number.isFinite(parte) || !Number.isFinite(total) || total <= 0) return "—";
  return `${INTEIRO.format(Math.round((parte / total) * 100))}%`;
}

export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export function fmtMes(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    month: "long",
    year: "numeric",
  }).format(d);
}

export const PAINEL_NOME: Record<string, string> = {
  PO: "Operador",
  PG: "Gestor",
  PC: "Colaborador",
};

export function nomeDoPainel(p: string | null | undefined): string {
  if (!p) return "Todos";
  return PAINEL_NOME[p] ?? p;
}
