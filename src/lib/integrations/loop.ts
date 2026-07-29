/**
 * Expansão de período MÊS A MÊS para as ferramentas mensais (ver `LoopConfig`).
 * Função pura e testável: recebe início/fim em ISO (AAAA-MM ou AAAA-MM-DD) e
 * devolve a lista de meses do intervalo, com um teto (`max`) para não estourar.
 *
 * Cada mês sai em dois formatos: `iso` ("AAAA-MM", passado à API pela máscara da
 * ferramenta) e `br` ("MM/AAAA", rótulo humano no resultado agregado).
 */

export type MesRef = { iso: string; br: string };

function parseYM(v: string): [number, number] | null {
  const m = /^(\d{4})-(\d{1,2})/.exec((v || "").trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return [ano, mes];
}

/**
 * Lista os meses de `fromRaw` até `toRaw` (inclusive). `toRaw` ausente = 1 mês.
 * Ordena se vierem invertidos. Trunca em `max` meses (padrão 24) e sinaliza
 * `excedeu` — o chamador avisa que o período foi limitado.
 */
export function expandirMeses(
  fromRaw: string,
  toRaw: string | null | undefined,
  max = 24,
): { lista: MesRef[]; excedeu: boolean } {
  const a = parseYM(fromRaw);
  if (!a) return { lista: [], excedeu: false };
  const b = toRaw ? parseYM(toRaw) : a;
  const end = b ?? a;

  let [ay, am] = a;
  let [by, bm] = end;
  // Intervalo invertido (fim antes do início): troca.
  if (ay * 12 + am > by * 12 + bm) {
    [ay, am, by, bm] = [by, bm, ay, am];
  }

  const teto = Math.max(1, max);
  const lista: MesRef[] = [];
  let y = ay;
  let m = am;
  while (y * 12 + m <= by * 12 + bm) {
    if (lista.length >= teto) return { lista, excedeu: true };
    const mm = String(m).padStart(2, "0");
    lista.push({ iso: `${y}-${mm}`, br: `${mm}/${y}` });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return { lista, excedeu: false };
}
