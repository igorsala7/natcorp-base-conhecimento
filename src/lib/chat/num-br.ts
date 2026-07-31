/**
 * Parser numérico pt-BR (R$, milhar com ponto, decimal com vírgula, %) → number.
 * Compartilhado pelo resumo estatístico (`statsBlock`) e pelo motor de consulta
 * (`consultarDataset`) — uma fonte só, para os dois lados tratarem número igual.
 * Puro (client-safe).
 */
export function parseNumBR(v: string): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const limpo = s.replace(/R\$|\s|%/g, "");
  if (/^-?0\d/.test(limpo)) return null; // código com zero à esquerda: não é número
  let n: number;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(limpo)) n = Number(limpo.replace(/\./g, "").replace(",", "."));
  else if (/^-?\d+(,\d+)?$/.test(limpo)) n = Number(limpo.replace(",", "."));
  else if (/^-?\d+(\.\d+)?$/.test(limpo)) n = Number(limpo);
  else return null;
  return Number.isFinite(n) ? n : null;
}
