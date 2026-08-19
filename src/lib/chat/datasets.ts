/**
 * REGISTRO DE DATASETS (correção do PDF incompleto).
 *
 * Problema: `gerar_relatorio` recebia as LINHAS redigitadas pelo modelo — com
 * "todos os dados" ele não reescreve centenas de linhas (limite de tokens), e o
 * PDF saía com ~1/10. Solução: quando uma ferramenta de dados retorna uma LISTA,
 * o servidor guarda as linhas COMPLETAS num registro e devolve ao modelo só um
 * id (`_dataset`) + total + colunas. No relatório, o modelo referencia o id e
 * escolhe as colunas — o servidor expande as linhas reais. Nada é redigitado.
 *
 * Puro (sem server-only/IO) para ser testável e reutilizável.
 */

import { parseNumBR } from "./num-br";

export type DatasetRow = Record<string, unknown>;
export type Dataset = { id: string; rows: DatasetRow[]; colunas: string[]; headers?: string[] };
export type DatasetRegistry = {
  list: Dataset[];
  /**
   * Próximo número de `dsN` — o que faz o id sobreviver à CONVERSA.
   *
   * Sem isto, todo turno recomeça em `ds1`. Numa conferência longa (o uso real:
   * 20 mensagens ainda citando o resultado da quinta), o turno 20 criaria um
   * `ds1` novo enquanto o agente ainda se refere ao `ds1` do turno 5 — ele
   * pediria uma tabela e receberia outra, em silêncio, com números errados.
   *
   * Ausente = começa em 1 (registro montado à mão, testes, portal).
   */
  proximoId?: number;
  /** Ids EFETIVAMENTE consultados pelas ferramentas de dados neste turno.
   *
   *  Existir na lista não é usar: o widget manda as tabelas da tela em todo
   *  turno, e o chat exibia "Resposta baseada no relatório visível nesta tela"
   *  sempre que houvesse UMA tabela na página — mesmo quando a resposta veio da
   *  documentação ou de uma ferramenta de API. O aviso passou a ser uma frase
   *  automática, e frase automática sobre procedência de dado é pior que
   *  nenhuma: ensina a desconfiar do que está certo. */
  usados: Set<string>;
};

export function newRegistry(proximoId = 1): DatasetRegistry {
  return { list: [], usados: new Set(), proximoId };
}

/**
 * O próximo número livre, avançando o contador.
 *
 * Usa `proximoId` quando existe e o tamanho da lista como piso — assim um
 * registro reidratado com `ds3` e `ds7` não devolve `ds3` de novo, e um registro
 * montado à mão (sem contador) continua se comportando como antes.
 */
function proximoNumero(reg: DatasetRegistry): number {
  const n = Math.max(reg.proximoId ?? 1, reg.list.length + 1);
  reg.proximoId = n + 1;
  return n;
}

/** Resolve o id E registra o uso — todo consumo de dataset passa por aqui. */
function acharDataset(reg: DatasetRegistry, id: string): Dataset | undefined {
  const ds = reg.list.find((d) => d.id === id);
  // `usados` pode faltar em registro montado à mão (testes antigos): o uso é
  // diagnóstico, nunca pode derrubar uma consulta de dados.
  if (ds) reg.usados?.add(ds.id);
  return ds;
}

/** Alguma tabela DA TELA foi de fato consultada neste turno? */
export function usouDadosDaTela(reg: DatasetRegistry): boolean {
  for (const id of reg.usados ?? []) if (id.startsWith("tela")) return true;
  return false;
}

/**
 * Registra uma TABELA DA TELA (colunas + linhas em texto) como dataset, para o
 * modelo referenciar por id (`dados_de`) sem redigitar as linhas — é o que evita
 * chamadas de tool gigantes (60×N células) que vazam como texto ou estouram.
 * As linhas são indexadas por `c0..cN` e os cabeçalhos de exibição ficam em
 * `headers` (usados por `expandirTabela` quando o modelo não passa `colunas`).
 */
export function registrarTabelaTela(
  reg: DatasetRegistry,
  colunas: string[],
  linhas: string[][],
  /** Id EXPLÍCITO — só na reidratação, para a tabela voltar com o nome que tinha.
   *  Sem ele o `ds3` de um turno anterior voltaria como `ds1` e o agente pediria
   *  uma tabela recebendo outra. */
  idExplicito?: string,
): { id: string; total: number } {
  const nomes = colunas.map((c) => String(c).trim());
  // Indexa cada célula por DUAS chaves — o índice `cN` E o NOME da coluna — para
  // funcionar independentemente de o modelo passar `campos` por índice ou por nome
  // (ou não passar nada). Sem isto, `campos` por nome não casava → células vazias.
  const rows: DatasetRow[] = linhas.map((row) => {
    const o: DatasetRow = {};
    nomes.forEach((nome, i) => {
      const v = row[i] ?? "";
      o["c" + i] = v;
      if (nome && o[nome] === undefined) o[nome] = v;
    });
    return o;
  });
  const id = idExplicito ?? "tela" + proximoNumero(reg);
  // colunas = NOMES (fallback quando o modelo não passa `campos`); headers = idem.
  reg.list.push({ id, rows, colunas: nomes, headers: nomes });
  return { id, total: rows.length };
}

const ehLinha = (x: unknown): x is DatasetRow => !!x && typeof x === "object" && !Array.isArray(x);

/** Encontra a lista de registros dentro do resultado da ferramenta. */
function extrairLista(data: unknown): DatasetRow[] | null {
  if (Array.isArray(data)) {
    const rows = data.filter(ehLinha);
    return rows.length ? rows : null;
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    // Mesma lista de `pareceVazio` — eram DUAS cópias, e elas já divergiam.
    for (const k of CHAVES_LISTA) {
      const v = o[k];
      if (Array.isArray(v)) {
        const rows = v.filter(ehLinha);
        if (rows.length) return rows;
      }
    }
  }
  return null;
}

/** Colunas candidatas = união das chaves das linhas (ignora metadados `_*`). */
function inferirColunas(rows: DatasetRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows.slice(0, 100)) for (const k of Object.keys(r)) if (!k.startsWith("_")) set.add(k);
  return [...set].slice(0, 150);
}

/** Coage uma célula a texto (números/booleanos/objetos tratados). */
function celula(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 200);
  return String(v).slice(0, 300);
}

/**
 * Registra a lista do resultado (se houver) e devolve o metadado para o modelo.
 * `null` quando o resultado não é uma lista de registros.
 */
export function registrarDataset(reg: DatasetRegistry, data: unknown): { id: string; total: number; colunas: string[] } | null {
  const rowsRaw = extrairLista(data);
  if (!rowsRaw || rowsRaw.length === 0) return null;
  const colunas = inferirColunas(rowsRaw);
  if (colunas.length === 0) return null;
  // Re-chaveia cada linha por `cN` (E mantém o nome real) — as query-tools leem a
  // célula por `r["c"+i]` (asRow/filtrarLinhas/agregações). Sem os `cN`, agregar/
  // filtrar/somar sobre um `ds*` (resultado de API via injetarDataset) lia célula
  // VAZIA → soma=0, filtro não casava — mesmo o modelo sendo instruído a usar
  // dados_de="dsN" p/ o total exato. Espelha registrarTabelaTela; celula() coage
  // número/booleano/objeto a texto (idêntico ao que asRow/expandirTabela aplicam).
  const rows: DatasetRow[] = rowsRaw.map((r) => {
    const o: DatasetRow = {};
    colunas.forEach((nome, i) => {
      const v = celula(r[nome]);
      o["c" + i] = v;
      if (nome && o[nome] === undefined) o[nome] = v;
    });
    return o;
  });
  const id = "ds" + proximoNumero(reg);
  reg.list.push({ id, rows, colunas, headers: colunas });
  return { id, total: rows.length, colunas };
}

/** Máx. de linhas que o MODELO vê de um resultado de tool. O dataset (id) guarda TUDO;
 *  passar centenas/milhares de linhas ao modelo por chamada estoura o contexto (bug real:
 *  vários tool-calls acumulados passavam de 1M tokens no Gemini). A análise sobre 100% das
 *  linhas é feita pelas ferramentas de dados (dados_de), não relendo tudo no prompt. */
const MAX_ITENS_MODELO = 50;
/**
 * Teto da amostra em CARACTERES — o que faltava.
 *
 * O teto de 50 linhas pressupõe linha estreita. Uma consulta de cadastro
 * funcional devolve ~200 campos por pessoa: 50 linhas viraram **293 mil bytes**
 * (~73 mil tokens) e o turno morreu com "prompt is too long: 207798 > 200000"
 * numa pergunta de listar colaboradores (13/08/2026).
 *
 * 60 mil caracteres ≈ 15 mil tokens: cabe com folga ao lado do prompt e ainda
 * mostra dezenas de linhas quando elas são estreitas. Quando são largas, o
 * modelo vê MENOS linhas — e é o certo, porque o total exato vem das
 * ferramentas de dados sobre o dataset, não da amostra.
 */
const MAX_CHARS_AMOSTRA = 60_000;

