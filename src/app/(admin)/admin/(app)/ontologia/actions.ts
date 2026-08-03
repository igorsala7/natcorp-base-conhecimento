"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enfileirarTraducoesPendentes } from "@/lib/ai/ontology-translate-enqueue";
import { criarJobTraducao } from "@/lib/ai/ontology-enqueue";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { enqueueOntologyScan, enqueueOntologyImport, enqueueOntologyTranslate } from "@/lib/jobs/boss";
import { normalizarTermo, glossarioParaTraducao } from "@/lib/ai/ontology";
import { idiomaValido, idiomaNome } from "@/lib/i18n/languages";
import { extrairSourcesXliff, preencherTargetsXliff, buildXliff, linhasParaUnidades } from "@/lib/i18n/xliff";
import { traduzirTextosUI } from "@/lib/ai/ui-translate";
import { extensaoAceita, MAX_UPLOAD_BYTES } from "@/lib/importer/file-guard";

export type OntologyKind = "conceito" | "entidade" | "acao" | "sigla" | "outro";

export type OntologySource = "ia" | "manual" | "upload";
export type OntologyAliasRow = { id: string; alias: string; source: OntologySource };
export type OntologyTermRow = {
  id: string;
  term: string;
  kind: OntologyKind;
  description: string | null;
  source: OntologySource;
  aliases: OntologyAliasRow[];
  /** Nó RESPONSÁVEL (artigo/diretório) forçado no RAG quando o termo é perguntado. */
  nodeId: string | null;
  nodeTitle: string | null;
};

export type OntologyJobRow = {
  id: string;
  space_id: string;
  scope: string;
  target_id: string | null;
  status: string;
  total: number;
  done: number;
  progress: number;
  found: number;
  error: string | null;
  created_at: string;
};

type Ok = { ok: true } | { ok: false; error: string };

