"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { extractDocument } from "@/lib/importer/extract";
import { extractionToTranscript } from "@/lib/importer/doc-input";
import { normalizeDoc } from "@/lib/blocks/convert";
import { newId, type Block } from "@/lib/blocks/schema";
import { insertAfter } from "@/lib/blocks/tree-ops";
import { saveArticle, improveNodeLayoutAndSave } from "@/app/(admin)/admin/(app)/conteudo/article-actions";
import { createNode } from "@/app/(admin)/admin/(app)/conteudo/actions";
import {
  unidadesDoTranscript,
  unidadesDoArtigo,
  alinhar,
  type Faltante,
  type UnidadeArtigo,
} from "@/lib/importer/validate";

export type ValidateMode = "text" | "images" | "both";

/** Item de texto/imagem faltante (para exibir no modal e para aplicar). */
type LooseDetail =
  | { id: string; kind: "text"; text: string; level: number; nodeId: string; afterBlockId: string | null }
  | { id: string; kind: "image"; url: string; nodeId: string; afterBlockId: string | null };

/** Seção do original sem artigo correspondente (para CRIAR). */
type SectionDetail = { id: string; title: string; blocks: Block[]; qtd: number };

type Detalhado = {
  spaceId: string;
  destinoNodeId: string;
  loose: LooseDetail[];
  sections: SectionDetail[];
  completude: number;
};

// ── Tipos de EXIBIÇÃO (o que o modal recebe) ────────────────────────────────
export type MissingTextItem = { id: string; excerpt: string; heading: boolean };
export type MissingImageItem = { id: string; url: string };
export type MissingSectionItem = { id: string; title: string; qtd: number };
export type ValidateReport =
  | { ok: false; error: string }
  | {
      ok: true;
      complete: boolean;
      completude: number;
      text: MissingTextItem[];
      images: MissingImageItem[];
      sections: MissingSectionItem[];
    };

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim();

function blocoDeTexto(text: string, level: number): Block {
  return level > 0
    ? ({ id: newId(), type: "heading", text: [{ text }], data: { level: Math.min(3, level) } } as Block)
    : ({ id: newId(), type: "paragraph", text: [{ text }] } as Block);
}
function blocoDeImagem(url: string): Block {
  return { id: newId(), type: "image", data: { src: url, alt: "", caption: "" } } as Block;
}

/**
 * Núcleo: re-extrai o original, lê os artigos da subárvore de destino e alinha.
 * Classifica FALTANTES soltos (inserir por âncora) × SEÇÕES (título do original
 * sem artigo — criar). Não persiste nada.
 */
async function computar(
  jobId: string,
): Promise<{ ok: true; det: Detalhado } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("import_jobs")
    .select("space_id, source_file, original_name, mime, result_tree")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: "Importação não encontrada." };
  try {
    await requirePermission("content.edit", job.space_id);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  if (!job.source_file) return { ok: false, error: "Arquivo original indisponível (removido)." };

  const rt = (job.result_tree ?? {}) as { images?: string[]; destinoNodeId?: string };
  const destinoNodeId = rt.destinoNodeId;
  if (!destinoNodeId) return { ok: false, error: "Esta importação não registrou o destino." };

  // 1) Re-extrai o original do Storage.
  const { data: file, error: dErr } = await supabase.storage.from("imports").download(job.source_file);
  if (dErr || !file) return { ok: false, error: "Não foi possível baixar o arquivo original." };
  let transcript: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const extraction = await extractDocument(buf, job.original_name ?? "documento", job.mime ?? "");
    transcript = extractionToTranscript(extraction);
  } catch (e) {
    return { ok: false, error: `Falha ao ler o original: ${e instanceof Error ? e.message : e}` };
  }
  const original = unidadesDoTranscript(transcript, rt.images ?? []);

  // 2) Artigos da subárvore de destino, em ordem de árvore (ltree path).
  const { data: sub } = await supabase.rpc("subtree_ids", { p_node_id: destinoNodeId });
  const articleIds = (sub ?? []).filter((r) => r.type === "article").map((r) => r.id);
  if (!articleIds.length) return { ok: false, error: "O destino não tem artigos para comparar." };
  const { data: nós } = await supabase
    .from("nodes")
    .select("id, title, path")
    .in("id", (sub ?? []).map((r) => r.id))
    .order("path", { ascending: true });
  const titulosExistentes = new Set((nós ?? []).map((n) => norm(n.title)));
  const ordemArtigo = (nós ?? []).filter((n) => articleIds.includes(n.id)).map((n) => n.id);

  const artigoUnits: UnidadeArtigo[] = [];
  for (const nodeId of ordemArtigo) {
    const { data: art } = await supabase
      .from("articles")
      .select("content_json")
      .eq("node_id", nodeId)
      .maybeSingle();
    if (!art) continue;
    artigoUnits.push(...unidadesDoArtigo(nodeId, normalizeDoc(art.content_json).blocks));
  }

  // 3) Alinha e classifica.
  const { faltantes, completude } = alinhar(original, artigoUnits);
  const { loose, sections } = classificar(faltantes, titulosExistentes);
  return { ok: true, det: { spaceId: job.space_id, destinoNodeId, loose, sections, completude } };
}

/**
 * Separa faltantes SOLTOS (inserir no artigo por âncora) de SEÇÕES: um título
 * (nível 1–2) do original que não existe como nó vira uma seção, levando o
 * conteúdo seguinte até o próximo título de nível igual/maior.
 */
