import type { SupabaseClient } from "@supabase/supabase-js";
import { mesclarPiso, VOCABULARIO_RH } from "./vocabulario-rh";
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
 * Formas (termo + sinônimos) dos conceitos CASADOS na pergunta, ORDENADAS por
 * relevância — PURA, coberta por teste. Base da expansão léxica, da vetorial e
 * do boost, e todas as três CORTAM (12, 6 e 12). Quem decide o corte é esta
 * ordem, então ela é a decisão, não um detalhe de apresentação.
 *
 * O defeito que isto conserta não era falta de ranking — era pior: as formas
 * saíam achatadas CONCEITO A CONCEITO. Um conceito com 20 sinônimos comia as 12
 * vagas inteiras e o conceito seguinte, que podia ser o relevante, não entrava
 * nenhuma vez. Medido em 20/08/2026: 65 formas casadas truncadas para 12.
 *
 * Duas regras, nesta ordem:
 *
 * 1. CONCEITOS ordenados pelo gatilho mais LONGO que casou na pergunta. Casar
 *    "banco de horas" é um casamento mais específico que casar "horas", e o
 *    conceito por trás dele merece a vaga primeiro. Empate resolvido pelo termo
 *    canônico em ordem alfabética — não por acaso: a ordem que vem do banco não
 *    é estável, e um vetor de busca que muda sozinho entre execuções é um bug
 *    que ninguém consegue reproduzir.
 *
 * 2. RODÍZIO entre eles: primeiro o termo canônico de CADA conceito, depois o
 *    1º sinônimo de cada, e assim por diante. Assim todo conceito casado tem
 *    representação antes de qualquer conceito ganhar o seu quinto sinônimo.
 */
export function formasCasadas(query: string, entradas: EntradaOntologia[]): string[] {
  return ordenarFormas(query, casarOntologia(query, entradas));
}

