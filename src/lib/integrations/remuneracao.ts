/**
 * Remove campos de REMUNERAÇÃO de um resultado de ferramenta.
 *
 * Existe por uma regra do produto (Igor, 12/08/2026): o candidato pode ver a
 * requisição do processo seletivo dele, mas não os valores — "não mostrar dados
 * de salários, remuneração e total de remuneração".
 *
 * ── Por que por PADRÃO de nome, e não por lista fechada ─────────────────────
 * A lista fechada envelhece do lado errado: o dia em que a ORDS acrescentar
 * `salario_proposto` a um endpoint, o campo passa direto e ninguém percebe —
 * porque nada falha, só vaza. O padrão erra para o lado de esconder demais, que
 * é recuperável (alguém reclama que falta um campo) contra irrecuperável
 * (alguém viu o salário de outra pessoa).
 *
 * Os nomes vêm do retorno real de `candidatos_selecionados`: total_remuneracao,
 * salario, remuneracao_variavel, perc_beneficio_variavel, salario_pretendido,
 * salario_ultima/penultima/antepen, tipo_salario.
 */

const PROIBIDO = /salari|remunera|vencimento|provento|beneficio_variavel/i;

/** O nome do campo é de remuneração? */
export function campoDeRemuneracao(nome: string): boolean {
  return PROIBIDO.test(String(nome ?? ""));
}

/**
 * Devolve a MESMA estrutura sem os campos de remuneração, em qualquer
 * profundidade — o payload da ORDS varia entre `{items:[…]}`, lista crua e
 * objeto único, e esconder só no formato de hoje seria esconder por sorte.
 */
export function semRemuneracao<T>(data: T): T {
  if (Array.isArray(data)) return data.map((d) => semRemuneracao(d)) as unknown as T;
  if (!data || typeof data !== "object") return data;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (campoDeRemuneracao(k)) continue;
    out[k] = v && typeof v === "object" ? semRemuneracao(v) : v;
  }
  return out as unknown as T;
}