function classificar(
  faltantes: Faltante[],
  titulosExistentes: Set<string>,
): { loose: LooseDetail[]; sections: SectionDetail[] } {
  const loose: LooseDetail[] = [];
  const sections: SectionDetail[] = [];
  let i = 0;
  while (i < faltantes.length) {
    const f = faltantes[i]!;
    const ehTituloNovo =
      f.kind === "text" && f.level >= 1 && f.level <= 2 && !titulosExistentes.has(norm(f.text));
    if (ehTituloNovo && f.kind === "text") {
      const nivel = f.level;
      const blocks: Block[] = [];
      let j = i + 1;
      while (j < faltantes.length) {
        const g = faltantes[j]!;
        if (g.kind === "text" && g.level >= 1 && g.level <= nivel) break; // próxima seção
        blocks.push(g.kind === "image" ? blocoDeImagem(g.url) : blocoDeTexto(g.text, g.level));
        j++;
      }
      sections.push({ id: f.id, title: f.text, blocks, qtd: blocks.length });
      i = j;
    } else {
      loose.push(
        f.kind === "image"
          ? { id: f.id, kind: "image", url: f.url, nodeId: f.alvo.nodeId, afterBlockId: f.alvo.afterBlockId }
          : { id: f.id, kind: "text", text: f.text, level: f.level, nodeId: f.alvo.nodeId, afterBlockId: f.alvo.afterBlockId },
      );
      i++;
    }
  }
  return { loose, sections };
}

/** Valida um documento importado e devolve o relatório (guarda o detalhado). */
export async function validateImport(jobId: string, mode: ValidateMode): Promise<ValidateReport> {
  const r = await computar(jobId);
  if (!r.ok) return r;
  const { det } = r;

  // Persiste o detalhado em `import_jobs.extracted` para o "aplicar" não
  // precisar re-extrair (a comparação é cara).
  const supabase = await createClient();
  await supabase.from("import_jobs").update({ extracted: { validation: det } as never }).eq("id", jobId);

  const wantText = mode !== "images";
  const wantImg = mode !== "text";
  const text: MissingTextItem[] = wantText
    ? det.loose
        .filter((l): l is Extract<LooseDetail, { kind: "text" }> => l.kind === "text")
        .map((l) => ({ id: l.id, excerpt: l.text.slice(0, 240), heading: l.level > 0 }))
    : [];
  const images: MissingImageItem[] = wantImg
    ? det.loose
        .filter((l): l is Extract<LooseDetail, { kind: "image" }> => l.kind === "image")
        .map((l) => ({ id: l.id, url: l.url }))
    : [];
  const sections: MissingSectionItem[] = wantText
    ? det.sections.map((s) => ({ id: s.id, title: s.title, qtd: s.qtd }))
    : [];

  const complete = text.length === 0 && images.length === 0 && sections.length === 0;
  return { ok: true, complete, completude: det.completude, text, images, sections };
}

/**
 * Aplica os itens selecionados: insere faltantes por âncora (rascunho nos
 * artigos publicados), cria as seções escolhidas como artigos no destino, e
 * (opcional) melhora o layout dos artigos afetados.
 */
export async function applyValidation(
  jobId: string,
  sel: { ids: string[]; improve: boolean },
): Promise<{ ok: true; inseridos: number; secoesCriadas: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("import_jobs")
    .select("space_id, extracted")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: "Importação não encontrada." };
  try {
    await requirePermission("content.edit", job.space_id);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const det = (job.extracted as { validation?: Detalhado } | null)?.validation;
  if (!det) return { ok: false, error: "Rode a validação novamente." };

  const escolhidos = new Set(sel.ids);
  const afetados = new Set<string>();

  // 1) Faltantes soltos → agrupa por artigo e insere por âncora.
  const looseSel = det.loose.filter((l) => escolhidos.has(l.id));
  const porNo = new Map<string, LooseDetail[]>();
  for (const l of looseSel) {
    const arr = porNo.get(l.nodeId) ?? [];
    arr.push(l);
    porNo.set(l.nodeId, arr);
  }
  let inseridos = 0;
  for (const [nodeId, itens] of porNo) {
    const { data: art } = await supabase
      .from("articles")
      .select("content_json")
      .eq("node_id", nodeId)
      .maybeSingle();
    if (!art) continue;
    let blocks = normalizeDoc(art.content_json).blocks;
    const noInicio: Block[] = [];
    const cursor = new Map<string, string>(); // afterBlockId → último inserido
    for (const it of itens) {
      const bloco = it.kind === "image" ? blocoDeImagem(it.url) : blocoDeTexto(it.text, it.level);
      if (it.afterBlockId == null) {
        noInicio.push(bloco);
      } else {
        const after = cursor.get(it.afterBlockId) ?? it.afterBlockId;
        blocks = insertAfter(blocks, after, bloco);
        cursor.set(it.afterBlockId, bloco.id);
      }
      inseridos += 1;
    }
    if (noInicio.length) blocks = [...noInicio, ...blocks];
    await saveArticle(nodeId, { version: 2, blocks });
    afetados.add(nodeId);
  }

  // 2) Seções escolhidas → cria um artigo no destino com o conteúdo.
  let secoesCriadas = 0;
  for (const s of det.sections) {
    if (!escolhidos.has(s.id)) continue;
    const r = await createNode({ spaceId: det.spaceId, parentId: det.destinoNodeId, type: "article", title: s.title });
    if (!r.ok || !r.id) continue;
    await saveArticle(r.id, { version: 2, blocks: s.blocks.length ? s.blocks : [blocoDeTexto(s.title, 0)] });
    afetados.add(r.id);
    secoesCriadas += 1;
  }

  // 3) Melhorar layout dos artigos afetados (opcional).
  if (sel.improve) {
    for (const nodeId of afetados) await improveNodeLayoutAndSave(nodeId);
  }

  return { ok: true, inseridos, secoesCriadas };
}
