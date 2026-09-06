/**
 * PESO MORTO NA AMOSTRA QUE VAI AO MODELO.
 *
 * Medido em 30 dias de `tool_result` (533 injeções, 12,58 MB ≈ 3,14 milhões de
 * tokens): **56,9% dos bytes não carregam informação nenhuma.**
 *
 *   34,4%  CONSTANTE — o campo tem o mesmo valor em TODAS as linhas. Numa
 *          resposta de 96 colaboradores, `nome_empresa: "NATCORP DO BRASIL"` é
 *          cobrado 96 vezes para dizer uma coisa só.
 *   22,5%  VAZIO     — o campo é null/"" em todas as linhas.
 *
 * A concentração é brutal: `informacoes_pessoais_funcionais_resumido` (52 campos
 * por linha) e sua irmã `informacoes_pessoais_funcionais` somam 8,09 MB dos
 * 12,58 MB — 64% de todo o consumo, em duas ferramentas.
 *
 * ── O QUE ISTO NÃO CONSERTA (medido, para a hipótese não voltar) ────────────
 * Eu previ que linha estreita reduziria o truncamento: o corte da amostra é por
 * LINHAS *e* por CARACTERES (50 / 60 mil, ver `linhasQueCabem`), e **48,4% das
 * injeções saem com `completo: false`**. Errado. Medido nas 132 injeções
 * truncadas com amostra mensurável: a média sai de 46,2 para 47,9 linhas e
 * **NENHUMA deixa de truncar**, porque quem corta é o teto de 50 linhas, não o
 * de caracteres — a linha média truncada tem 1.244 bytes, e 50 delas cabem
 * folgadas em 60 mil.
 *
 * Ou seja: isto é economia de token, não correção de assertividade. Quem
 * responde pelo truncamento é `MAX_ITENS_MODELO`, e mexer nele é outra decisão
 * — agora com folga real, já que a linha encolheu ~48%, mas com risco próprio
 * de contexto e com efeito visível para quem usa. Não é minha para tomar.
 *
 * ── POR QUE NÃO É `allowed_output_fields` ───────────────────────────────────
 * O plano externo pede uma allowlist por ferramenta, cadastrada à mão. Duas
 * objeções, e a segunda é a que decide: (a) são ~88 ferramentas, e a qualidade
 * do cadastro já é o defeito conhecido — descrição escrita antes de ver o
 * retorno da API; (b) escolher QUAIS campos importam é decisão de domínio, do
 * dono. O que está aqui não escolhe nada: remove o que é demonstravelmente
 * redundante NAQUELA resposta, calculado sobre as linhas que chegaram. Vale para
 * ferramenta nova sem cadastrar coisa alguma, e não tem opinião sobre o negócio.
 *
 * ── O QUE SAI TEM DE SER DITO ───────────────────────────────────────────────
 * Campo vazio removido em silêncio vira "esse dado não existe" na boca do
 * modelo. É o mesmo erro que a rodada de 28/08 corrigiu em `resultado-vazio.ts`:
 * fonte vazia é LACUNA A DECLARAR, nunca licença para trocar de fonte. Por isso
 * o compactado devolve `_comum` (com os valores, legíveis) e `_vazios` (com os
 * NOMES dos campos que vieram vazios) — nada some, só para de ser repetido.
 */

/** Uma linha de resultado. */
export type Linha = Record<string, unknown>;

export type Compactacao = {
  /** As linhas sem os campos constantes e sem os campos vazios. */
  linhas: Linha[];
  /** Campo → valor único que valia para todas as linhas. */
  comum: Linha;
  /** Nomes dos campos que vieram vazios em TODAS as linhas. */
  vazios: string[];
  /** Bytes antes e depois, para o trace não ter de recalcular. */
  bytesAntes: number;
  bytesDepois: number;
};

/**
 * Piso de linhas.
 *
 * Com 1 linha, "constante em todas" é vacuidade — todo campo é constante, e
 * fatorar só moveria os bytes de lugar (com um cabeçalho a mais de brinde).
 * Com 2, a economia de um campo constante é ~1× o seu tamanho, menos o
 * cabeçalho: empata. A partir de 3 o ganho é real e cresce linear.
 */
