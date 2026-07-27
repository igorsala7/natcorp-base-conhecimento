/**
 * Sanitização da saída da REESCRITA de consulta — PURA (sem `server-only`),
 * para ser testável. Devolve a consulta original se o modelo vier com algo
 * vazio/gigante/estranho.
 */
export function limparConsulta(bruto: string, original: string): string {
  let s = (bruto ?? "").trim();
  // Remove cercas de código, rótulos ("Consulta:", "Busca:") e aspas.
  s = s.replace(/^```[a-z]*\s*|\s*```$/gi, "").trim();
  s = s.replace(/^(consulta|busca|query|pergunta)\s*:\s*/i, "").trim();
  s = s.replace(/^["'“”']+|["'“”']+$/g, "").trim();
  // Uma linha só (o modelo pode devolver explicação nas linhas seguintes).
  s = s.split("\n")[0]!.trim();
  if (s.length < 2 || s.length > 300) return original;
  return s;
}