/**
 * Quantas linhas cabem no orçamento de caracteres.
 *
 * SOMA o tamanho real linha a linha, parando assim que estoura. A versão
 * anterior media só `linhas[0]` e dividia — e extrapolar a partir da primeira
 * linha não vale para dado de RH, onde o registro tem ~200 campos OPCIONAIS
 * preenchidos de forma esparsa: se a primeira pessoa da lista tem poucos campos
 * e as seguintes têm muitos, a conta erra por 5x. Foi assim que um resultado
 * saiu com **293.789 bytes** sob um teto de 60.000 (medido em 30 dias de trace,
 * 18/08/2026), e um de 25 linhas saiu com 148.841 bytes marcado `_completo` —
 * o modelo informado de que tinha a lista inteira, e ela ocupando 37 mil tokens.
 *
 * Somar não traz de volta o problema que a extrapolação evitava (serializar
 * tudo para depois cortar): o laço para no `maxLinhas`, então serializa no
 * máximo 50 linhas, aconteça o que acontecer com o tamanho da lista.
 *
 * Sempre devolve ao menos 1 quando há linha: uma linha gigante truncada ainda
 * diz ao modelo que formato ele tem em mãos; zero linha não diz nada.
 */
export function linhasQueCabem(linhas: unknown[], maxLinhas = MAX_ITENS_MODELO, maxChars = MAX_CHARS_AMOSTRA): number {
  const teto = Math.min(linhas.length, maxLinhas);
  let usados = 0;
  for (let i = 0; i < teto; i++) {
    let tam = 0;
    try {
      tam = JSON.stringify(linhas[i] ?? {}).length;
    } catch {
      tam = 0;
    }
    usados += tam;
    // Esta linha já estourou: cabem as anteriores (ou 1, se foi logo a primeira).
    if (usados > maxChars) return Math.max(1, i);
  }
  return teto;
}
/** A partir desta profundidade uma lista é ANINHADA (não a de topo) e é podada aqui — ex.:
 *  loop `{itens:[{valor, dados:{items:[...]}}]}`, onde a lista de topo é pequena (nº de
 *  colaboradores) mas cada `dados` traz centenas de linhas → 1M. Topo (0/1) fica pro
 *  tratamento principal abaixo. */
const PODAR_MIN_DEPTH = 2;
const MAX_DEPTH_PODA = 8;
/** Rede de segurança final: acima disto (chars do JSON) poda agressiva, aconteça o que acontecer. */
const HARD_MAX_CHARS = 400_000;

const CHAVES_LISTA = ["items", "itens", "data", "dados", "rows", "registros", "result", "results", "lista"];

/**
 * `enviadas` é o número REAL de linhas na amostra, não o teto de 50.
 *
 * A nota dizia sempre "Amostra de 50" enquanto o campo `_amostra` ao lado
 * trazia o número certo — dois números contraditórios sobre a mesma coisa no
 * mesmo objeto, e o errado era o que vinha em prosa, que é o que o modelo lê.
 * Com linha larga a amostra real cai para uma dezena, e mandar o modelo pensar
 * que viu 50 de 397 quando viu 9 é convidá-lo a concluir pela amostra.
 */
function notaAmostra(id: string, total: number, enviadas: number): string {
  return (
    `Amostra de ${enviadas} de ${total} registros. Para o TOTAL exato, contar, filtrar, somar/média ` +
    `ou exportar, use as ferramentas de dados com dados_de="${id}" (elas cobrem 100% das linhas) — NUNCA conte/analise pela amostra.`
  );
}

/** Poda listas ANINHADAS grandes (profundidade ≥ `PODAR_MIN_DEPTH`): registra cada uma como
 *  dataset e troca pela amostra + id. Preserva a referência quando nada muda (não recria). */
function podarProfundo(node: unknown, reg: DatasetRegistry, depth: number): unknown {
  if (node == null || typeof node !== "object") {
    if (typeof node === "string" && node.length > 20_000) return node.slice(0, 20_000) + "…(truncado)";
    return node;
  }
  if (depth >= MAX_DEPTH_PODA) return node;
  if (Array.isArray(node)) {
    let mudou = false;
    const filhos = node.map((el) => { const c = podarProfundo(el, reg, depth + 1); if (c !== el) mudou = true; return c; });
    if (depth >= PODAR_MIN_DEPTH && filhos.length > MAX_ITENS_MODELO && filhos.some(ehLinha)) {
      const meta = registrarDataset(reg, filhos);
      // O teto de CARACTERES vale aqui também. Sem ele, uma lista aninhada de 51
      // linhas largas passava inteira — o corte por linhas sozinho não protege
      // contexto nenhum quando a linha tem 200 campos.
      if (meta) {
        const cabem = linhasQueCabem(filhos);
        return { _dataset: meta.id, _total: meta.total, _colunas: meta.colunas, _amostra: cabem, _nota: notaAmostra(meta.id, meta.total, cabem), itens: filhos.slice(0, cabem) };
      }
    }
    return mudou ? filhos : node;
  }
  const o: Record<string, unknown> = {};
  let mudou = false;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) { const c = podarProfundo(v, reg, depth + 1); o[k] = c; if (c !== v) mudou = true; }
  return mudou ? o : node;
}

/** Poda de emergência (arrays→10, strings curtas) quando NADA mais conteve o tamanho. */
function podaAgressiva(node: unknown, depth: number): unknown {
  if (typeof node === "string") return node.length > 300 ? node.slice(0, 300) + "…" : node;
  if (node == null || typeof node !== "object") return node;
  if (depth > MAX_DEPTH_PODA) return Array.isArray(node) ? `[${node.length} itens omitidos]` : "{…}";
  if (Array.isArray(node)) {
    const cut = node.slice(0, 10).map((x) => podaAgressiva(x, depth + 1));
    if (node.length > 10) cut.push(`…(+${node.length - 10} itens omitidos)`);
    return cut;
  }
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) o[k] = podaAgressiva(v, depth + 1);
  return o;
}

function redeSegurancaFinal(out: unknown): { out: unknown; podou: boolean; bytes: number } {
  let bytes = 0;
  try {
    const s = JSON.stringify(out);
    bytes = s?.length ?? 0;
    if (!s || s.length <= HARD_MAX_CHARS) return { out, podou: false, bytes };
  } catch {
    return { out, podou: false, bytes };
  }
  const podado = podaAgressiva(out, 0);
  // AVISA o modelo. Antes cortava 400 KB em silêncio total: ele somava/contava sobre
  // o resto e entregava um número errado sem nenhum sinal de que faltava dado.
  const aviso = {
    _poda_emergencia: true,
    _bytes_original: bytes,
    _aviso_poda:
      "O resultado passou de 400 KB e foi CORTADO (listas → 10 itens, textos → 300 caracteres). " +
      "NÃO conte, some nem conclua a partir deste conteúdo cortado — use `dados_de` com as ferramentas " +
      "de dados, que enxergam 100% das linhas.",
  };
  const comAviso = podado && typeof podado === "object" && !Array.isArray(podado)
    ? { ...(podado as Record<string, unknown>), ...aviso }
    : { itens: podado, ...aviso };
  return { out: comAviso, podou: true, bytes };
}

/** Injeta o metadado de dataset no resultado devolvido ao modelo. Registra TODAS as linhas
 *  no dataset (para dados_de) mas entrega ao modelo só uma AMOSTRA quando a lista é grande —
 *  senão o contexto estoura. Poda também listas ANINHADAS (loop por colaborador) e tem uma
 *  rede de segurança final. O `_total`/`_dataset` + as ferramentas cobrem os 100%. */
/** A3: o resultado é uma lista de dados VAZIA (0 registros)? (array vazio no topo, ou uma
 *  chave de lista conhecida vazia). Sinal de "não existe esse dado para o filtro". */
function pareceVazio(data: unknown): boolean {
  if (Array.isArray(data)) return data.length === 0;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of CHAVES_LISTA) if (Array.isArray(o[k])) return (o[k] as unknown[]).length === 0;
  }
  return false;
}

/**
 * O que aconteceu com o retorno da tool no caminho até o modelo. Existe porque
 * nenhum passo do trace registrava isto: dava para ver a CHAMADA da ferramenta, mas
 * não se o modelo recebeu 50 de 4.000 linhas, se a poda de emergência disparou, nem
 * qual `_dataset` nasceu. Sem esse número não dá para dizer qual perda é a real.
 */
export type RelatoInjecao = {
  dataset: string | null;
  total: number;
  amostra_enviada: number;
  completo: boolean;
  sem_dados: boolean;
  bytes: number;
  poda_agressiva: boolean;
};

export function injetarDataset(reg: DatasetRegistry | undefined, saida: unknown): unknown {
  return injetarDatasetComRelato(reg, saida).saida;
}

