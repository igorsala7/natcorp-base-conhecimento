import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type DbClient = SupabaseClient<Database>;

/**
 * Ontologia do RAG: um termo canônico ("Nota Fiscal") reúne as variações que o
 * usuário digita ("NF", "nota", "NF-e"). No momento da busca, a consulta é
 * EXPANDIDA com os termos/sinônimos casados — amplia o braço LÉXICO do
 * `hybrid_search_scoped` (tsvector/trigram) mantendo o vetor na pergunta
 * original. Melhora a precisão sem depender de o usuário acertar o vocabulário.
 */

/** Forma de comparação: minúsculas, sem acento, espaços normalizados. */
export function normalizarTermo(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Termo/alias aparece na pergunta como palavra inteira (não pedaço de outra). */
export function contemTermo(perguntaNorm: string, termoNorm: string): boolean {
  if (termoNorm.length < 2) return false;
  const esc = termoNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(perguntaNorm);
}

/** Uma entrada da ontologia: formas de comparação + formas de superfície. */
/** `nodeId` = nó RESPONSÁVEL pelo termo (artigo/diretório), quando vinculado. */
export type EntradaOntologia = { matchNorms: string[]; forms: string[]; nodeId?: string | null };

/** Entradas da ontologia CASADAS na pergunta (palavra inteira) — PURA. */
export function casarOntologia(query: string, entradas: EntradaOntologia[]): EntradaOntologia[] {
  if (!query.trim() || !entradas.length) return [];
  const q = normalizarTermo(query);
  return entradas.filter((e) => e.matchNorms.some((n) => n && contemTermo(q, n)));
}

/**
 * Formas (termo + sinônimos) dos conceitos CASADOS na pergunta — PURA, coberta
 * por teste. Base tanto da expansão léxica quanto da vetorial e do boost.
 */
export function formasCasadas(query: string, entradas: EntradaOntologia[]): string[] {
  const extras = new Set<string>();
  for (const e of casarOntologia(query, entradas)) {
    for (const f of e.forms) if (f.trim()) extras.add(f.trim());
  }
  return [...extras];
}

/**
 * Expansão LÉXICA PURA — coberta por teste. Devolve a consulta no formato do
 * `websearch_to_tsquery` (`pergunta or "termo" or "sinônimo"`), ou a própria
 * pergunta quando nada casa.
 */
export function expandirComOntologia(query: string, entradas: EntradaOntologia[]): string {
  const extras = formasCasadas(query, entradas);
  if (!extras.length) return query;
  // Aspas tratam multi-palavra como frase e evitam injeção de operador; limite
  // para não montar um tsquery gigante.
  const frases = extras.slice(0, 12).map((f) => `"${f.replace(/"/g, "")}"`);
  return `${query} or ${frases.join(" or ")}`;
}

/**
 * Enriquece a pergunta para o EMBEDDING com as formas casadas da ontologia — a
 * pergunta primeiro (mantém a intenção), depois os sinônimos, um por linha.
 * Assim a busca SEMÂNTICA também acha o conteúdo quando as palavras exatas
 * diferem (antes só a léxica ganhava a expansão). Sem casamento → pergunta crua.
 */
export function enriquecerParaVetor(query: string, entradas: EntradaOntologia[]): string {
  const extras = formasCasadas(query, entradas);
  if (!extras.length) return query;
  return `${query}\n${extras.slice(0, 6).join("\n")}`;
}

/** Cache curto por conjunto de espaços — está no caminho de TODA busca. */
const cache = new Map<string, { at: number; data: EntradaOntologia[] }>();
const TTL_MS = 60_000;

async function carregarOntologia(supabase: DbClient, spaceIds: string[]): Promise<EntradaOntologia[]> {
  const chave = [...spaceIds].sort().join(",");
  const hit = cache.get(chave);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  // HERANÇA: uma documentação-cliente reaproveita a ontologia do espaço-PAI
  // (`parent_space_id`), assim como já reaproveita os embeddings do pai. Sem
  // isto, o chatbot da herdada ficaria sem a ontologia do global.
  const alvos = new Set(spaceIds);
  const { data: espacos } = await supabase
    .from("spaces")
    .select("id, parent_space_id")
    .in("id", spaceIds);
  for (const s of espacos ?? []) if (s.parent_space_id) alvos.add(s.parent_space_id);

  const { data: termos } = await supabase
    .from("ontology_terms")
    .select("id, term, term_norm, node_id")
    .in("space_id", [...alvos]);
  const ids = (termos ?? []).map((t) => t.id);

  // `.in()` em fatias: centenas de UUIDs numa URL só estouram o limite do PostgREST.
  const aliasPorTermo = new Map<string, { alias: string; alias_norm: string }[]>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: aliases } = await supabase
      .from("ontology_aliases")
      .select("term_id, alias, alias_norm")
      .in("term_id", ids.slice(i, i + 200));
    for (const a of aliases ?? []) {
      const lista = aliasPorTermo.get(a.term_id) ?? [];
      lista.push(a);
      aliasPorTermo.set(a.term_id, lista);
    }
  }

  const data: EntradaOntologia[] = (termos ?? []).map((t) => {
    const al = aliasPorTermo.get(t.id) ?? [];
    return {
      matchNorms: [t.term_norm, ...al.map((a) => a.alias_norm)],
      forms: [t.term, ...al.map((a) => a.alias)],
      nodeId: t.node_id ?? null,
    };
  });
  cache.set(chave, { at: Date.now(), data });
  return data;
}

