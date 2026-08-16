/**
 * O RÓTULO QUE ESTÁ ESCONDIDO DENTRO DO COMENTÁRIO.
 *
 * O dicionário importado por CSV tinha 4.809 comentários e ZERO rótulos — e por
 * isso o assistente não conseguia dizer "Filial" no lugar de `COD_FILIAL`. Mas
 * olhando os comentários reais, o rótulo estava lá o tempo todo:
 *
 *   ALCADAS.COD_ALCADA       "Codigo - Código, que deseja incluir no cadastro…"
 *   ALCADAS_APROV.MATRICULA  "Matricula - Matricula que deseja incluir como…"
 *   AMORTIZACAO.COD_PRAZO    "Prazo - Código para o prazo de validade desta…"
 *
 * O ERP grava `Rótulo - explicação` no comentário da coluna. Medido nos 4.809:
 * 1.865 seguem esse padrão e outros 1.733 são curtos o bastante para serem o
 * próprio rótulo. São 3.598 rótulos recuperáveis sem IA nenhuma.
 *
 * Isso importa para a ORDEM do trabalho: rodar IA sobre `COD_ALCADA` sem rótulo
 * é caro e chuta; rodar sobre "Codigo", extraído do próprio comentário, é
 * barato e parte da verdade. O determinístico vem primeiro e melhora o insumo.
 *
 * Puro e testável.
 */

/** Acima disto o texto é explicação, não nome de campo. */
const MAX_ROTULO = 40;

/**
 * Separadores que o ERP usa entre rótulo e explicação. O hífen simples é o
 * comum; travessão e dois-pontos aparecem menos.
 */
const SEPARADOR = /\s+[-–—:]\s+/;

/**
 * Um rótulo serve? "-", "&nbsp;", "..." não servem.
 *
 * Nos 2.221 rótulos vindos do APEX, 15 são assim — pouco, mas cada um vira um
 * termo de ontologia inútil que depois aparece na busca e no glossário do
 * prompt. Lixo em vocabulário é pior que ausência: ausência não confunde.
 */
export function ehRotuloUtil(v: string | null | undefined): boolean {
  const s = String(v ?? "").trim();
  if (s.length < 2 || s.length > MAX_ROTULO) return false;
  if (/&[a-z]+;|&#\d+;/i.test(s)) return false; // &nbsp; e afins
  // Precisa ter ao menos uma letra: "---", "1.2", "()" não são nome de campo.
  return /\p{L}/u.test(s);
}

export type RotuloExtraido = { label: string | null; descricao: string | null };

/**
 * Separa `"Rótulo - explicação"` em rótulo e explicação.
 *
 * Três casos, nesta ordem:
 *  1. tem separador e a parte da frente parece rótulo → separa;
 *  2. não tem separador mas o texto inteiro é curto → o texto É o rótulo (um
 *     comentário "Data de envio do arquivo" nomeia o campo tão bem quanto um
 *     rótulo formal);
 *  3. frase longa sem separador → só explicação, sem rótulo. Inventar um a
 *     partir dela produziria termo de ontologia que ninguém reconhece.
 */
export function rotuloDoComentario(comentario: string | null | undefined): RotuloExtraido {
  const c = String(comentario ?? "").trim();
  if (!c) return { label: null, descricao: null };

  const m = c.split(SEPARADOR);
  const frente = (m[0] ?? "").trim();
  if (m.length > 1 && frente && ehRotuloUtil(frente)) {
    const resto = c.slice(frente.length).replace(SEPARADOR, "").trim();
    return { label: frente, descricao: resto || null };
  }

  if (ehRotuloUtil(c)) return { label: c, descricao: null };
  return { label: null, descricao: c };
}
