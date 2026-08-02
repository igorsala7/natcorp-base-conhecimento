import "server-only";
import { z } from "zod";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";
import { generateObjectResiliente } from "@/lib/ai/generate";
import { OPERADORES, type Operador, type Filtro, newRegistry, registrarTabelaTela, consultarDataset, expandirTabela } from "./datasets";
import { parseNumBR } from "./num-br";

/**
 * ROTEADOR A/B da análise de relatório (sob demanda, per-turno).
 *
 * - A (computacional): contagem/soma/estatística/agrupamento/filtro/comparação — EXATO
 *   sobre 100% via as query-tools. Barato, síncrono. É o DEFAULT.
 * - B (semântico por linha): LER o texto de cada linha e classificar/julgar (ex.: inferir
 *   "risco de reclamação trabalhista" de um "motivo" em texto livre). Caro → opt-in + job.
 * - A→B: A pré-filtra o universo; B roda só no recorte.
 *
 * Regra de ouro: só cogita B quando há verbo de JULGAMENTO + uma coluna de TEXTO LIVRE.
 * A heurística é grátis; o LLM (finalidade query_rewrite) só entra quando B é plausível.
 * Falha/dúvida → A (o caminho barato nunca trava). NUNCA dispara B sozinho: sempre opt-in.
 */

export type AnaliseModo = "A" | "B" | "A_para_B";
export type AnaliseDecisao = {
  modo: AnaliseModo;
  alvoColuna: string | null; // coluna de texto a classificar (B)
  criterio: string | null;   // o que julgar (ex.: "risco de reclamação trabalhista")
  rotulos: string[];         // rótulos da classificação (≤8)
  preFiltro: Filtro[];       // A→B: recorte antes do B
  confianca: number;         // 0..1
};

const A_PURO: AnaliseDecisao = { modo: "A", alvoColuna: null, criterio: null, rotulos: [], preFiltro: [], confianca: 1 };

// Verbo/intenção de JULGAMENTO semântico (ler conteúdo e concluir), não agregação.
const RX_JULGAMENTO =
  /\b(analis|avali|julg|classif|categoriz|infir|inferir|interpret|identifiq|aponte|detect|sinaliz|risco|indíci|ind[íi]cio|reclama|fraud|irregular|inconsist|sentiment|teor|natureza|motiv)/i;
// Sinais de agregação PURA (mantém em A mesmo com "analise").
const RX_AGREGACAO = /\b(soma|somat|m[ée]dia|mediana|total|quant|percentu|%|compar|[úu]ltim\w* \d+ mes|por (m[êe]s|categoria|status|departamento|centro)|maior|menor|ranking|\btop\b)/i;
const ROTULOS_PADRAO = ["alto", "medio", "baixo", "nao_se_aplica"];

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Perfil leve de uma coluna a partir de uma amostra: fração numérica, comprimento
 *  médio e razão de distintos. Texto livre = pouco numérico, longo e muito variado. */
function perfilColuna(sampleRows: string[][], idx: number): { numericoFrac: number; avgLen: number; distintosRatio: number } {
  let num = 0, preenchidos = 0, somaLen = 0;
  const distintos = new Set<string>();
  for (const r of sampleRows) {
    const v = String(r?.[idx] ?? "").trim();
    if (!v) continue;
    preenchidos++;
    somaLen += v.length;
    distintos.add(norm(v));
    if (parseNumBR(v) != null) num++;
  }
  if (!preenchidos) return { numericoFrac: 0, avgLen: 0, distintosRatio: 0 };
  return { numericoFrac: num / preenchidos, avgLen: somaLen / preenchidos, distintosRatio: distintos.size / preenchidos };
}

/** A coluna `idx` parece TEXTO LIVRE (não numérica, não categórica curta)? */
function ehTextoLivre(p: { numericoFrac: number; avgLen: number; distintosRatio: number }): boolean {
  return p.numericoFrac < 0.3 && p.avgLen >= 18 && p.distintosRatio >= 0.4;
}