/** Termos (com seus aliases) + jobs de varredura de uma documentação. */
export async function listOntology(
  spaceId: string,
): Promise<{ terms: OntologyTermRow[]; jobs: OntologyJobRow[] }> {
  try {
    await requirePermission("content.view", spaceId);
  } catch {
    return { terms: [], jobs: [] };
  }
  const supabase = await createClient();
  const [{ data: termos }, { data: jobs }] = await Promise.all([
    supabase
      .from("ontology_terms")
      .select("id, term, kind, description, source, node_id")
      .eq("space_id", spaceId)
      .order("term", { ascending: true }),
    supabase
      .from("ontology_jobs")
      .select("id, space_id, scope, target_id, status, total, done, progress, found, error, created_at")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const ids = (termos ?? []).map((t) => t.id);
  const aliasPorTermo = new Map<string, OntologyAliasRow[]>();
  // `.in()` em fatias: centenas de UUIDs numa URL só estouram o limite do PostgREST.
  for (let i = 0; i < ids.length; i += 200) {
    const { data: aliases } = await supabase
      .from("ontology_aliases")
      .select("id, term_id, alias, source")
      .in("term_id", ids.slice(i, i + 200))
      .order("alias", { ascending: true });
    for (const a of aliases ?? []) {
      const lista = aliasPorTermo.get(a.term_id) ?? [];
      lista.push({ id: a.id, alias: a.alias, source: a.source as OntologySource });
      aliasPorTermo.set(a.term_id, lista);
    }
  }

  // Título dos nós responsáveis (para exibir no lugar do UUID).
  const nodeIds = [...new Set((termos ?? []).map((t) => t.node_id).filter((x): x is string => !!x))];
  const nodeTitle = new Map<string, string>();
  if (nodeIds.length) {
    const { data: nodesData } = await supabase.from("nodes").select("id, title").in("id", nodeIds);
    for (const n of nodesData ?? []) nodeTitle.set(n.id, n.title);
  }

  const terms: OntologyTermRow[] = (termos ?? []).map((t) => ({
    id: t.id,
    term: t.term,
    kind: t.kind as OntologyKind,
    description: t.description,
    source: t.source as OntologySource,
    aliases: aliasPorTermo.get(t.id) ?? [],
    nodeId: t.node_id ?? null,
    nodeTitle: t.node_id ? nodeTitle.get(t.node_id) ?? null : null,
  }));
  return { terms, jobs: (jobs ?? []) as OntologyJobRow[] };
}

/** Cria ou edita um termo (curadoria manual). */
export async function saveTerm(input: {
  id?: string;
  spaceId: string;
  term: string;
  kind: OntologyKind;
  description: string | null;
  /** Nó responsável (artigo/diretório); undefined = não mexe, null = remove. */
  nodeId?: string | null;
}): Promise<Ok> {
  const { id, spaceId, term, kind, description, nodeId } = input;
  try {
    await requirePermission("ai.configure", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const nome = term.trim();
  if (nome.length < 2) return { ok: false, error: "O termo precisa de ao menos 2 caracteres." };
  const norm = normalizarTermo(nome);
  const supabase = await createClient();
  const responsavel = nodeId === undefined ? {} : { node_id: nodeId };

  if (id) {
    const { error } = await supabase
      .from("ontology_terms")
      .update({ term: nome, term_norm: norm, kind, description: description?.trim() || null, ...responsavel, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("space_id", spaceId);
    if (error) return { ok: false, error: error.message.includes("unique") ? "Já existe um termo igual." : error.message };
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("ontology_terms").insert({
      space_id: spaceId,
      term: nome,
      term_norm: norm,
      kind,
      description: description?.trim() || null,
      ...responsavel,
      source: "manual",
      created_by: user?.id ?? null,
    });
    if (error) return { ok: false, error: error.message.includes("unique") ? "Já existe um termo igual." : error.message };
  }
  await audit({ action: id ? "ontology.term.update" : "ontology.term.create", entityType: "space", entityId: spaceId, spaceId, after: { term: nome } });
  // AUTO-MIGRAÇÃO: enfileira a tradução do espaço para os idiomas habilitados (o job traduz
  // só os termos SEM tradução → o termo novo entra automaticamente). Best-effort: não derruba
  // o salvar. (Editar um termo já traduzido não regenera a tradução — refino futuro.)
  try {
    await enfileirarTraducoesPendentes(createAdminClient(), spaceId, null);
  } catch {
    /* não derruba o salvar */
  }
  revalidatePath("/admin/ontologia");
  return { ok: true };
}

/** Exclui um termo (e seus aliases, em cascade). */
export async function deleteTerm(termId: string): Promise<Ok> {
  const supabase = await createClient();
  const { data: t } = await supabase.from("ontology_terms").select("space_id, term").eq("id", termId).maybeSingle();
  if (!t) return { ok: false, error: "Termo não encontrado." };
  try {
    await requirePermission("ai.configure", t.space_id);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const { error } = await supabase.from("ontology_terms").delete().eq("id", termId);
  if (error) return { ok: false, error: error.message };
  await audit({ action: "ontology.term.delete", entityType: "space", entityId: t.space_id, spaceId: t.space_id, before: { term: t.term } });
  revalidatePath("/admin/ontologia");
  return { ok: true };
}

/** Adiciona um sinônimo a um termo. */
export async function addAlias(termId: string, alias: string): Promise<Ok> {
  const supabase = await createClient();
  const { data: t } = await supabase.from("ontology_terms").select("space_id").eq("id", termId).maybeSingle();
  if (!t) return { ok: false, error: "Termo não encontrado." };
  try {
    await requirePermission("ai.configure", t.space_id);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const nome = alias.trim();
  if (nome.length < 1) return { ok: false, error: "Sinônimo vazio." };
  const { error } = await supabase
    .from("ontology_aliases")
    .upsert({ term_id: termId, alias: nome, alias_norm: normalizarTermo(nome), source: "manual" }, { onConflict: "term_id,alias_norm", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/ontologia");
  return { ok: true };
}

/** Remove um sinônimo. */
export async function deleteAlias(aliasId: string): Promise<Ok> {
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("ontology_aliases")
    .select("term_id, ontology_terms(space_id)")
    .eq("id", aliasId)
    .maybeSingle();
  const spaceId = (a?.ontology_terms as { space_id: string } | null)?.space_id;
  if (!spaceId) return { ok: false, error: "Sinônimo não encontrado." };
  try {
    await requirePermission("ai.configure", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const { error } = await supabase.from("ontology_aliases").delete().eq("id", aliasId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/ontologia");
  return { ok: true };
}

/**
 * Enfileira a varredura por IA. Escopo: sem nó = documentação inteira; pasta =
 * subárvore (o diretório e TODO o conteúdo abaixo); artigo = só ele.
 */
export async function enqueueOntologyScanJob(input: {
  spaceId: string;
  nodeId?: string;
  nodeType?: string;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const { spaceId, nodeId, nodeType } = input;
  try {
    await requirePermission("ai.configure", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const scope = !nodeId ? "space" : nodeType === "folder" ? "subtree" : "article";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: job, error } = await supabase
    .from("ontology_jobs")
    .insert({ space_id: spaceId, scope, target_id: nodeId ?? null, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error || !job) return { ok: false, error: `Falha ao criar o job: ${error?.message}` };

  try {
    await enqueueOntologyScan(job.id);
  } catch {
    await supabase.from("ontology_jobs").update({ status: "error", error: "Fila indisponível" }).eq("id", job.id);
    return { ok: false, error: "Fila indisponível — o worker precisa estar rodando (npm run worker)." };
  }

  await audit({ action: "ontology.scan", entityType: scope === "space" ? "space" : "node", entityId: nodeId ?? spaceId, spaceId, after: { scope } });
  revalidatePath("/admin/ontologia");
  return { ok: true, jobId: job.id };
}

/**
 * Importa TERMOS de um arquivo já subido ao bucket `imports` (lista de palavras):
 * o worker extrai as palavras, gera os sinônimos por IA e cria termos+aliases em
 * massa. Progresso pela mesma lista de jobs (scope 'import').
 */
export async function enqueueOntologyImportJob(input: {
  spaceId: string;
  sourceFile: string;
  originalName: string;
  sizeBytes: number;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const { spaceId, sourceFile, originalName, sizeBytes } = input;
  try {
    await requirePermission("ai.configure", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  if (!extensaoAceita(originalName)) return { ok: false, error: "Tipo de arquivo não permitido." };
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `Arquivo muito grande (máx. ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: job, error } = await supabase
    .from("ontology_jobs")
    .insert({ space_id: spaceId, scope: "import", source_file: sourceFile, original_name: originalName, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error || !job) return { ok: false, error: `Falha ao criar o job: ${error?.message}` };

  try {
    await enqueueOntologyImport(job.id);
  } catch {
    await supabase.from("ontology_jobs").update({ status: "error", error: "Fila indisponível" }).eq("id", job.id);
    return { ok: false, error: "Fila indisponível — o worker precisa estar rodando (npm run worker)." };
  }

  await audit({ action: "ontology.import", entityType: "space", entityId: spaceId, spaceId, after: { original_name: originalName } });
  revalidatePath("/admin/ontologia");
  return { ok: true, jobId: job.id };
}

// ── MULTILÍNGUE (Fase 1c): idiomas habilitados + revisão das traduções ──────────

/** Idiomas ATIVOS do espaço (além do PT canônico). */
export async function listSpaceLanguages(spaceId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("space_languages").select("lang").eq("space_id", spaceId).eq("active", true);
  return (data ?? []).map((r) => r.lang);
}

/** Define EXATAMENTE os idiomas ativos do espaço e enfileira a tradução dos habilitados. */
export async function setSpaceLanguages(spaceId: string, langs: string[]): Promise<Ok> {
  try {
    await requirePermission("ai.configure", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const validos = [...new Set(langs.map((l) => String(l).trim().toLowerCase()).filter((l) => idiomaValido(l) && l !== "pt"))];
  const supabase = await createClient();
  await supabase.from("space_languages").update({ active: false }).eq("space_id", spaceId);
  for (const lang of validos) {
    const { error } = await supabase
      .from("space_languages")
      .upsert({ space_id: spaceId, lang, active: true, label: idiomaNome(lang) }, { onConflict: "space_id,lang" });
    if (error) return { ok: false, error: error.message };
  }
  try {
    await enfileirarTraducoesPendentes(createAdminClient(), spaceId, null);
  } catch {
    /* best-effort */
  }
  revalidatePath("/admin/ontologia");
  return { ok: true };
}

/** Dispara a tradução (um idioma, ou todos os habilitados) — usa o worker. */
export async function traduzirOntologia(spaceId: string, lang?: string): Promise<Ok> {
  try {
    await requirePermission("ai.configure", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const admin = createAdminClient();
  try {
    if (lang) {
      if (!idiomaValido(lang) || lang === "pt") return { ok: false, error: "Idioma inválido." };
      const jobId = await criarJobTraducao(admin, { spaceId, lang, createdBy: null });
      if (jobId) await enqueueOntologyTranslate(jobId);
    } else {
      await enfileirarTraducoesPendentes(admin, spaceId, null);
    }
  } catch {
    return { ok: false, error: "Fila indisponível — o worker precisa estar rodando (npm run worker)." };
  }
  return { ok: true };
}

export type LinhaTraducao = {
  termId: string;
  ptTerm: string;
  ptAliases: string[];
  term: string | null;
  aliases: string[];
  description: string | null;
  reviewed: boolean;
};

/** Termos do espaço com a tradução no idioma (para revisar/editar). */
export async function listTranslations(spaceId: string, lang: string): Promise<LinhaTraducao[]> {
  const supabase = await createClient();
  const { data: termos } = await supabase
    .from("ontology_terms")
    .select("id, term")
    .eq("space_id", spaceId)
    .order("term");
  const lista = termos ?? [];
  const ids = lista.map((t) => t.id);

  const aliasPt = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from("ontology_aliases").select("term_id, alias").in("term_id", ids.slice(i, i + 200));
    for (const a of data ?? []) {
      const l = aliasPt.get(a.term_id) ?? [];
      l.push(a.alias);
      aliasPt.set(a.term_id, l);
    }
  }

  const trad = new Map<string, { term: string; description: string | null; aliases: string[]; reviewed: boolean }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("ontology_translations")
      .select("term_id, term, description, aliases, reviewed")
      .eq("lang", lang)
      .in("term_id", ids.slice(i, i + 200));
    for (const r of data ?? []) {
      const aliases = Array.isArray(r.aliases) ? (r.aliases as unknown[]).map((a) => String(a)) : [];
      trad.set(r.term_id, { term: r.term, description: r.description, aliases, reviewed: r.reviewed });
    }
  }

  return lista.map((t) => {
    const tr = trad.get(t.id);
    return {
      termId: t.id,
      ptTerm: t.term,
      ptAliases: aliasPt.get(t.id) ?? [],
      term: tr?.term ?? null,
      aliases: tr?.aliases ?? [],
      description: tr?.description ?? null,
      reviewed: tr?.reviewed ?? false,
    };
  });
}

/** Salva/edita a tradução de um termo (revisão humana → reviewed=true). */
export async function saveTranslation(input: {
  termId: string;
  lang: string;
  term: string;
  description: string | null;
  aliases: string[];
}): Promise<Ok> {
  const supabase = await createClient();
  const { data: t } = await supabase.from("ontology_terms").select("space_id").eq("id", input.termId).maybeSingle();
  if (!t) return { ok: false, error: "Termo não encontrado." };
  try {
    await requirePermission("ai.configure", t.space_id);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  if (!idiomaValido(input.lang) || input.lang === "pt") return { ok: false, error: "Idioma inválido." };
  const term = input.term.trim();
  if (term.length < 1) return { ok: false, error: "Informe o termo traduzido." };
  const aliases = [...new Set(input.aliases.map((a) => String(a).trim()).filter(Boolean))];
  const { error } = await supabase.from("ontology_translations").upsert(
    {
      term_id: input.termId,
      lang: input.lang,
      term,
      term_norm: normalizarTermo(term),
      description: input.description?.trim() || null,
      aliases,
      source: "manual",
      reviewed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "term_id,lang" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/ontologia");
  return { ok: true };
}

/**
 * Fase 2 — assistente de tradução do APEX: traduz os textos de UI (colados como
 * XLIFF exportado do APEX, ou lista simples 1-por-linha) para `lang`, usando o
 * GLOSSÁRIO da ontologia (consistência com o chatbot). Devolve o XLIFF pronto para
 * REIMPORTAR na tradução nativa do APEX. Síncrono (cap de 300 textos por vez para
 * não estourar o tempo da action; acima disso, divida a entrada).
 */
export async function traduzirXliff(
  spaceId: string,
  lang: string,
  entrada: string,
  modo: "xliff" | "lista",
): Promise<{ ok: true; xliff: string; traduzidos: number; unidades: number } | { ok: false; error: string }> {
  try {
    await requirePermission("ai.configure", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  if (!idiomaValido(lang) || lang === "pt") return { ok: false, error: "Idioma inválido." };
  const txt = (entrada ?? "").trim();
  if (!txt) return { ok: false, error: "Cole o XLIFF do APEX ou a lista de textos." };
  const unidades = modo === "xliff" ? extrairSourcesXliff(txt) : linhasParaUnidades(txt);
  if (!unidades.length) return { ok: false, error: "Nenhum texto encontrado na entrada." };
  const MAX = 300;
  const usar = unidades.slice(0, MAX);
  const supabase = await createClient();
  const glossario = await glossarioParaTraducao(supabase, spaceId, lang);
  const alvo = await traduzirTextosUI(usar, lang, glossario);
  const xliff =
    modo === "xliff"
      ? preencherTargetsXliff(txt, alvo)
      : buildXliff(usar.map((u) => ({ ...u, target: alvo.get(u.id) ?? "" })), "pt-BR", lang);
  return { ok: true, xliff, traduzidos: alvo.size, unidades: unidades.length };
}