export function injetarDatasetComRelato(
  reg: DatasetRegistry | undefined,
  saida: unknown,
): { saida: unknown; relato: RelatoInjecao | null } {
  if (!reg || !saida || typeof saida !== "object") return { saida, relato: null };
  // 1) Poda listas ANINHADAS grandes (cada `dados` do loop pode ter centenas de linhas).
  const podado = podarProfundo(saida, reg, 0);
  // 2) Topo: registra a lista principal + tag + amostra (comportamento existente).
  const meta = registrarDataset(reg, podado);
  let out: unknown = podado;
  // Fora do `if` porque o relato lá embaixo precisa deles — antes ele recalculava
  // por conta própria (`Math.min(total, 50)`) e publicava um número que não era o
  // que saiu, cegando justamente o trace que a gente usa para medir o consumo.
  let enviadas = 0;
  let truncado = false;
  if (meta) {
    // O corte é por LINHAS *e* por TAMANHO: registro largo (cadastro funcional
    // tem ~200 campos) estourava o contexto mesmo dentro das 50 linhas.
    //
    // A lista é a MESMA que `registrarDataset` contou (`extrairLista`). Havia uma
    // segunda varredura aqui, com `some` no lugar de `filter`: quando as duas
    // discordavam, `cabem` era medido sobre um array e o corte aplicado a outro.
    const listaTopo: unknown[] = extrairLista(podado) ?? [];
    const cabem = linhasQueCabem(listaTopo);
    enviadas = cabem;
    truncado = meta.total > cabem;
    const tag: Record<string, unknown> = { _dataset: meta.id, _total: meta.total, _colunas: meta.colunas };
    // Truncado → é AMOSTRA (usa ferramentas de dados p/ o total). Completo → o modelo já
    // tem TODAS as linhas: marca `_completo` para ele responder direto sem re-consultar.
    if (truncado) { tag._amostra = cabem; tag._nota = notaAmostra(meta.id, meta.total, cabem); }
    else tag._completo = true;
    if (Array.isArray(podado)) {
      out = { ...tag, itens: truncado ? podado.slice(0, cabem) : podado };
    } else {
      const o = podado as Record<string, unknown>;
      let feito = false;
      if (truncado) {
        for (const k of CHAVES_LISTA) {
          const v = o[k];
          if (Array.isArray(v) && v.some(ehLinha)) { out = { ...o, [k]: v.slice(0, cabem), ...tag }; feito = true; break; }
        }
      }
      if (!feito) out = { ...o, ...tag };
    }
  }
  let semDados = false;
  if (!meta && pareceVazio(podado)) {
    // A3: consulta retornou ZERO registros → marca explícito para o modelo NÃO inventar.
    semDados = true;
    const extra = !Array.isArray(podado) && podado && typeof podado === "object" ? (podado as Record<string, unknown>) : {};
    out = {
      ...extra,
      _sem_dados: true,
      _aviso: "A consulta retornou ZERO registros. Se esta é a única fonte para o pedido, responda claramente que NÃO encontrou esse dado no sistema (para o filtro informado) — NÃO invente valores nem responda por conhecimento geral.",
    };
  }
  // 3) Rede de segurança: se AINDA estiver gigante, poda agressiva.
  const rede = redeSegurancaFinal(out);
  return {
    saida: rede.out,
    relato: {
      dataset: meta?.id ?? null,
      total: meta?.total ?? 0,
      amostra_enviada: enviadas,
      completo: !!meta && !truncado,
      sem_dados: semDados,
      bytes: rede.bytes,
      poda_agressiva: rede.podou,
    },
  };
}

export type TabelaExpandida = { colunas: string[]; linhas: string[][]; total: number; truncado: boolean };

/**
 * Expande uma tabela do relatório a partir de um dataset registrado: usa TODAS
 * as linhas (até `max`). `campos` = chaves da linha por coluna (fallback: todas
 * as colunas inferidas); `colunas` = cabeçalhos exibidos (fallback: os campos).
 */
export function expandirTabela(
  reg: DatasetRegistry,
  datasetId: string,
  campos?: string[],
  colunas?: string[],
  max = 50000,
): TabelaExpandida | null {
  const ds = acharDataset(reg, datasetId);
  if (!ds) return null;
  const keys = campos && campos.length ? campos.map((k) => String(k).trim()) : ds.colunas;
  if (keys.length === 0) return null;
  const headers =
    colunas && colunas.length === keys.length
      ? colunas
      : ds.headers && ds.headers.length === keys.length
        ? ds.headers
        : keys;
  const linhas = ds.rows.slice(0, max).map((r) => keys.map((k) => celula(r[k])));
  return { colunas: headers, linhas, total: ds.rows.length, truncado: ds.rows.length > max };
}

/* ────────────────────────────────────────────────────────────────────────────
 * CONSULTA / FILTRO server-side sobre um dataset já coletado.
 *
 * Motivo (bug grave): quando o relatório é grande, o modelo NÃO recebe as linhas
 * uma a uma — só um resumo estatístico (agregados + amostra). Se o usuário pede
 * "só os registros que têm X", o modelo tende a filtrar pela AMOSTRA (parcial) e
 * gera um arquivo com N errado (ex.: 10 de 70). A correção é NÃO deixar o modelo
 * filtrar: ele descreve as condições, o servidor aplica sobre 100% das linhas
 * COLETADAS e registra o subconjunto como um novo dataset para exportar exato.
 * ──────────────────────────────────────────────────────────────────────────── */

export type Operador =
  | "contem" | "nao_contem" | "igual" | "diferente"
  | "comeca" | "termina" | "vazio" | "nao_vazio"
  | "maior" | "menor" | "maior_igual" | "menor_igual";

export const OPERADORES: Operador[] = [
  "contem", "nao_contem", "igual", "diferente", "comeca", "termina",
  "vazio", "nao_vazio", "maior", "menor", "maior_igual", "menor_igual",
];

export type Filtro = { coluna: string; operador: Operador; valor?: string };
export type ConsultaResultado = {
  id: string;            // id do subconjunto registrado (para gerar_relatorio dados_de)
  total: number;         // total EXATO de correspondências (sobre todas as linhas)
  colunas: string[];
  amostra: string[][];   // primeiras N correspondências (para o modelo mostrar/conferir)
  colunaNaoEncontrada?: string;
  /** Coluna usada na ordenação — presente só quando houve. */
  ordenadoPor?: string;
};

/** Normaliza texto para comparação: sem acento, minúsculo, sem espaços nas pontas. */
/**
 * Escape unicode LITERAL vindo do modelo: `"Compet\\u00eancia"` como 15
 * caracteres, com a barra invertida de verdade — não o `ê`.
 *
 * Acontece quando o modelo serializa o argumento uma vez a mais do que devia.
 * Visto em produção (19/08/2026): ele pediu `agrupar` por
 * `"Compet\\u00eancia"`, recebeu "a coluna não existe — colunas reais:
 * Competência…", tentou de novo com `"Compet\\u00f5ncia"` (que nem é a letra
 * certa) e desistiu. Duas chamadas queimadas e um "não consegui" numa coluna
 * que estava lá.
 *
 * Decodificar aqui resolve o casamento inteiro de uma vez: nome de coluna,
 * valor de filtro e agrupamento passam todos por `norm`.
 */
function decodificarEscapes(s: string): string {
  return s.includes("\\u")
    ? s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    : s;
}

