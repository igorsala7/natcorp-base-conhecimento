/**
 * Data que só pode estar no FUTURO — corrige o ano que o modelo errou.
 *
 * A pessoa diz "quero sair dia 01/10". O ano ela não diz, porque para ela é
 * óbvio: o próximo 01/10. O modelo precisa deduzir, e erra — numa conversa real
 * (13/08/2026) ele mandou `2025-11-01` para um "01/11", e o ERP respondeu com a
 * data mínima de 2025, o que confundiu a conversa inteira. Depois ainda ofereceu
 * datas de setembro para quem tinha pedido novembro.
 *
 * Ninguém agenda férias para trás. Então isto não é palpite: é a única leitura
 * possível de uma data que caiu no passado, e é CONTA — não deveria depender de
 * o modelo lembrar da regra a cada turno.
 *
 * ── Por que corrigir em vez de recusar ───────────────────────────────────────
 * O ERP recusaria de qualquer jeito. A escolha real é entre uma recusa com
 * mensagem confusa ("a data mínima é após 30/11/2025") e a única interpretação
 * sensata, mostrada de volta. A segunda só é honesta porque a data corrigida
 * VOLTA na resposta da validação e o agente é obrigado a apresentá-la — a pessoa
 * confirma sobre o que o sistema entendeu, não sobre o que ela digitou.
 *
 * ── O que isto NÃO faz ───────────────────────────────────────────────────────
 * Não mexe em data de período aquisitivo, que é legitimamente passada
 * (09/11/2024 a 08/11/2025). Só se aplica onde o parâmetro declara `futuro`.
 */

/** Quebra ISO (2026-10-01) ou pt-BR (01/10/2026) preservando o formato de origem. */
function partes(v: string): { y: number; m: number; d: number; iso: boolean } | null {
  const t = v.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return { y: +m[1]!, m: +m[2]!, d: +m[3]!, iso: true };
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (m) return { y: +m[3]!, m: +m[2]!, d: +m[1]!, iso: false };
  return null;
}

function formatar(y: number, mes: number, d: number, iso: boolean): string {
  const p2 = (n: number) => String(n).padStart(2, "0");
  return iso ? `${y}-${p2(mes)}-${p2(d)}` : `${p2(d)}/${p2(mes)}/${y}`;
}

/** Meia-noite local — comparar data com data, sem hora atravessada. */
function soData(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Devolve a mesma data se ela já é de hoje em diante; senão, a próxima
 * ocorrência do mesmo dia e mês. Formato de saída = formato de entrada.
 *
 * O que não parseia volta intocado: melhor a API recusar um valor estranho do
 * que este módulo inventar uma data.
 */
export function ajustarParaFuturo(valor: string, hoje: Date = new Date()): string {
  const p = partes(valor);
  if (!p) return valor;

  const hojeMs = soData(hoje);
  const alvo = (ano: number): Date | null => {
    const d = new Date(ano, p.m - 1, p.d);
    // 29/02 em ano comum vira 01/03 — descarta em vez de deslocar o dia.
    return d.getMonth() === p.m - 1 && d.getDate() === p.d ? d : null;
  };

  const original = alvo(p.y);
  if (original && soData(original) >= hojeMs) return valor;

  // Avança ano a ano a partir do ano corrente. O teto de 8 cobre 29/02 (que só
  // existe de 4 em 4) sem virar laço aberto se algo vier torto.
  for (let ano = hoje.getFullYear(); ano <= hoje.getFullYear() + 8; ano++) {
    const cand = alvo(ano);
    if (cand && soData(cand) >= hojeMs) return formatar(ano, p.m, p.d, p.iso);
  }
  return valor;
}