/** O ranking em si, para quem já pagou o `casarOntologia` (ver `expandirConsulta`). */
function ordenarFormas(query: string, casadas: EntradaOntologia[]): string[] {
  const q = normalizarTermo(query);
  const conceitos = casadas
    .map((e) => ({
      forms: e.forms.map((f) => f.trim()).filter(Boolean),
      peso: Math.max(0, ...e.matchNorms.filter((n) => n && contemTermo(q, n)).map((n) => n.length)),
    }))
    .filter((c) => c.forms.length > 0)
    .sort((a, b) => b.peso - a.peso || (a.forms[0] ?? "").localeCompare(b.forms[0] ?? "", "pt"));

  const out = new Set<string>();
  const maisFormas = Math.max(0, ...conceitos.map((c) => c.forms.length));
  for (let i = 0; i < maisFormas; i++) {
    for (const c of conceitos) if (c.forms[i]) out.add(c.forms[i]!);
  }
  return [...out];
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

/** Idioma canônico da ontologia (as linhas em `ontology_terms`/`aliases`). */
export const IDIOMA_CANONICO = "pt";

/** Normaliza o idioma pedido; `null` = usar só o canônico (PT). */
function idiomaAtivo(lang?: string | null): string | null {
  const l = (lang ?? "").trim().toLowerCase();
  return l && l !== IDIOMA_CANONICO ? l : null;
}

/**
 * Entradas da ontologia de um conjunto de espaços (cacheado). Exportada para quem
 * precisa decidir POR CONCEITO — ex.: o enriquecimento do embedding de ferramenta,
 * que descarta conceito disparado por termo genérico/curto demais.
 */
export async function entradasOntologia(supabase: DbClient, spaceIds: string[], lang?: string | null): Promise<EntradaOntologia[]> {
  return carregarOntologia(supabase, spaceIds, lang);
}

async function carregarOntologia(supabase: DbClient, spaceIds: string[], lang?: string | null): Promise<EntradaOntologia[]> {
  const idioma = idiomaAtivo(lang);
  const chave = [...spaceIds].sort().join(",") + "|" + (idioma ?? IDIOMA_CANONICO);
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
      lista.push({ alias: a.alias, alias_norm: a.alias_norm });
      aliasPorTermo.set(a.term_id, lista);
    }
  }

  // MULTILÍNGUE: no idioma ativo, UNE as formas traduzidas às PT (canônicas) em cada
  // entrada → ponte cross-lingual: o usuário digita na língua dele e a expansão inclui
  // TAMBÉM o termo canônico, achando o conteúdo mesmo que o doc esteja em PT. Os sinônimos
  // traduzidos vêm numa lista jsonb do termo (normalizada aqui na leitura).
  const termTrad = new Map<string, { term: string; term_norm: string; aliases: string[] }>();
  if (idioma && ids.length) {
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase
        .from("ontology_translations")
        .select("term_id, term, term_norm, aliases")
        .eq("lang", idioma)
        .in("term_id", ids.slice(i, i + 200));
      for (const tr of data ?? []) {
        const aliases = Array.isArray(tr.aliases) ? (tr.aliases as unknown[]).map((a) => String(a).trim()).filter(Boolean) : [];
        termTrad.set(tr.term_id, { term: tr.term, term_norm: tr.term_norm, aliases });
      }
    }
  }

  const data: EntradaOntologia[] = (termos ?? []).map((t) => {
    const al = aliasPorTermo.get(t.id) ?? [];
    const matchNorms = [t.term_norm, ...al.map((a) => a.alias_norm)];
    const forms = [t.term, ...al.map((a) => a.alias)];
    if (idioma) {
      const tt = termTrad.get(t.id);
      if (tt) {
        matchNorms.push(tt.term_norm, ...tt.aliases.map((a) => normalizarTermo(a)));
        forms.push(tt.term, ...tt.aliases);
      }
    }
    return {
      matchNorms: [...new Set(matchNorms.filter(Boolean))],
      forms: [...new Set(forms.filter(Boolean))],
      nodeId: t.node_id ?? null,
    };
  });
  // PISO de vocabulário de RH: numa base sem ontologia cadastrada, "holerite" e
  // "espelho de ponto" não casavam com nada. Entra DEPOIS e só onde não conflita —
  // o termo do cliente sempre vence. Como tudo abaixo (glossário, expansão léxica,
  // expansão vetorial, `formasExpandidas`) consome esta lista, herdam de graça.
  const comPiso = mesclarPiso(data, VOCABULARIO_RH, normalizarTermo, (matchNorms, forms) => ({
    matchNorms, forms, nodeId: null,
  }));
  cache.set(chave, { at: Date.now(), data: comPiso });
  return comPiso;
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
  lang?: string | null,
): Promise<string> {
  const palavras = palavrasSignificativas(query);
  if (!spaceIds.length || !palavras.length) return "";
  try {
    const entradas = await carregarOntologia(supabase, spaceIds, lang);
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
  lang?: string | null,
): Promise<string> {
  if (!spaceIds.length || !query.trim()) return "";
  try {
    const entradas = await carregarOntologia(supabase, spaceIds, lang);
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
  lang?: string | null,
): Promise<string> {
  if (!spaceIds.length || !query.trim()) return query;
  try {
    const entradas = await carregarOntologia(supabase, spaceIds, lang);
    return expandirComOntologia(query, entradas);
  } catch {
    return query;
  }
}

/**
 * Formas (termo canônico + sinônimos) dos conceitos da ontologia CASADOS na
 * mensagem. Serve para ASSOCIAR os termos da frase ao vocabulário do espaço —
 * colunas/labels da tela e nomes/descrições das tools — mesmo quando o usuário
 * usa outra palavra. Degrada para [] em qualquer falha (nunca quebra o chat).
 */
export async function formasExpandidas(supabase: DbClient, spaceIds: string[], query: string, lang?: string | null): Promise<string[]> {
  if (!spaceIds.length || !query.trim()) return [];
  try {
    const entradas = await carregarOntologia(supabase, spaceIds, lang);
    return formasCasadas(query, entradas);
  } catch {
    return [];
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
  lang?: string | null,
): Promise<{ lexica: string; vetor: string; boost: string | null; responsaveis: string[] }> {
  const vazio = { lexica: query, vetor: query, boost: null, responsaveis: [] as string[] };
  if (!spaceIds.length || !query.trim()) return vazio;
  try {
    const entradas = await carregarOntologia(supabase, spaceIds, lang);
    const casadas = casarOntologia(query, entradas);
    if (!casadas.length) return vazio;
    // Mesma ordenação de `formasCasadas` — reaproveitando o `casarOntologia`
    // que já foi pago acima, já que `responsaveis` também precisa dele.
    const formas = ordenarFormas(query, casadas);
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

/**
 * Glossário PT→idioma dos termos do espaço (termo canônico + tradução), para dar
 * CONSISTÊNCIA à tradução da UI (XLIFF): a interface e o chatbot usam o mesmo termo.
 * `[]` quando o idioma ainda não tem traduções. Server-side.
 */
export async function glossarioParaTraducao(
  supabase: DbClient,
  spaceId: string,
  lang: string,
): Promise<{ pt: string; alvo: string }[]> {
  const { data: termos } = await supabase.from("ontology_terms").select("id, term").eq("space_id", spaceId);
  const lista = termos ?? [];
  const ids = lista.map((t) => t.id);
  const trad = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("ontology_translations")
      .select("term_id, term")
      .eq("lang", lang)
      .in("term_id", ids.slice(i, i + 200));
    for (const r of data ?? []) trad.set(r.term_id, r.term);
  }
  return lista.filter((t) => trad.has(t.id)).map((t) => ({ pt: t.term, alvo: trad.get(t.id)! }));
}
