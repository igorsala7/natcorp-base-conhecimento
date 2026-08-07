/**
 * Consolidação das requisições HTTP de UMA chamada de ferramenta.
 *
 * Uma tool com `loop` (mês a mês, lista de valores, lotes) faz até 24 requisições
 * para uma única chamada do modelo. Emitir um passo por requisição enchia o trace
 * — 4 tools × 12 meses estouravam sozinhas o teto de 200 passos, e o fim do turno
 * (que é o que explica o resto) era o primeiro a sumir.
 *
 * Aqui as requisições viram UM passo, que mostra quantas foram, quais valores
 * variaram e os status distintos. O cURL é o da PRIMEIRA — as demais só trocam o
 * valor do parâmetro do loop, então reproduzir uma reproduz o padrão.
 *
 * Puro (sem IO): testável isolado.
 */

export type ChamadaHttp = {
  /** Args do modelo desta requisição, já redigidos. */
  params: unknown;
  status: number | null;
  ms: number;
  cache: boolean;
  curl?: string;
};

/** Máximo de valores do loop listados no passo (o resto vira contagem). */
const MAX_VALORES = 10;

/** Chaves cujo valor MUDOU entre as requisições — é o parâmetro do loop. */
function chavesQueVariam(chamadas: ChamadaHttp[]): string[] {
  const objs = chamadas
    .map((c) => (c.params && typeof c.params === "object" && !Array.isArray(c.params) ? (c.params as Record<string, unknown>) : null))
    .filter((o): o is Record<string, unknown> => o !== null);
  if (objs.length < 2) return [];
  const chaves = new Set(objs.flatMap((o) => Object.keys(o)));
  return [...chaves].filter((k) => new Set(objs.map((o) => JSON.stringify(o[k]))).size > 1);
}

/**
 * Monta o `info` do passo `integracoes:curl` a partir das requisições feitas.
 * Devolve `null` quando não houve nenhuma requisição com cURL (ex.: a chamada
 * morreu num guard antes de chegar à rede) — nesse caso o rastro fica por conta
 * do `tool_call`/`tool_fim`, que registram a tentativa e o motivo.
 */
export function consolidarChamadas(tool: string, chamadas: ChamadaHttp[]): Record<string, unknown> | null {
  if (chamadas.length === 0) return null;
  // Sem cURL o passo ainda vale: é o acerto de cache (a requisição não aconteceu
  // neste turno) e a exceção de rede (tentou e não voltou). Os dois precisam
  // aparecer no log — a ausência do comando é a informação, não a falta dela.
  const comCurl = chamadas.filter((c) => c.curl).length > 0 ? chamadas.filter((c) => c.curl) : chamadas;

  const primeira = comCurl[0]!;
  if (comCurl.length === 1) {
    return {
      tool,
      params: primeira.params,
      status: primeira.status,
      ms: primeira.ms,
      ...(primeira.cache ? { cache: true } : {}),
      ...(primeira.curl ? { curl: primeira.curl } : {}),
    };
  }

  const variam = chavesQueVariam(comCurl);
  const valores = variam.length
    ? comCurl
        .map((c) => {
          const o = c.params as Record<string, unknown> | null;
          if (!o || typeof o !== "object") return null;
          return variam.map((k) => String(o[k] ?? "")).join("/");
        })
        .filter((v): v is string => !!v)
    : [];
  const statusDistintos = [...new Set(comCurl.map((c) => c.status).filter((s) => s != null))];

  return {
    tool,
    requisicoes: comCurl.length,
    ...(variam.length ? { variou: variam } : {}),
    ...(valores.length
      ? {
          valores: valores.slice(0, MAX_VALORES),
          ...(valores.length > MAX_VALORES ? { valores_omitidos: valores.length - MAX_VALORES } : {}),
        }
      : {}),
    params: primeira.params,
    status: statusDistintos.length === 1 ? statusDistintos[0] : statusDistintos,
    ms: comCurl.reduce((a, c) => a + c.ms, 0),
    ...(comCurl.some((c) => c.cache) ? { cache: comCurl.filter((c) => c.cache).length } : {}),
    // cURL da 1ª requisição: as outras só trocam o valor do parâmetro do loop.
    ...(primeira.curl ? { curl: primeira.curl } : {}),
  };
}