/** Palavras vazias PT — não ajudam a casar termos do domínio. */
const STOP = new Set(
  "a o e de da do das dos em no na nos nas um uma uns umas para por com que se ao aos como qual quais onde quando quanto quantos meu minha como fazer faco quero gostaria preciso tem ter sobre isso esse essa este esta pelo pela ate sem mais menos ja nao sim voce vc".split(
    " ",
  ),
);

/** Palavras significativas (3+ letras, sem stopwords) — PURA. */
export function palavrasSignificativas(s: string): string[] {
  return normalizarTermo(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

/** O termo (norma) tem alguma palavra relacionada às da consulta (substring) — PURA. */
export function termoRelacionado(termNorm: string, palavras: string[]): boolean {
  const ws = termNorm.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  return ws.some((w) => palavras.some((q) => w.includes(q) || q.includes(w)));
}

/**
 * VOCABULÁRIO candidato da documentação para uma consulta — termos canônicos +
 * sinônimos cujas palavras se PARECEM com as da pergunta (casamento fuzzy em
 * memória, reusa o cache de `carregarOntologia`). Diferente do glossário: casa
 * por PEDAÇO de palavra, então surge o termo certo mesmo quando o usuário
 * escreveu coloquial/parcial ("ferias" → "Programação de Férias"). Alimenta a
 * REESCRITA da consulta. `""` se nada aproximar ou em falha.
 */
export async function vocabularioProximo(
  supabase: DbClient,
  spaceIds: string[],
  query: string,
  max = 15,
): Promise<string> {
  const palavras = palavrasSignificativas(query);
  if (!spaceIds.length || !palavras.length) return "";
  try {
    const entradas = await carregarOntologia(supabase, spaceIds);
    const out: string[] = [];
    const vistos = new Set<string>();
    for (const e of entradas) {
      if (out.length >= max) break;
      if (!e.matchNorms.some((n) => termoRelacionado(n, palavras))) continue;
      const canon = e.forms[0]?.trim();
      if (!canon || vistos.has(canon)) continue;
      vistos.add(canon);
      const sins = e.forms.slice(1, 5).map((f) => f.trim()).filter(Boolean);
      out.push(sins.length ? `${canon} (${sins.join(", ")})` : canon);
    }
    return out.join("; ");
  } catch {
    return "";
  }
}

/**
 * GLOSSÁRIO dos termos do domínio CASADOS na consulta — "Nota Fiscal (NF, NF-e);
 * Chamado (ticket)". Serve para a IA de CRIAÇÃO (Estúdio/chat do editor) usar o
 * vocabulário canônico da documentação. `""` se nada casar ou em qualquer falha.
 */
export async function glossarioCasado(
  supabase: DbClient,
  spaceIds: string[],
  query: string,
  max = 12,
): Promise<string> {
  if (!spaceIds.length || !query.trim()) return "";
  try {
    const entradas = await carregarOntologia(supabase, spaceIds);
    const casadas = casarOntologia(query, entradas);
    if (!casadas.length) return "";
    return casadas
      .slice(0, max)
      .map((e) => {
        const [canon, ...sins] = e.forms;
        return sins.length ? `${canon} (${sins.slice(0, 6).join(", ")})` : canon;
      })
      .filter(Boolean)
      .join("; ");
  } catch {
    return "";
  }
}

/**
 * Carrega a ontologia dos espaços e expande a consulta léxica. Degrada para a
 * pergunta original em qualquer falha — a busca nunca pode quebrar por causa da
 * ontologia.
 */
export async function expandirConsultaLexica(
  supabase: DbClient,
  spaceIds: string[],
  query: string,
): Promise<string> {
  if (!spaceIds.length || !query.trim()) return query;
  try {
    const entradas = await carregarOntologia(supabase, spaceIds);
    return expandirComOntologia(query, entradas);
  } catch {
    return query;
  }
}

/**
 * Carrega a ontologia UMA vez e devolve as DUAS consultas expandidas: a `lexica`
 * (tsquery com os sinônimos em OR) e a `vetor` (pergunta enriquecida com os
 * sinônimos, para o embedding). Degrada para a pergunta original em qualquer
 * falha — a busca nunca pode quebrar por causa da ontologia.
 */
export async function expandirConsulta(
  supabase: DbClient,
  spaceIds: string[],
  query: string,
): Promise<{ lexica: string; vetor: string; boost: string | null; responsaveis: string[] }> {
  const vazio = { lexica: query, vetor: query, boost: null, responsaveis: [] as string[] };
  if (!spaceIds.length || !query.trim()) return vazio;
  try {
    const entradas = await carregarOntologia(supabase, spaceIds);
    const casadas = casarOntologia(query, entradas);
    if (!casadas.length) return vazio;
    const formas = [
      ...new Set(casadas.flatMap((e) => e.forms.map((f) => f.trim()).filter(Boolean))),
    ];
    const frases = formas.slice(0, 12).map((f) => `"${f.replace(/"/g, "")}"`);
    const responsaveis = [
      ...new Set(casadas.map((e) => e.nodeId).filter((x): x is string => !!x)),
    ];
    return {
      lexica: `${query} or ${frases.join(" or ")}`,
      vetor: `${query}\n${formas.slice(0, 6).join("\n")}`,
      // tsquery só das formas — o 4º sinal (boost) da fusão no RPC.
      boost: frases.join(" or "),
      responsaveis,
    };
  } catch {
    return vazio;
  }
}