/** Decide A / B / A→B. Só chama o LLM quando B é plausível (verbo de julgamento +
 *  coluna de texto livre). Caso contrário devolve A (sem custo). */
export async function classificarAnalise(args: {
  question: string;
  columns: string[];
  sampleRows: string[][];
}): Promise<AnaliseDecisao> {
  const q = (args.question ?? "").trim();
  const cols = (args.columns ?? []).map(String);
  if (q.length < 4 || !cols.length || !args.sampleRows?.length) return A_PURO;

  const temJulgamento = RX_JULGAMENTO.test(q);
  if (!temJulgamento) return A_PURO;

  // Há alguma coluna de texto livre? (candidata a B). Sem isso, é análise A.
  const textuais = cols
    .map((c, i) => ({ c, i, p: perfilColuna(args.sampleRows, i) }))
    .filter((x) => ehTextoLivre(x.p));
  if (!textuais.length) return A_PURO;

  // Puramente agregação (ex.: "compare a soma por mês") mesmo com "analise" → A.
  if (RX_AGREGACAO.test(q) && !/(reclama|risco|fraud|irregular|inconsist|motiv|teor|sentiment)/i.test(q)) {
    return A_PURO;
  }

  if (!(await hasAiKey("query_rewrite"))) {
    // Sem IA p/ confirmar: assume B sobre a coluna textual mais "livre", conservador nos rótulos.
    const alvo = textuais.sort((a, b) => b.p.avgLen - a.p.avgLen)[0]!;
    return { modo: "B", alvoColuna: alvo.c, criterio: q, rotulos: ROTULOS_PADRAO, preFiltro: [], confianca: 0.4 };
  }

  try {
    const dica = cols
      .map((c, i) => `${c} (${ehTextoLivre(perfilColuna(args.sampleRows, i)) ? "texto livre" : perfilColuna(args.sampleRows, i).numericoFrac >= 0.6 ? "numérica" : "categórica"})`)
      .join(" | ");
    const { object } = await generateObjectResiliente({
      model: await languageModel("query_rewrite"),
      abortSignal: aiTimeout("query_rewrite"),
      schema: z.object({
        modo: z.enum(["A", "B", "A_para_B"]),
        alvo_coluna: z.string().nullable(),
        criterio: z.string().nullable(),
        rotulos: z.array(z.string()).max(8).nullable(),
        pre_filtro: z
          .array(z.object({ coluna: z.string(), operador: z.enum(OPERADORES as [Operador, ...Operador[]]), valor: z.string().nullable() }))
          .max(5)
          .nullable(),
      }),
      prompt: `Você roteia a análise de um relatório tabular (RH, pt-BR). Decida o MODO:
- "A": dá para responder com CONTAS sobre colunas (contagem/soma/estatística/agrupar/filtrar/comparar). NÃO precisa ler texto livre.
- "B": exige LER o TEXTO de uma coluna livre e JULGAR/classificar cada linha (ex.: inferir um conceito que NÃO existe como coluna, tipo "risco de reclamação trabalhista" a partir do "motivo").
- "A_para_B": B, mas dá para pré-filtrar antes (ex.: só as linhas de uma categoria) para ler menos linhas.

Se for B/A_para_B: diga "alvo_coluna" (a coluna de texto a ler — use um nome da lista), "criterio" (o que julgar, curto), "rotulos" (2 a 6 classes curtas, ex.: ["alto","medio","baixo","nenhum"]) e, se A_para_B, "pre_filtro" (condições sobre OUTRAS colunas p/ reduzir o universo). Se for A, deixe os demais campos null/[].

COLUNAS (com tipo inferido): ${dica}

PERGUNTA: ${q}`,
    });
    const modo = object.modo;
    if (modo === "A") return A_PURO;
    const alvoColuna = object.alvo_coluna && cols.some((c) => norm(c) === norm(object.alvo_coluna!))
      ? cols.find((c) => norm(c) === norm(object.alvo_coluna!))!
      : (textuais.sort((a, b) => b.p.avgLen - a.p.avgLen)[0]!.c);
    const rotulos = (object.rotulos ?? []).map((r) => String(r).trim()).filter(Boolean).slice(0, 8);
    const preFiltro: Filtro[] = modo === "A_para_B"
      ? (object.pre_filtro ?? []).map((f) => ({ coluna: String(f.coluna), operador: f.operador, valor: f.valor ?? undefined }))
      : [];
    return {
      modo,
      alvoColuna,
      criterio: object.criterio?.trim() || q,
      rotulos: rotulos.length ? rotulos : ROTULOS_PADRAO,
      preFiltro,
      confianca: 0.8,
    };
  } catch {
    return A_PURO; // conservador: qualquer falha → A
  }
}