const MIN_LINHAS = 3;

/**
 * Piso de campos que sobram.
 *
 * Se a compactação esvaziaria as linhas (todo campo constante ou vazio), o
 * resultado é uma lista de objetos `{}` — o modelo perde a noção de que há N
 * registros distintos. Nesse caso não compacta: devolve `null` e o chamador
 * segue pelo caminho de sempre.
 */
const MIN_CAMPOS_RESTANTES = 1;

const ehVazio = (v: unknown): boolean => v === null || v === undefined || v === "";

/** Chave de comparação estável. `JSON.stringify` basta: os valores vêm de JSON. */
function chaveDe(v: unknown): string {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    // Ciclo ou BigInt: trata como único (nunca constante), que é o lado seguro —
    // no máximo deixa de economizar, nunca remove algo que variava.
    return `__incomparavel_${Math.random()}`;
  }
}

const bytesDe = (x: unknown): number => {
  try {
    return JSON.stringify(x).length;
  } catch {
    return 0;
  }
};

/**
 * Separa, das linhas, o que é constante e o que é vazio.
 *
 * Devolve `null` quando não há nada a ganhar — e aí o chamador não deve mudar
 * nada do que já fazia.
 */
export function compactarLinhas(entrada: unknown[]): Compactacao | null {
  const linhas = entrada.filter((x): x is Linha => !!x && typeof x === "object" && !Array.isArray(x));
  if (linhas.length < MIN_LINHAS || linhas.length !== entrada.length) return null;

  const chaves = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  if (!chaves.length) return null;

  const comum: Linha = {};
  const vazios: string[] = [];
  const remover = new Set<string>();

  for (const k of chaves) {
    // Campo AUSENTE em alguma linha não é constante nem vazio: a ausência é
    // informação (o registro não tem aquele atributo). Deixa passar.
    if (!linhas.every((l) => k in l)) continue;
    const vals = linhas.map((l) => l[k]);
    if (vals.every(ehVazio)) {
      vazios.push(k);
      remover.add(k);
      continue;
    }
    const primeira = chaveDe(vals[0]);
    if (vals.every((v) => chaveDe(v) === primeira)) {
      comum[k] = vals[0];
      remover.add(k);
    }
  }

  if (!remover.size) return null;
  if (chaves.length - remover.size < MIN_CAMPOS_RESTANTES) return null;

  const enxutas = linhas.map((l) => {
    const o: Linha = {};
    for (const [k, v] of Object.entries(l)) if (!remover.has(k)) o[k] = v;
    return o;
  });

  const bytesAntes = bytesDe(linhas);
  const bytesDepois = bytesDe(enxutas) + bytesDe(comum) + bytesDe(vazios);
  // Não piorar: com poucas linhas e muitos campos distintos o cabeçalho pode
  // custar mais do que economiza. Só compacta quando de fato encolhe.
  if (bytesDepois >= bytesAntes) return null;

  return { linhas: enxutas, comum, vazios, bytesAntes, bytesDepois };
}

/**
 * O aviso que acompanha a amostra compactada.
 *
 * Escrito para ser lido pelo modelo como FATO da resposta, não como instrução
 * de formatação: o que está em `_comum` vale para cada linha, e o que está em
 * `_vazios` veio vazio da fonte — que é diferente de não existir.
 */
export function notaCompactacao(c: Compactacao): string {
  const partes: string[] = [];
  if (Object.keys(c.comum).length) {
    partes.push(
      `Os campos em "_comum" têm o MESMO valor em todas as ${c.linhas.length} linhas e por isso foram escritos uma vez só — valem para cada linha.`,
    );
  }
  if (c.vazios.length) {
    partes.push(
      `Os campos em "_vazios" vieram VAZIOS da fonte em todas as linhas. Se o usuário perguntar por um deles, diga que a fonte não preencheu esse campo — NÃO diga que o campo não existe nem invente valor.`,
    );
  }
  return partes.join(" ");
}
