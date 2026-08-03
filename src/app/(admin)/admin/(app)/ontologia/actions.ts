"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enfileirarTraducoesPendentes } from "@/lib/ai/ontology-translate-enqueue";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { enqueueOntologyScan, enqueueOntologyImport } from "@/lib/jobs/boss";
import { normalizarTermo } from "@/lib/ai/ontology";
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
