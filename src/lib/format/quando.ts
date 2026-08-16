/**
 * QUANDO ISSO ACONTECEU — absoluto e relativo, porque respondem coisas
 * diferentes.
 *
 * O absoluto ("16/08 13:10") resolve a confusão que motivou isto: um erro das
 * 13:10 continuava visível às 18:13 (a janela de erro é de 24h) e foi lido como
 * falha do arquivo que acabara de ser enviado. Sem hora, não havia como
 * desconfiar.
 *
 * O relativo ("há 6h") é o que se lê sem pensar — comparar "13:10" com a hora
 * atual exige saber que horas são, e ninguém deveria precisar.
 *
 * Num módulo só porque já havia duas listas de job e um resumo de dicionário
 * precisando disso. Três cópias de formatação de data divergem: uma ganha
 * segundos, outra passa a dizer "ontem", e a mesma informação aparece diferente
 * em telas vizinhas.
 *
 * Puro e testável. `agora` é injetável para o teste não depender do relógio.
 */

export type Carimbo = { absoluto: string; relativo: string };

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

/** "há 3 min", "há 6h", "ontem", "há 4 dias". Sem segundos: ninguém age neles. */
export function relativo(iso: string | null | undefined, agora: number = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const d = agora - t;
  // Data no futuro (relógio do servidor adiantado) não vira "há -3 min".
  if (d < MIN) return "agora";
  if (d < HORA) return `há ${Math.round(d / MIN)} min`;
  if (d < DIA) return `há ${Math.round(d / HORA)}h`;
  const dias = Math.round(d / DIA);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}

/** "16/08 13:10" — dia e mês sempre, porque "13:10" sozinho não diz qual dia. */
export function absoluto(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function carimbo(iso: string | null | undefined, agora: number = Date.now()): Carimbo {
  return { absoluto: absoluto(iso), relativo: relativo(iso, agora) };
}
