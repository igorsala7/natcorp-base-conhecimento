/**
 * Limpeza do resumo que a IA gera para `ai_tools.descricao_usuario`.
 *
 * O modelo às vezes devolve aspas, um rótulo ("Descrição:"), marcador de lista ou
 * a resposta quebrada em várias linhas. O campo alimenta um BOTÃO, não um
 * parágrafo — então tudo isso vira 1-2 frases limpas antes de ir ao banco.
 *
 * Puro (sem IO): usado pelo script de geração em lote e testável isolado.
 */

/** Teto do campo — igual ao do formulário e ao do Zod de gravação. */
export const MAX_DESC_USUARIO = 220;

export function limparResumo(bruto: string, max = MAX_DESC_USUARIO): string {
  const s = String(bruto ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/^\s*(descri[çc][ãa]o|resumo|resposta)\s*:\s*/i, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length <= max) return s;

  // Corta na FRONTEIRA DE FRASE. Um resumo interrompido em "Mostra os períodos de
  // fé" é pior que um resumo mais curto — e é exatamente o defeito que este campo
  // existe para consertar (o rótulo antigo cortava a descrição técnica em 70 chars).
  // Piso baixo (35%) de propósito: numa etiqueta de botão, uma frase COMPLETA e
  // curta lê melhor que uma frase longa interrompida. O piso só existe para o caso
  // patológico — um ponto logo no começo, que deixaria o campo quase vazio.
  const corte = s.slice(0, max);
  const fim = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("! "), corte.lastIndexOf("? "));
  if (fim > max * 0.35) return corte.slice(0, fim + 1).trim();
  const esp = corte.lastIndexOf(" ");
  const base = (esp > max * 0.35 ? corte.slice(0, esp) : corte).trim();
  return base.replace(/[,;:]$/, "") + "…";
}
