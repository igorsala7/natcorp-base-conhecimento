import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { normalizarApexJson } from "./metadata";
import { gerarDocsPagina } from "./docs";
import { criarNoConteudo } from "@/lib/content/create-node";
import { htmlToBlocks } from "@/lib/blocks/from-html";
import { carregarMetaApex } from "./carregar-meta";

type DbClient = SupabaseClient<Database>;

/**
 * Job de DOCUMENTAÇÃO da app APEX: para cada página com conteúdo, gera dois artigos (guia
 * do usuário + doc técnica) e os cria na base de conhecimento sob uma pasta da aplicação.
 * O metadado vem de `job.input` — inline (`meta`) ou do Storage
 * (`storagePath`), para os JSONs de 20 MB+. Ver `carregarMetaApex`.
 */
export async function runApexDocs(supabase: DbClient, jobId: string): Promise<{ paginas: number; artigos: number }> {
  const vazio = { paginas: 0, artigos: 0 };
  const { data: job } = await supabase.from("data_dictionary_jobs").select("space_id, input").eq("id", jobId).single();
  if (!job) return vazio;
  const spaceId = job.space_id;
  const meta = await carregarMetaApex(supabase, job.input);
  if (!meta) {
    await supabase.from("data_dictionary_jobs").update({ status: "error", error: "Metadado APEX inválido." }).eq("id", jobId);
    return vazio;
  }

  // Só páginas com conteúdo real (têm região ou itens).
  const paginas = meta.pages.filter((p) => meta.regions.some((r) => r.pageId === p.id) || meta.items.some((i) => i.pageId === p.id));
  const total = paginas.length || 1;
  await supabase.from("data_dictionary_jobs").update({ status: "running", total, done: 0, progress: 0 }).eq("id", jobId);

  const appNome = meta.app.name || meta.app.id || "Aplicação APEX";
  const appFolder = await criarNoConteudo(supabase, { spaceId, parentId: null, type: "folder", title: `Documentação — ${appNome}` });

  let done = 0;
  let artigos = 0;
  for (const p of paginas) {
    const docs = await gerarDocsPagina(meta, p);
    if (docs) {
      const titulo = p.title || p.name || `Página ${p.id}`;
      const pageFolder = await criarNoConteudo(supabase, { spaceId, parentId: appFolder, type: "folder", title: titulo });
      const parent = pageFolder ?? appFolder;
      const u = await criarNoConteudo(supabase, { spaceId, parentId: parent, type: "article", title: `${titulo} — Guia do usuário`, blocks: htmlToBlocks(docs.usuario) });
      const t = await criarNoConteudo(supabase, { spaceId, parentId: parent, type: "article", title: `${titulo} — Documentação técnica`, blocks: htmlToBlocks(docs.tecnico) });
      if (u) artigos += 1;
      if (t) artigos += 1;
    }
    done += 1;
    await supabase.from("data_dictionary_jobs").update({ done, progress: Math.round((done / total) * 100) }).eq("id", jobId);
  }

  await supabase.from("data_dictionary_jobs").update({ status: "done", progress: 100, found: artigos, result: { paginas: done, artigos } }).eq("id", jobId);
  return { paginas: done, artigos };
}
