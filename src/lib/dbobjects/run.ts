import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { normalizarDbJson, type DbMeta } from "./metadata";
import { construirLinhasDb } from "./ingest";
import { gerarDocObjetoDb } from "./docs";
import { alimentarOntologiaDeColunas } from "@/lib/data-dictionary/ontology-feed";
import { gravarDicionario, enfileirarEnriquecimentoDicionario } from "@/lib/data-dictionary/gravar";
import { enfileirarTraducoesPendentes } from "@/lib/ai/ontology-translate-enqueue";
import { criarNoConteudo } from "@/lib/content/create-node";
import { htmlToBlocks } from "@/lib/blocks/from-html";

type DbClient = SupabaseClient<Database>;

function metaDo(input: unknown): DbMeta | null {
  return normalizarDbJson((input as { meta?: unknown } | null)?.meta);
}

/** Ingestão de objetos de banco → data_dictionary + ontologia. */
export async function runDbIngest(supabase: DbClient, jobId: string): Promise<{ objetos: number; colunas: number; termos: number }> {
  const vazio = { objetos: 0, colunas: 0, termos: 0 };
  const { data: job } = await supabase.from("data_dictionary_jobs").select("space_id, input").eq("id", jobId).single();
  if (!job) return vazio;
  const spaceId = job.space_id;
  const meta = metaDo(job.input);
  if (!meta) {
    await supabase.from("data_dictionary_jobs").update({ status: "error", error: "Metadado de banco inválido." }).eq("id", jobId);
    return vazio;
  }
  await supabase.from("data_dictionary_jobs").update({ status: "running", total: 2, done: 0, progress: 0 }).eq("id", jobId);
  const linhas = construirLinhasDb(spaceId, meta);
  await supabase.from("data_dictionary").delete().eq("space_id", spaceId).eq("source", "db_ddl");
  const grav = await gravarDicionario(supabase, linhas);
  if (grav.erro) {
    await supabase
      .from("data_dictionary_jobs")
      .update({ status: "error", progress: 100, result: { ...grav }, error: grav.erro })
      .eq("id", jobId);
    return { objetos: 0, colunas: 0, termos: 0 };
  }
  await supabase.from("data_dictionary_jobs").update({ done: 1, progress: 50 }).eq("id", jobId);
  const termos = await alimentarOntologiaDeColunas(supabase, spaceId, linhas);
  await enfileirarEnriquecimentoDicionario(supabase, spaceId, null);
  try {
    await enfileirarTraducoesPendentes(supabase, spaceId, null);
  } catch {
    /* best-effort */
  }
  const objetos = linhas.filter((l) => l.kind !== "column").length;
  const colunas = linhas.filter((l) => l.kind === "column").length;
  await supabase.from("data_dictionary_jobs").update({ status: "done", progress: 100, found: termos, result: { objetos, colunas, termos } }).eq("id", jobId);
  return { objetos, colunas, termos };
}

const PASTA_KIND: Record<string, string> = { table: "Tabelas", view: "Views", trigger: "Triggers", procedure: "Procedures", function: "Functions", package: "Packages" };

/** Documentação técnica dos objetos de banco → artigos na base. */
export async function runDbDocs(supabase: DbClient, jobId: string): Promise<{ objetos: number; artigos: number }> {
  const vazio = { objetos: 0, artigos: 0 };
  const { data: job } = await supabase.from("data_dictionary_jobs").select("space_id, input").eq("id", jobId).single();
  if (!job) return vazio;
  const spaceId = job.space_id;
  const meta = metaDo(job.input);
  if (!meta) {
    await supabase.from("data_dictionary_jobs").update({ status: "error", error: "Metadado de banco inválido." }).eq("id", jobId);
    return vazio;
  }
  const objs: { kind: string; name: string }[] = [
    ...meta.tables.map((t) => ({ kind: "table", name: t.name })),
    ...meta.views.map((v) => ({ kind: "view", name: v.name })),
    ...meta.code.map((c) => ({ kind: c.kind, name: c.name })),
  ];
  const total = objs.length || 1;
  await supabase.from("data_dictionary_jobs").update({ status: "running", total, done: 0, progress: 0 }).eq("id", jobId);

  const raiz = await criarNoConteudo(supabase, { spaceId, parentId: null, type: "folder", title: "Documentação técnica do banco" });
  const pastas = new Map<string, string | null>();
  const pastaDe = async (kind: string): Promise<string | null> => {
    const nome = PASTA_KIND[kind] ?? "Outros";
    if (!pastas.has(nome)) pastas.set(nome, await criarNoConteudo(supabase, { spaceId, parentId: raiz, type: "folder", title: nome }));
    return pastas.get(nome) ?? raiz;
  };

  let done = 0;
  let artigos = 0;
  for (const ob of objs) {
    const html = await gerarDocObjetoDb(meta, ob.kind, ob.name);
    if (html) {
      const parent = await pastaDe(ob.kind);
      const id = await criarNoConteudo(supabase, { spaceId, parentId: parent, type: "article", title: ob.name, blocks: htmlToBlocks(html) });
      if (id) artigos += 1;
    }
    done += 1;
    await supabase.from("data_dictionary_jobs").update({ done, progress: Math.round((done / total) * 100) }).eq("id", jobId);
  }
  await supabase.from("data_dictionary_jobs").update({ status: "done", progress: 100, found: artigos, result: { objetos: done, artigos } }).eq("id", jobId);
  return { objetos: done, artigos };
}