/** Estimativa (aproximada) do custo do B, mostrada ANTES de rodar. */
export function estimarCustoB(args: { linhas: number; avgCharsAlvo: number; chunkSize?: number }): {
  linhas: number; chamadas: number; tokensEntrada: number; segundos: number;
} {
  const chunk = Math.max(1, args.chunkSize ?? CHUNK_SIZE);
  const chamadas = Math.ceil(args.linhas / chunk);
  const tokensPorChamada = Math.ceil((args.avgCharsAlvo * chunk) / 4) + 400; // alvo + overhead do schema/prompt
  const tokensEntrada = chamadas * tokensPorChamada + 800; // + reduce/síntese
  const CONCORRENCIA = 3, LAT_POR_CHAMADA = 4; // s
  const segundos = Math.ceil((chamadas / CONCORRENCIA) * LAT_POR_CHAMADA) + 3;
  return { linhas: args.linhas, chamadas, tokensEntrada, segundos };
}

/** A→B: aplica o pré-filtro sobre 100% das linhas e devolve o recorte (colunas+linhas).
 *  Reusa `consultarDataset` (exato). Sem filtro → devolve tudo. */
export function filtrarSubconjunto(colunas: string[], linhas: string[][], preFiltro: Filtro[]): { colunas: string[]; linhas: string[][] } {
  if (!preFiltro.length) return { colunas, linhas };
  const reg = newRegistry();
  const { id } = registrarTabelaTela(reg, colunas, linhas);
  const sub = consultarDataset(reg, id, preFiltro);
  if (!sub || sub.colunaNaoEncontrada) return { colunas, linhas };
  const exp = expandirTabela(reg, sub.id, undefined, undefined, 100_000);
  if (!exp) return { colunas, linhas };
  return { colunas: exp.colunas, linhas: exp.linhas };
}

/** Comprimento médio (chars) da coluna-alvo numa amostra — para a estimativa de custo. */
export function avgCharsColuna(colunas: string[], linhas: string[][], alvoColuna: string | null): number {
  if (!alvoColuna) return 60;
  const idx = colunas.findIndex((c) => norm(c) === norm(alvoColuna));
  if (idx < 0) return 60;
  let soma = 0, n = 0;
  for (const r of linhas.slice(0, 200)) { const v = String(r[idx] ?? ""); if (v) { soma += v.length; n++; } }
  return n ? Math.round(soma / n) : 60;
}

/** Tamanho do lote (linhas por chamada de classificação). */
export const CHUNK_SIZE = 40;

/** Schema COMPACTO por chunk (≤8 rótulos → bem abaixo do limite de gramática). */
export function chunkSchema(rotulos: string[]) {
  const rots = (rotulos.length ? rotulos : ROTULOS_PADRAO) as [string, ...string[]];
  return z.object({
    itens: z.array(
      z.object({
        i: z.number().int(),
        rotulo: z.enum(rots),
        confianca: z.enum(["alta", "media", "baixa"]),
        motivo: z.string().max(160).nullable(),
      }),
    ),
  });
}
