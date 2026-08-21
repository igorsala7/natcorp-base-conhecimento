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

/**
 * Normaliza o que o modelo mandou no parâmetro de um laço `values`/`batch`
 * numa lista de valores limpa.
 *
 * Três coisas, e cada uma corrige um defeito medido em 20/08/2026:
 *
 * 1. SEPARA POR VÍRGULA. O modelo escreve `"205818,477"` numa string só — é a
 *    forma natural dele, e é o que a descrição do parâmetro pede. Sem separar,
 *    a string inteira vira UM valor e a API recusa: `bi/v1/*` devolve
 *    ORA-01722 ("número inválido"). O ramo `batch` já separava; o `values`,
 *    que é o mais usado, não.
 * 2. DEDUPLICA, preservando a ordem de chegada. Medido: 12,7% das requisições
 *    de loop-values eram a MESMA URL, e 74 chamadas dispararam duas vezes.
 *    Requisição repetida é dinheiro e latência por um dado que já se tem.
 * 3. Descarta vazio, que vira requisição sem filtro — o erro silencioso caro:
 *    volta a base inteira com cara de resposta filtrada.
 *
 * A vírgula nunca é parte do valor aqui: os 23 laços cadastrados iteram em
 * `matricula` ou `cod_candidato`, códigos numéricos.
 */
export function expandirValores(raw: unknown): string[] {
  const bruto = Array.isArray(raw) ? raw : raw != null && raw !== "" ? [raw] : [];
  return [
    ...new Set(
      bruto
        .flatMap((v) => String(v).split(","))
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
}