function norm(s: unknown): string {
  return decodificarEscapes(String(s ?? ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Como a coluna foi resolvida — e o que mais casaria. Serve para dois fins:
 * instrumentar (quanto do sistema depende de casamento aproximado) e DESAMBIGUAR:
 * "Salário" casando com Salário Base, Líquido e Família e escolhendo a primeira
 * produz um número errado que ninguém percebe. Com 2+ candidatos, o chamador
 * pergunta em vez de chutar.
 */
export type ColunaInfo =
  | { idx: number; nome: string; via: "exata" | "indice" | "prefixo" | "token" | "fuzzy" | "sinal" | "escolhida"; candidatos?: string[] }
  | { idx: null; via: "ambigua"; candidatos: string[] }
  | { idx: null; via: "ausente"; candidatos: string[] };

/**
 * O que o motor ESPERA daquela coluna. Serve de desempate quando o nome sozinho não
 * decide: uma soma quer a coluna numérica, um agrupamento quer a de texto.
 */
export type SinalColuna = { tipo: "numerico" | "texto" | "qualquer"; valor?: string };

/** Fração de células que são número pt-BR (amostra do topo — dados já em memória). */
function fracaoNumerica(ds: Dataset, idx: number): number {
  const chave = ds.colunas[idx];
  if (!chave) return 0;
  let vistas = 0, numericas = 0;
  for (const row of ds.rows.slice(0, 200)) {
    const v = String(row[chave] ?? "").trim();
    if (!v) continue;
    vistas++;
    if (Number.isFinite(parseNumBR(v))) numericas++;
  }
  return vistas ? numericas / vistas : 0;
}

/** Alguma célula da coluna contém este texto? Desempata `Situação` × `Situação Férias`. */
function contemValor(ds: Dataset, idx: number, valor: string): boolean {
  const chave = ds.colunas[idx];
  const alvo = norm(valor);
  if (!chave || !alvo) return false;
  return ds.rows.slice(0, 200).some((row) => norm(row[chave]).includes(alvo));
}

/** Tokens significativos do nome, para casar por palavra inteira. */
function tokensNome(s: string): string[] {
  return norm(s).split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Resolve o nome de coluna em CAMADAS, da mais precisa para a mais frouxa. A primeira
 * camada com candidato vence; só há desempate dentro dela.
 *
 * O casamento por substring bidirecional sozinho é ruim demais para relatório de RH:
 * "Férias" casa Início Férias, Fim Férias, Dias Férias e Saldo Férias; "Salário" casa
 * Base, Líquido e Família. Tratar isso como erro trava o turno (cada erro consome um
 * passo do orçamento); escolher a primeira em silêncio devolve número errado. As
 * camadas + o sinal do motor resolvem a maioria; o resto escolhe e AVISA.
 */
export function resolverColunaInfo(ds: Dataset, coluna: string, sinal?: SinalColuna): ColunaInfo {
  const alvo = norm(coluna);
  if (!alvo) return { idx: null, via: "ausente", candidatos: [] };

  // 1) Nome exato — resolve "Férias" quando existe a coluna literal `Férias`.
  const exata = ds.colunas.findIndex((c) => norm(c) === alvo);
  if (exata >= 0) return { idx: exata, nome: ds.colunas[exata]!, via: "exata" };

  // 2) Índice cN.
  const m = /^c(\d+)$/i.exec(coluna.trim());
  if (m) {
    const i = Number(m[1]);
    if (i >= 0 && i < ds.colunas.length) return { idx: i, nome: ds.colunas[i]!, via: "indice" };
  }

  const tokensAlvo = tokensNome(coluna);
  const idx = ds.colunas.map((_c, i) => i);
  // 3) Prefixo de palavra inteira: "Salário" → "Salário Base", nunca "Meu Salário".
  const porPrefixo = idx.filter((i) => norm(ds.colunas[i]).startsWith(alvo + " "));
  // 4) Contenção por TOKEN: todos os termos do alvo como palavras inteiras da coluna.
  //    Elimina o falso-positivo do substring ("id" casando "Cidade").
  const porToken = idx.filter((i) => {
    const t = new Set(tokensNome(ds.colunas[i] ?? ""));
    return tokensAlvo.length > 0 && tokensAlvo.every((x) => t.has(x));
  });
  // 5) Substring bidirecional — a rede antiga, agora como última camada.
  const porSubstring = idx.filter((i) => {
    const n = norm(ds.colunas[i]);
    return n.includes(alvo) || alvo.includes(n);
  });

  type ViaCamada = "prefixo" | "token" | "fuzzy";
  const camada: [number[], ViaCamada][] = [
    [porPrefixo, "prefixo"],
    [porToken, "token"],
    [porSubstring, "fuzzy"],
  ];
  for (const [cands, via] of camada) {
    if (!cands.length) continue;
    if (cands.length === 1) return { idx: cands[0]!, nome: ds.colunas[cands[0]!]!, via };
    return desempatarColuna(ds, cands, via, sinal);
  }
  return { idx: null, via: "ausente", candidatos: [] };
}

type ViaCamadaExport = "prefixo" | "token" | "fuzzy";
/** Ambiguidade dentro da camada: usa o sinal do motor; sobrando, escolhe e marca. */
function desempatarColuna(ds: Dataset, cands: number[], via: ViaCamadaExport, sinal?: SinalColuna): ColunaInfo {
  const nomes = cands.map((i) => ds.colunas[i]!);
  let restantes = cands;

  if (sinal?.tipo === "numerico") {
    const num = restantes.filter((i) => fracaoNumerica(ds, i) >= 0.8);
    // Nenhuma candidata é numérica numa operação de valor: qualquer escolha erra.
    if (!num.length) return { idx: null, via: "ambigua", candidatos: nomes };
    restantes = num;
  } else if (sinal?.tipo === "texto") {
    const txt = restantes.filter((i) => fracaoNumerica(ds, i) <= 0.2);
    if (txt.length) restantes = txt;
    // Filtro textual com valor: prefere a coluna que REALMENTE contém aquele valor.
    if (sinal.valor && restantes.length > 1) {
      const comValor = restantes.filter((i) => contemValor(ds, i, sinal.valor!));
      if (comValor.length) restantes = comValor;
    }
  }

  if (restantes.length === 1) return { idx: restantes[0]!, nome: ds.colunas[restantes[0]!]!, via: "sinal" };

  // Todas identificador numa operação de valor → erra: somar matrícula é sempre errado.
  if (sinal?.tipo === "numerico" && restantes.every((i) => pareceIdentificador(ds.colunas[i] ?? ""))) {
    return { idx: null, via: "ambigua", candidatos: nomes };
  }
  if (process.env.COLUNA_AMBIGUA_ERRO === "1") return { idx: null, via: "ambigua", candidatos: nomes };

  // Escolha DETERMINÍSTICA: nome mais curto (o curto é o canônico — `Salário` <
  // `Salário Família`), empate → menor índice. E o chamador é obrigado a declarar.
  const escolhido = restantes.slice().sort((a, b) => {
    const na = ds.colunas[a] ?? "", nb = ds.colunas[b] ?? "";
    return na.length - nb.length || a - b;
  })[0]!;
  void via;
  return { idx: escolhido, nome: ds.colunas[escolhido]!, via: "escolhida", candidatos: nomes };
}

/** Resolve o nome de coluna informado (ou `cN`) para o índice na tabela. */
function resolverColuna(ds: Dataset, coluna: string, sinal?: SinalColuna): number | null {
  return resolverColunaInfo(ds, coluna, sinal).idx;
}

/** O operador do filtro diz o TIPO esperado da coluna — desempate de graça. */
function sinalDoOperador(op: Operador, valor?: string): SinalColuna {
  if (op === "maior" || op === "menor" || op === "maior_igual" || op === "menor_igual") return { tipo: "numerico" };
  if (op === "contem" || op === "nao_contem" || op === "comeca" || op === "termina" || op === "igual" || op === "diferente") {
    return { tipo: "texto", ...(valor ? { valor } : {}) };
  }
  return { tipo: "qualquer" };
}

/**
 * Aviso a anexar à `nota` de um resultado, quando a coluna foi escolhida por
 * desempate. Recalcula do registro em vez de atravessar 6 tipos de resultado — a
 * resolução é pura e determinística, então o resultado é o mesmo.
 */
export function avisoColunaEscolhida(
  reg: DatasetRegistry,
  id: string,
  coluna: string,
  sinal?: SinalColuna,
): string | null {
  const ds = acharDataset(reg, id);
  if (!ds || !coluna?.trim()) return null;
  return avisoDeColuna(resolverColunaInfo(ds, coluna, sinal));
}

/** Aviso pronto quando a escolha foi por desempate — o modelo TEM de repassá-lo. */
export function avisoDeColuna(info: ColunaInfo): string | null {
  if (info.idx === null || info.via !== "escolhida" || !info.candidatos?.length) return null;
  const outras = info.candidatos.filter((c) => c !== info.nome);
  if (!outras.length) return null;
  return `Considerei a coluna "${info.nome}" (também casavam: ${outras.join(", ")}). DIGA isso ao usuário e ofereça refazer com outra.`;
}

/** Ids ATIVOS no registro, com tamanho e colunas — para erros que dizem o que existe. */
export function listarDatasets(reg: DatasetRegistry): { id: string; total: number; colunas: string[] }[] {
  return reg.list.map((d) => ({ id: d.id, total: d.rows.length, colunas: d.headers ?? d.colunas }));
}

/** Frase pronta com os ids disponíveis (teto de 6 × 12 colunas para não estourar token). */
export function textoDatasetsDisponiveis(reg: DatasetRegistry): string {
  const itens = listarDatasets(reg);
  if (!itens.length) return "Nenhuma tabela foi carregada neste turno — chame primeiro a ferramenta de dados.";
  return itens
    .slice(0, 6)
    .map((d) => `${d.id} (${d.total} linha(s): ${d.colunas.slice(0, 12).join(", ")})`)
    .join(" · ");
}

/**
 * Explica por que uma coluna não foi aceita. Distingue os dois casos, que antes se
 * confundiam num "não existe" só: AUSENTE (o modelo inventou o nome) e AMBÍGUA
 * ("Salário" casando com Salário Base, Líquido e Família). No ambíguo o código
 * escolhia a PRIMEIRA em silêncio — e o número saía errado sem ninguém ver.
 */
export function explicarColuna(reg: DatasetRegistry, id: string, coluna: string, sinal?: SinalColuna): string {
  const ds = acharDataset(reg, id);
  const nomes = ds ? (ds.headers ?? ds.colunas) : [];
  if (!ds) return `A coluna "${coluna}" não pôde ser resolvida: a tabela "${id}" não existe neste turno.`;
  const info = resolverColunaInfo(ds, coluna, sinal);
  if (info.idx === null && info.via === "ambigua") {
    return (
      `"${coluna}" é AMBÍGUO: casa com ${info.candidatos.join(", ")}. ` +
      "Repita a chamada informando a coluna EXATA — não vou escolher por você para não devolver um número errado."
    );
  }
  const perto = colunaMaisProxima(reg, id, coluna);
  return (
    `A coluna "${coluna}" não existe em "${id}". Colunas reais: ${nomes.slice(0, 14).join(", ")}.` +
    (perto ? ` Você quis dizer "${perto}"?` : "")
  );
}

/** Coluna mais parecida com `alvo` num dataset — para sugerir no erro ("você quis dizer…"). */
export function colunaMaisProxima(reg: DatasetRegistry, id: string, alvo: string): string | null {
  const ds = acharDataset(reg, id);
  if (!ds) return null;
  const info = resolverColunaInfo(ds, alvo);
  if (info.idx !== null) return info.nome;
  return info.candidatos[0] ?? null;
}

/** Avalia UMA condição sobre uma célula (texto e número em pt-BR). */
function bate(cell: string, op: Operador, valor: string): boolean {
  const c = norm(cell), v = norm(valor);
  switch (op) {
    case "contem": return c.includes(v);
    case "nao_contem": return !c.includes(v);
    case "igual": return c === v;
    case "diferente": return c !== v;
    case "comeca": return c.startsWith(v);
    case "termina": return c.endsWith(v);
    case "vazio": return c === "";
    case "nao_vazio": return c !== "";
    default: {
      const a = parseNumBR(cell), b = parseNumBR(valor);
      if (a == null || b == null) return false;
      if (op === "maior") return a > b;
      if (op === "menor") return a < b;
      if (op === "maior_igual") return a >= b;
      return a <= b; // menor_igual
    }
  }
}

/**
 * Aplica os filtros sobre TODAS as linhas do dataset (não sobre uma amostra) e
 * registra o subconjunto como um novo dataset (id retornado em `id`) para o
 * modelo exportar via `gerar_relatorio({ dados_de })`. `modo`: "E" (todas as
 * condições) ou "OU" (qualquer uma). Sem filtros → devolve todas as linhas.
 */
export function consultarDataset(
  reg: DatasetRegistry,
  datasetId: string,
  filtros: Filtro[],
  modo: "E" | "OU" = "E",
  amostraMax = 50,
  /** Coluna pela qual ordenar antes de cortar a amostra — é o que torna "os N maiores" exato. */
  ordenarPor?: string | null,
  ordem: "desc" | "asc" = "desc",
): ConsultaResultado | null {
  const ds = acharDataset(reg, datasetId);
  if (!ds) return null;
  const nomes = ds.colunas;
  const asRow = (r: DatasetRow) => nomes.map((_c, i) => celula(r["c" + i]));
  const conds = filtros.map((f) => ({ f, idx: resolverColuna(ds, f.coluna, sinalDoOperador(f.operador, f.valor)) }));
  const ausente = conds.find((c) => c.idx == null);
  if (ausente) return { id: "", total: 0, colunas: nomes, amostra: [], colunaNaoEncontrada: ausente.f.coluna };

  const linhas: string[][] = [];
  for (const r of ds.rows) {
    const row = asRow(r);
    const res = conds.map(({ f, idx }) => bate(row[idx!] ?? "", f.operador, f.valor ?? ""));
    const ok = res.length === 0 ? true : modo === "OU" ? res.some(Boolean) : res.every(Boolean);
    if (ok) linhas.push(row);
  }
  // ORDENAÇÃO: é o que faltava para "os 10 maiores".
  //
  // Sem isto não havia ferramenta para "os 10 colaboradores com maior salário":
  // `agrupar` ordena GRUPOS agregados, `agregar_valores` devolve UM número, e
  // `consultar_registros` filtrava sem ordenar. O modelo tentava os três, não
  // conseguia, e redigia a lista a partir da AMOSTRA — que é parcial.
  //
  // Aconteceu em produção (19/08/2026): ele descobriu que o maior salário era
  // R$ 31.733,10 e entregou uma tabela começando em R$ 21.263,28, tirada das 43
  // linhas da amostra em vez das 10.149 reais. O usuário percebeu na hora
  // ("por que Fulano não está no top 10?") e a conversa não se recuperou.
  //
  // Com ordenação, as N primeiras linhas SÃO a resposta — completa, não amostra.
  if (ordenarPor) {
    const idx = resolverColuna(ds, ordenarPor, { tipo: "numerico" });
    if (idx == null) return { id: "", total: 0, colunas: nomes, amostra: [], colunaNaoEncontrada: ordenarPor };
    const desc = ordem !== "asc";
    linhas.sort((a, b) => {
      const na = parseNumBR(a[idx] ?? ""), nb = parseNumBR(b[idx] ?? "");
      // Sem número em uma das pontas, compara como TEXTO — ordenar por nome é
      // pedido legítimo, e devolver ordem aleatória seria pior que a alfabética.
      if (na == null || nb == null) {
        const c = String(a[idx] ?? "").localeCompare(String(b[idx] ?? ""), "pt-BR");
        return desc ? -c : c;
      }
      return desc ? nb - na : na - nb;
    });
  }
  // Registra o subconjunto como novo dataset (mesmas colunas) para exportar exato.
  const { id } = registrarTabelaTela(reg, nomes, linhas);
  return { id, total: linhas.length, colunas: nomes, amostra: linhas.slice(0, amostraMax), ...(ordenarPor ? { ordenadoPor: ordenarPor } : {}) };
}

export type Agregacao =
  | "soma" | "media" | "mediana" | "min" | "max" | "amplitude"
  | "variancia" | "desvio_padrao" | "moda" | "contar" | "distintos";
export type AgregacaoResultado = {
  operacao: Agregacao;
  coluna: string;
  valor: number;
  linhasConsideradas: number; // linhas após o filtro (base da contagem)
  valoresNumericos: number;   // quantas células entraram no cálculo (numéricas)
  ignorados: number;          // células não-vazias que não são número (ignoradas no cálculo)
  colunaNaoEncontrada?: string;
  colunaIdentificador?: string; // A7: coluna é identificador (matrícula/CPF/id) → agregar valor não faz sentido
};

/** A7: a coluna parece um IDENTIFICADOR (matrícula/CPF/CNPJ/código/id)? Somar/mediar isso
 *  gera um total sem sentido (ex.: "soma de matrícula"). Detecta por TOKEN do nome — não
 *  dá falso-positivo em "idade"/"salário"/"valor" (que não têm o token exato). */
const TOKENS_ID = new Set(["matricula", "matr", "cpf", "cnpj", "pis", "nis", "ctps", "rg", "codigo", "cod", "id", "protocolo", "nsr", "chapa"]);
function pareceIdentificador(nome: string): boolean {
  return String(nome)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((t) => TOKENS_ID.has(t));
}
/** Operações de VALOR (fazem média/soma dos números) — sem sentido num identificador.
 *  `min`/`max`/`contar`/`distintos` continuam liberados (ex.: "menor matrícula" é válido). */
const OPS_VALOR_ID = new Set<Agregacao>(["soma", "media", "mediana", "variancia", "desvio_padrao", "moda", "amplitude"]);

/** Percentil por interpolação linear (igual ao PERCENTILE_CONT do Oracle). */
export function percentil(ordenado: number[], p: number): number {
  const n = ordenado.length;
  if (n === 0) return 0;
  if (n === 1) return ordenado[0]!;
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (n - 1);
  const lo = Math.floor(rank), hi = Math.ceil(rank);
  return lo === hi ? ordenado[lo]! : ordenado[lo]! + (ordenado[hi]! - ordenado[lo]!) * (rank - lo);
}

/** Aplica os filtros e devolve as linhas que passam (ou a coluna ausente). */
function filtrarLinhas(
  ds: Dataset,
  filtros: Filtro[],
  modo: "E" | "OU",
): { linhas: string[][] } | { colunaNaoEncontrada: string } {
  const nomes = ds.colunas;
  const asRow = (r: DatasetRow) => nomes.map((_c, i) => celula(r["c" + i]));
  const conds = filtros.map((f) => ({ f, idx: resolverColuna(ds, f.coluna, sinalDoOperador(f.operador, f.valor)) }));
  const ausente = conds.find((c) => c.idx == null);
  if (ausente) return { colunaNaoEncontrada: ausente.f.coluna };
  const linhas: string[][] = [];
  for (const r of ds.rows) {
    const row = asRow(r);
    const res = conds.map(({ f, idx }) => bate(row[idx!] ?? "", f.operador, f.valor ?? ""));
    const ok = res.length === 0 ? true : modo === "OU" ? res.some(Boolean) : res.every(Boolean);
    if (ok) linhas.push(row);
  }
  return { linhas };
}

/** Calcula UMA operação sobre um vetor numérico (+ contagem de linhas, p/ contar). */
export function calcularOperacao(operacao: Agregacao, nums: number[], linhas: number): number {
  if (operacao === "contar") return linhas;
  if (operacao === "distintos") return new Set(nums).size;
  const n = nums.length;
  if (!n) return 0;
  const soma = nums.reduce((s, x) => s + x, 0);
  const media = soma / n;
  const somaQuad = () => nums.reduce((s, x) => s + (x - media) ** 2, 0);
  switch (operacao) {
    case "soma": return soma;
    case "media": return media;
    case "mediana": return percentil([...nums].sort((a, b) => a - b), 50);
    case "min": return Math.min(...nums);
    case "max": return Math.max(...nums);
    case "amplitude": return Math.max(...nums) - Math.min(...nums);
    case "variancia": return n > 1 ? somaQuad() / (n - 1) : 0;            // amostral (= STDDEV/VARIANCE do Oracle)
    case "desvio_padrao": return n > 1 ? Math.sqrt(somaQuad() / (n - 1)) : 0;
    case "moda": {
      const f = new Map<number, number>(); let best = 0, m = nums[0]!;
      for (const x of nums) { const c = (f.get(x) ?? 0) + 1; f.set(x, c); if (c > best) { best = c; m = x; } }
      return m;
    }
    default: return 0;
  }
}

/** Extrai os NÚMEROS (pt-BR/R$) de uma coluna nas linhas dadas + estatística de qualidade. */
function extrairNumeros(linhas: string[][], idxCol: number): { nums: number[]; ignorados: number; distintos: number } {
  const nums: number[] = []; const distintos = new Set<string>(); let ignorados = 0;
  for (const row of linhas) {
    const cell = row[idxCol] ?? "";
    if (String(cell).trim()) distintos.add(norm(cell));
    const n = parseNumBR(cell);
    if (n == null) { if (String(cell).trim()) ignorados++; continue; }
    nums.push(n);
  }
  return { nums, ignorados, distintos: distintos.size };
}

/**
 * AGREGA uma coluna sobre TODAS as linhas do dataset (não uma amostra), com filtro
 * opcional aplicado antes. Garante SOMA/MÉDIA/MEDIANA/DESVIO/MÍN/MÁX/CONTAGEM EXATOS
 * — a IA nunca soma na mão nem se recusa por volume. Números pt-BR/R$ via parseNumBR.
 */
export function agregarDataset(
  reg: DatasetRegistry,
  datasetId: string,
  coluna: string,
  operacao: Agregacao,
  filtros: Filtro[] = [],
  modo: "E" | "OU" = "E",
): AgregacaoResultado | null {
  const ds = acharDataset(reg, datasetId);
  if (!ds) return null;
  const idxCol = resolverColuna(ds, coluna, { tipo: OPS_VALOR_ID.has(operacao) ? "numerico" : "qualquer" });
  const base: AgregacaoResultado = { operacao, coluna, valor: 0, linhasConsideradas: 0, valoresNumericos: 0, ignorados: 0 };
  if (idxCol == null) return { ...base, colunaNaoEncontrada: coluna };
  const filt = filtrarLinhas(ds, filtros, modo);
  if ("colunaNaoEncontrada" in filt) return { ...base, coluna: ds.colunas[idxCol] ?? coluna, colunaNaoEncontrada: filt.colunaNaoEncontrada };
  const linhasConsideradas = filt.linhas.length;
  const nomeCol = ds.colunas[idxCol] ?? coluna;
  // A7: bloqueia operação de VALOR sobre um identificador (matrícula/CPF/código) — sem sentido.
  if (OPS_VALOR_ID.has(operacao) && pareceIdentificador(nomeCol)) {
    return { ...base, operacao, coluna: nomeCol, linhasConsideradas,
      colunaIdentificador: `"${nomeCol}" parece um IDENTIFICADOR (matrícula/CPF/código/id) — ${operacao} não faz sentido. Para quantidade use "contar"/"distintos"; para valores, escolha uma coluna de medida (salário, dias, horas…).` };
  }
  const { nums, ignorados, distintos } = extrairNumeros(filt.linhas, idxCol);
  const valor = operacao === "distintos" ? distintos : calcularOperacao(operacao, nums, linhasConsideradas);
  return { operacao, coluna: nomeCol, valor, linhasConsideradas, valoresNumericos: nums.length, ignorados };
}

export type EstatisticasColuna = {
  coluna: string;
  linhas: number;      // linhas consideradas (após o filtro)
  validos: number;     // valores numéricos
  ignorados: number;   // células não-numéricas não-vazias
  distintos: number;
  soma: number; media: number; mediana: number; moda: number | null;
  min: number; max: number; amplitude: number;
  variancia: number; desvio_padrao: number;
  p25: number; p75: number; p90: number; p95: number; p99: number;
  colunaNaoEncontrada?: string;
};

/** PERFIL ESTATÍSTICO completo de uma coluna sobre 100% do dataset (com filtro opcional). */
export function estatisticasColuna(
  reg: DatasetRegistry,
  datasetId: string,
  coluna: string,
  filtros: Filtro[] = [],
  modo: "E" | "OU" = "E",
): EstatisticasColuna | null {
  const ds = acharDataset(reg, datasetId);
  if (!ds) return null;
  const vazio: EstatisticasColuna = {
    coluna, linhas: 0, validos: 0, ignorados: 0, distintos: 0, soma: 0, media: 0, mediana: 0, moda: null,
    min: 0, max: 0, amplitude: 0, variancia: 0, desvio_padrao: 0, p25: 0, p75: 0, p90: 0, p95: 0, p99: 0,
  };
  const idxCol = resolverColuna(ds, coluna, { tipo: "numerico" });
  if (idxCol == null) return { ...vazio, colunaNaoEncontrada: coluna };
  const filt = filtrarLinhas(ds, filtros, modo);
  if ("colunaNaoEncontrada" in filt) return { ...vazio, coluna: ds.colunas[idxCol] ?? coluna, colunaNaoEncontrada: filt.colunaNaoEncontrada };
  const nome = ds.colunas[idxCol] ?? coluna;
  const { nums, ignorados, distintos } = extrairNumeros(filt.linhas, idxCol);
  const linhas = filt.linhas.length, validos = nums.length;
  if (!validos) return { ...vazio, coluna: nome, linhas, ignorados, distintos };
  const ordenado = [...nums].sort((a, b) => a - b);
  const min = ordenado[0]!, max = ordenado[validos - 1]!;
  const variancia = calcularOperacao("variancia", nums, linhas);
  const freq = new Map<number, number>(); let best = 0, moda: number | null = null;
  for (const x of nums) { const c = (freq.get(x) ?? 0) + 1; freq.set(x, c); if (c > best) { best = c; moda = x; } }
  return {
    coluna: nome, linhas, validos, ignorados, distintos,
    soma: calcularOperacao("soma", nums, linhas), media: calcularOperacao("media", nums, linhas),
    mediana: percentil(ordenado, 50), moda: best > 1 ? moda : null,
    min, max, amplitude: max - min, variancia, desvio_padrao: Math.sqrt(variancia),
    p25: percentil(ordenado, 25), p75: percentil(ordenado, 75), p90: percentil(ordenado, 90),
    p95: percentil(ordenado, 95), p99: percentil(ordenado, 99),
  };
}

export type GrupoResultado = { grupo: string; valor: number; linhas: number };
/** AGRUPA POR uma coluna e agrega outra (ex.: média de Salário por Departamento). */
export function agruparDataset(
  reg: DatasetRegistry,
  datasetId: string,
  colunaGrupo: string,
  colunaValor: string,
  operacao: Agregacao,
  filtros: Filtro[] = [],
  modo: "E" | "OU" = "E",
  limite = 100,
  colunaGrupo2?: string,
): { grupos: GrupoResultado[]; totalGrupos: number } | { colunaNaoEncontrada: string } | null {
  const ds = acharDataset(reg, datasetId);
  if (!ds) return null;
  const idxG = resolverColuna(ds, colunaGrupo, { tipo: "texto" });
  if (idxG == null) return { colunaNaoEncontrada: colunaGrupo };
  // 2ª coluna de grupo (opcional) → CRUZAMENTO exato numa passada (ex.: por empresa E filial).
  const idxG2 = colunaGrupo2 && colunaGrupo2.trim() ? resolverColuna(ds, colunaGrupo2, { tipo: "texto" }) : null;
  if (colunaGrupo2 && colunaGrupo2.trim() && idxG2 == null) return { colunaNaoEncontrada: colunaGrupo2 };
  const precisaValor = operacao !== "contar";
  const idxV = precisaValor ? resolverColuna(ds, colunaValor, { tipo: "numerico" }) : idxG;
  if (precisaValor && idxV == null) return { colunaNaoEncontrada: colunaValor };
  const filt = filtrarLinhas(ds, filtros, modo);
  if ("colunaNaoEncontrada" in filt) return { colunaNaoEncontrada: filt.colunaNaoEncontrada };
  const mapa = new Map<string, { rotulo: string; nums: number[]; linhas: number }>();
  for (const row of filt.linhas) {
    const rot1 = String(row[idxG] ?? "").trim() || "(vazio)";
    const rot = idxG2 != null ? `${rot1} | ${String(row[idxG2] ?? "").trim() || "(vazio)"}` : rot1;
    const k = norm(rot);
    let e = mapa.get(k); if (!e) { e = { rotulo: rot, nums: [], linhas: 0 }; mapa.set(k, e); }
    e.linhas++;
    if (precisaValor) { const n = parseNumBR(row[idxV!] ?? ""); if (n != null) e.nums.push(n); }
  }
  const grupos: GrupoResultado[] = [];
  for (const e of mapa.values()) grupos.push({ grupo: e.rotulo, valor: calcularOperacao(operacao, e.nums, e.linhas), linhas: e.linhas });
  grupos.sort((a, b) => b.valor - a.valor);
  return { grupos: grupos.slice(0, limite), totalGrupos: mapa.size };
}

/* ────────────────────────────────────────────────────────────────────────────
 * DERIVAÇÃO POR LINHA (coluna calculada sobre 100% dos registros).
 *
 * As agregações reduzem UMA coluna a UM número e os filtros comparam coluna com
 * CONSTANTE — faltava a conta LINHA A LINHA entre duas colunas (ex.: mês2 − mês1,
 * variação %). Sem ela o modelo só derivava na amostra (~300) → PARCIAL num
 * relatório grande. Aqui o SERVIDOR calcula cada linha sobre 100% e registra um
 * novo dataset com a coluna derivada, para as ferramentas exatas (estatisticas/
 * consultar_registros/agrupar/gráfico/relatório) operarem sobre ela.
 *
 * INTEGRIDADE (dinheiro em jogo — decisões do usuário):
 *  - determinístico, sem IA no cálculo; pt-BR via parseNumBR;
 *  - célula vazia/não-numérica no OPERANDO → tratada como 0, e o total dessas
 *    linhas é REPORTADO (`vazias_como_zero`) — nada silencioso;
 *  - base ZERO em divisão/percentual/variação → resultado N/A explícito (nunca um
 *    número falso tipo "100%"), também REPORTADO (`base_zero_na`);
 *  - valor guardado com PRECISÃO TOTAL em formato pt-BR canônico (vírgula, SEM
 *    milhar) p/ as agregações seguintes serem exatas; a AMOSTRA arredonda a 2
 *    casas só p/ exibir. `parseNumBR` leria "1.234" como 1234 — por isso a vírgula.
 * ──────────────────────────────────────────────────────────────────────────── */

export type OperacaoLinha =
  | "subtracao" | "soma" | "multiplicacao" | "divisao"
  | "variacao_percentual" | "percentual" | "percentual_do_total";

export const OPERACOES_LINHA: OperacaoLinha[] = [
  "subtracao", "soma", "multiplicacao", "divisao",
  "variacao_percentual", "percentual", "percentual_do_total",
];

export type DerivacaoResultado = {
  id: string;               // novo dataset (colunas originais + a derivada)
  coluna: string;           // nome da coluna criada
  operacao: OperacaoLinha;
  total: number;            // linhas processadas (100%)
  calculadas: number;       // linhas com resultado numérico
  vazias_como_zero: number; // linhas onde um operando vazio/não-numérico virou 0
  base_zero_na: number;     // linhas N/A por base zero / resultado indefinido
  colunas: string[];        // colunas do novo dataset
  amostra: string[][];      // primeiras N linhas (derivada arredondada p/ exibir)
  colunaNaoEncontrada?: string;
};

/** Número → pt-BR canônico com PRECISÃO TOTAL (vírgula decimal, SEM milhar) —
 *  inequívoco p/ parseNumBR. Evita notação científica. N/A (não-finito) → "". */
function numeroCanonico(n: number): string {
  if (!Number.isFinite(n)) return "";
  let s = n.toString();
  if (s.includes("e") || s.includes("E")) s = n.toFixed(20).replace(/0+$/, "").replace(/\.$/, "");
  return s.replace(".", ",");
}

/** Arredonda p/ EXIBIÇÃO (2 casas) em pt-BR. Não afeta o valor guardado. */
function exibir2(n: number): string {
  if (!Number.isFinite(n)) return "N/A";
  return (Math.round(n * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function nomePadraoDerivada(op: OperacaoLinha, a: string, b: string): string {
  switch (op) {
    case "subtracao": return `${a} − ${b}`;
    case "soma": return `${a} + ${b}`;
    case "multiplicacao": return `${a} × ${b}`;
    case "divisao": return `${a} ÷ ${b}`;
    case "variacao_percentual": return `Variação % (${a} vs ${b})`;
    case "percentual": return `% (${a} de ${b})`;
    case "percentual_do_total": return `% do total (${a})`;
    default: return "Calculado";
  }
}

/**
 * Cria uma coluna CALCULADA por linha sobre 100% do dataset e registra um novo
 * dataset (colunas originais + a derivada). `colunaB` pode ser outra coluna OU um
 * número fixo (ignorada em `percentual_do_total`, que usa a soma da coluna A).
 */
export function derivarColuna(
  reg: DatasetRegistry,
  datasetId: string,
  colunaA: string,
  operacao: OperacaoLinha,
  colunaB?: string,
  nomeColuna?: string,
  amostraMax = 30,
): DerivacaoResultado | null {
  const ds = acharDataset(reg, datasetId);
  if (!ds) return null;
  const nomes = ds.colunas;
  const base: DerivacaoResultado = {
    id: "", coluna: "", operacao, total: ds.rows.length, calculadas: 0,
    vazias_como_zero: 0, base_zero_na: 0, colunas: nomes, amostra: [],
  };
  const idxA = resolverColuna(ds, colunaA, { tipo: "numerico" });
  if (idxA == null) return { ...base, colunaNaoEncontrada: colunaA };

  // colunaB: outra coluna, senão um número fixo. Dispensada em percentual_do_total.
  const precisaB = operacao !== "percentual_do_total";
  let idxB: number | null = null;
  let constB: number | null = null;
  if (precisaB) {
    idxB = colunaB != null && colunaB.trim() ? resolverColuna(ds, colunaB, { tipo: "numerico" }) : null;
    if (idxB == null) {
      const c = colunaB != null ? parseNumBR(colunaB) : null;
      if (c == null) return { ...base, colunaNaoEncontrada: colunaB ?? "(coluna_b)" };
      constB = c;
    }
  }

  const asRow = (r: DatasetRow) => nomes.map((_c, i) => celula(r["c" + i]));
  const linhasOrig = ds.rows.map(asRow);

  // percentual_do_total: soma da coluna A sobre 100% (vazio→0), usada como base.
  let totalA = 0;
  if (operacao === "percentual_do_total") for (const row of linhasOrig) totalA += parseNumBR(row[idxA] ?? "") ?? 0;

  let vazias = 0, calculadas = 0, baseZeroNa = 0;
  const novasLinhas: string[][] = [];
  for (const row of linhasOrig) {
    const aRaw = parseNumBR(row[idxA] ?? "");
    let bRaw: number | null;
    if (operacao === "percentual_do_total") bRaw = totalA;
    else if (constB != null) bRaw = constB;
    else bRaw = parseNumBR(row[idxB!] ?? "");
    // Política do usuário: operando vazio/não-numérico → 0 (contado e reportado).
    // Só conta operandos LIDOS DE CÉLULA (constante e total não contam).
    const aSubstituido = aRaw == null;
    const bSubstituido = precisaB && constB == null && bRaw == null;
    if (aSubstituido || bSubstituido) vazias++;
    const a = aRaw ?? 0;
    const b = bRaw ?? 0;
    let v: number | null;
    switch (operacao) {
      case "subtracao": v = a - b; break;
      case "soma": v = a + b; break;
      case "multiplicacao": v = a * b; break;
      case "divisao": v = b === 0 ? null : a / b; break;
      case "variacao_percentual": v = b === 0 ? null : ((a - b) / b) * 100; break;
      case "percentual": v = b === 0 ? null : (a / b) * 100; break;
      case "percentual_do_total": v = totalA === 0 ? null : (a / totalA) * 100; break;
      default: v = null;
    }
    if (v == null || !Number.isFinite(v)) { baseZeroNa++; novasLinhas.push([...row, ""]); }
    else { calculadas++; novasLinhas.push([...row, numeroCanonico(v)]); }
  }

  // Nome único (resolverColuna faz match fuzzy → evita colidir com coluna existente).
  const rotuloB = precisaB ? (idxB != null ? nomes[idxB] ?? String(colunaB) : String(colunaB)) : "";
  let nome = ((nomeColuna && nomeColuna.trim()) || nomePadraoDerivada(operacao, nomes[idxA] ?? colunaA, rotuloB)).slice(0, 80);
  if (nomes.some((c) => norm(c) === norm(nome))) nome = `${nome} (calc)`;

  const { id } = registrarTabelaTela(reg, [...nomes, nome], novasLinhas);
  // Amostra: derivada arredondada p/ exibição (o dataset guarda precisão total).
  const amostra = novasLinhas.slice(0, amostraMax).map((r) => {
    const derivada = r[r.length - 1] ?? "";
    return [...r.slice(0, -1), derivada === "" ? "N/A" : exibir2(parseNumBR(derivada) ?? NaN)];
  });
  return { id, coluna: nome, operacao, total: ds.rows.length, calculadas, vazias_como_zero: vazias, base_zero_na: baseZeroNa, colunas: [...nomes, nome], amostra };
}

/* ────────────────────────────────────────────────────────────────────────────
 * CLASSIFICAÇÃO POR FAIXA (rótulo de risco/faixa por linha, sobre 100%).
 * Ex.: variação % < −20 = "queda forte"; −20..0 = "queda leve"; ≥ 0 = "alta".
 * Determinístico. Faixa = [min, max) (min inclusivo, max exclusivo); null = aberto.
 * Célula vazia/não-numérica → bucket próprio "(sem valor)" (NUNCA some numa faixa).
 * ──────────────────────────────────────────────────────────────────────────── */

export type Faixa = { rotulo: string; min?: number | null; max?: number | null };
export type ClassificacaoResultado = {
  id: string;
  coluna: string;            // nome da coluna de rótulo criada
  total: number;
  distribuicao: { rotulo: string; linhas: number }[];
  sem_valor: number;         // células vazias/não-numéricas (bucket à parte)
  colunas: string[];
  amostra: string[][];
  colunaNaoEncontrada?: string;
};

const ROTULO_SEM_VALOR = "(sem valor)";
const ROTULO_FORA = "(fora das faixas)";

export function classificarColuna(
  reg: DatasetRegistry,
  datasetId: string,
  coluna: string,
  faixas: Faixa[],
  nomeColuna?: string,
  amostraMax = 30,
): ClassificacaoResultado | null {
  const ds = acharDataset(reg, datasetId);
  if (!ds) return null;
  const nomes = ds.colunas;
  const idx = resolverColuna(ds, coluna, { tipo: "numerico" });
  const base: ClassificacaoResultado = { id: "", coluna: "", total: ds.rows.length, distribuicao: [], sem_valor: 0, colunas: nomes, amostra: [] };
  if (idx == null) return { ...base, colunaNaoEncontrada: coluna };

  const asRow = (r: DatasetRow) => nomes.map((_c, i) => celula(r["c" + i]));
  const cont = new Map<string, number>();
  let semValor = 0;
  const novasLinhas: string[][] = ds.rows.map(asRow).map((row) => {
    const v = parseNumBR(row[idx] ?? "");
    let rot: string;
    if (v == null) { rot = ROTULO_SEM_VALOR; semValor++; }
    else {
      const f = faixas.find((fx) => (fx.min == null || v >= fx.min) && (fx.max == null || v < fx.max));
      rot = f ? f.rotulo : ROTULO_FORA;
    }
    cont.set(rot, (cont.get(rot) ?? 0) + 1);
    return [...row, rot];
  });

  let nome = (nomeColuna && nomeColuna.trim() ? nomeColuna : `Faixa (${nomes[idx]})`).slice(0, 80);
  if (nomes.some((c) => norm(c) === norm(nome))) nome = `${nome} (cl)`;
  const { id } = registrarTabelaTela(reg, [...nomes, nome], novasLinhas);

  // Distribuição na ORDEM das faixas + extras (fora/sem valor) ao fim — transparente.
  const distribuicao: { rotulo: string; linhas: number }[] = [];
  const vistos = new Set<string>();
  for (const fx of faixas) { if (!vistos.has(fx.rotulo)) { vistos.add(fx.rotulo); distribuicao.push({ rotulo: fx.rotulo, linhas: cont.get(fx.rotulo) ?? 0 }); } }
  for (const extra of [ROTULO_FORA, ROTULO_SEM_VALOR]) if (cont.get(extra)) distribuicao.push({ rotulo: extra, linhas: cont.get(extra)! });

  const amostra = novasLinhas.slice(0, amostraMax);
  return { id, coluna: nome, total: ds.rows.length, distribuicao, sem_valor: semValor, colunas: [...nomes, nome], amostra };
}

/* ────────────────────────────────────────────────────────────────────────────
 * PROJEÇÃO por registro a partir de uma SÉRIE de colunas mensais.
 *  - 2 meses (decisão do usuário): calcula COMPOSTA e LINEAR lado a lado.
 *  - 3+ meses: REGRESSÃO linear (mínimos quadrados) + R² por registro.
 * Determinística, com PREMISSAS explícitas. Integridade: série INCOMPLETA (algum
 * mês faltante) → linha NÃO projetada (N/A) e reportada — não se inventa ponto,
 * pois um valor fabricado numa tendência é justamente o erro que custa caro.
 * ──────────────────────────────────────────────────────────────────────────── */

export type MetodoProjecao = "auto" | "ambos" | "composta" | "linear" | "regressao";
export type ProjecaoResultado = {
  id: string;
  metodo: Exclude<MetodoProjecao, "auto">; // método EFETIVO aplicado
  horizonte: number;
  total: number;
  projetadas: number;             // linhas com ao menos uma projeção numérica
  serie_incompleta: number;       // linhas com mês faltante → não projetadas
  base_invalida_composta: number; // base ≤ 0 → composta N/A na linha
  premissas: string[];
  colunas_projetadas: string[];
  colunas: string[];
  amostra: string[][];
  colunaNaoEncontrada?: string;
  erro?: string;
};

/** Regressão linear por mínimos quadrados sobre y[i] em x=i. Retorna coef. + R². */
function regressaoLinear(ys: number[]): { m: number; b: number; r2: number } {
  const n = ys.length;
  const mx = (n - 1) / 2;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = i - mx, dy = ys[i]! - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const m = sxx === 0 ? 0 : sxy / sxx;
  const b = my - m * mx;
  let ssres = 0;
  for (let i = 0; i < n; i++) { const yhat = m * i + b; ssres += (ys[i]! - yhat) ** 2; }
  const r2 = syy === 0 ? 1 : 1 - ssres / syy; // série constante → ajuste perfeito
  return { m, b, r2 };
}

export function projetarSerie(
  reg: DatasetRegistry,
  datasetId: string,
  colunasSerie: string[],
  horizonte = 6,
  metodo: MetodoProjecao = "auto",
  amostraMax = 30,
): ProjecaoResultado | null {
  const ds = acharDataset(reg, datasetId);
  if (!ds) return null;
  const nomes = ds.colunas;
  const h = Math.min(Math.max(1, Math.floor(horizonte)), 24);
  const base: ProjecaoResultado = {
    id: "", metodo: "linear", horizonte: h, total: ds.rows.length, projetadas: 0,
    serie_incompleta: 0, base_invalida_composta: 0, premissas: [], colunas_projetadas: [], colunas: nomes, amostra: [],
  };
  const serie = colunasSerie.map((c) => c);
  if (serie.length < 2) return { ...base, erro: "A projeção precisa de ao menos 2 colunas de meses (a série histórica)." };
  const idxs = serie.map((c) => resolverColuna(ds, c, { tipo: "numerico" }));
  const faltaI = idxs.findIndex((i) => i == null);
  if (faltaI >= 0) return { ...base, colunaNaoEncontrada: serie[faltaI] };
  const idxSerie = idxs as number[];
  const k = idxSerie.length;

  // Método EFETIVO: auto = regressão (3+ meses) senão "ambos" (2 meses).
  const efetivo: Exclude<MetodoProjecao, "auto"> = metodo === "auto" ? (k >= 3 ? "regressao" : "ambos") : metodo;
  const fazComp = efetivo === "composta" || efetivo === "ambos";
  const fazLin = efetivo === "linear" || efetivo === "ambos";
  const fazReg = efetivo === "regressao";

  // Cabeçalhos das colunas projetadas.
  const colsComp = fazComp ? Array.from({ length: h }, (_, n) => `Proj +${n + 1} (comp.)`) : [];
  const colsLin = fazLin ? Array.from({ length: h }, (_, n) => `Proj +${n + 1} (linear)`) : [];
  const colsReg = fazReg ? Array.from({ length: h }, (_, n) => `Proj +${n + 1} (regr.)`) : [];
  const colsProj = [...colsComp, ...colsLin, ...colsReg, ...(fazReg ? ["R²"] : [])];

  const asRow = (r: DatasetRow) => nomes.map((_c, i) => celula(r["c" + i]));
  let projetadas = 0, incompleta = 0, baseInvalida = 0;
  const novasLinhas: string[][] = ds.rows.map(asRow).map((row) => {
    const ys = idxSerie.map((i) => parseNumBR(row[i] ?? ""));
    if (ys.some((y) => y == null)) { incompleta++; return [...row, ...colsProj.map(() => "")]; }
    const s = ys as number[];
    const ult = s[k - 1]!, prim = s[0]!;
    const vals: string[] = [];
    let algum = false;

    if (fazComp) {
      // CAGR sobre a série; exige base > 0 (ratio). Base ≤ 0 → N/A na linha.
      if (prim > 0 && ult > 0) {
        const cagr = Math.pow(ult / prim, 1 / (k - 1)) - 1;
        for (let n = 1; n <= h; n++) { const v = ult * Math.pow(1 + cagr, n); vals.push(Number.isFinite(v) ? numeroCanonico(v) : ""); if (Number.isFinite(v)) algum = true; }
      } else { baseInvalida++; for (let n = 0; n < h; n++) vals.push(""); }
    }
    if (fazLin) {
      const passo = (ult - prim) / (k - 1);
      for (let n = 1; n <= h; n++) { const v = ult + passo * n; vals.push(Number.isFinite(v) ? numeroCanonico(v) : ""); if (Number.isFinite(v)) algum = true; }
    }
    if (fazReg) {
      const { m, b, r2 } = regressaoLinear(s);
      for (let n = 1; n <= h; n++) { const v = m * (k - 1 + n) + b; vals.push(Number.isFinite(v) ? numeroCanonico(v) : ""); if (Number.isFinite(v)) algum = true; }
      vals.push(numeroCanonico(r2));
    }
    if (algum) projetadas++;
    return [...row, ...vals];
  });

  const { id } = registrarTabelaTela(reg, [...nomes, ...colsProj], novasLinhas);

  const premissas: string[] = [];
  if (fazComp) premissas.push("Composta: aplica a variação média (CAGR) da série a cada mês — premissa de crescimento proporcional constante; não considera sazonalidade; base ≤ 0 vira N/A.");
  if (fazLin) premissas.push("Linear: soma o passo médio absoluto da série a cada mês — premissa de variação constante em reais; pode ficar negativo.");
  if (fazReg) premissas.push(`Regressão linear (mínimos quadrados) sobre ${k} meses; R² por registro indica a qualidade do ajuste (1 = perfeito). Premissa de tendência linear.`);
  if (k === 2) premissas.push("ATENÇÃO: só 2 meses de histórico — projeção é extrapolação de 2 pontos, frágil por natureza. Trate como cenário, não como certeza.");

  // Amostra: projeções arredondadas p/ exibição (dataset guarda precisão total).
  const amostra = novasLinhas.slice(0, amostraMax).map((r) => {
    const orig = r.slice(0, nomes.length);
    const proj = r.slice(nomes.length).map((c) => (c === "" ? "N/A" : exibir2(parseNumBR(c) ?? NaN)));
    return [...orig, ...proj];
  });

  return { id, metodo: efetivo, horizonte: h, total: ds.rows.length, projetadas, serie_incompleta: incompleta, base_invalida_composta: baseInvalida, premissas, colunas_projetadas: colsProj, colunas: [...nomes, ...colsProj], amostra };
}
