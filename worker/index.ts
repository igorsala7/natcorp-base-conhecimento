/**
 * Worker de ingestão (Fase 4). Processa a fila 'import' do pg-boss:
 * baixa o arquivo → extrai → infere estrutura → grava result_tree e passa o
 * job para status 'preview'. Rode com: npm run worker
 *
 * Precisa das env: SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, e (opcional) AI_API_KEY.
 */
import ws from "ws";
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import { createHash, randomUUID } from "node:crypto";
import PgBoss from "pg-boss";
// @ts-expect-error — o pacote `pg` (transitivo via pg-boss) não traz tipos próprios.
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { parseDbConfig } from "../src/lib/jobs/db-config";
import { performBackup, performRestore, deleteBackupObjects, packBackup, unpackBackup } from "../src/lib/backup/engine";
import { pushToGithub, listGithubBackups, downloadGithubFile } from "../src/lib/backup/github";
import { tryDecryptSecret } from "../src/lib/crypto/secrets";
import { extractDocument } from "../src/lib/importer/extract";
import { processAnalyzeJob } from "../src/lib/analyze/run-job";
import { processSemanticJob } from "../src/lib/analyze/run-semantic-job";
import {
  heuristicTree,
  refineStructureWithLLM,
} from "../src/lib/importer/structure";
import { buildDocInput } from "../src/lib/importer/doc-input";
import { rasterizePdf } from "../src/lib/importer/rasterize";
import { readOutline } from "../src/lib/importer/read-outline";
import { renderOfficeToPdf } from "../src/lib/importer/render-office";
import { readFlowchart } from "../src/lib/importer/read-flowchart";
import { montarArvoreFluxos } from "../src/lib/importer/flow-tree";
import { generateArticle } from "../src/lib/importer/generate-article";
import { hasAiKey, resolveAi } from "../src/lib/ai/config";
import { extrairTermos, sinonimosDeTermos } from "../src/lib/ai/ontology-scan";
import { ehRotuloUtil } from "../src/lib/data-dictionary/rotulo";
import { runTraducaoOntologia } from "../src/lib/ai/ontology-translate-run";
import { enfileirarTraducoesPendentes } from "../src/lib/ai/ontology-translate-enqueue";
import { runApexIngest } from "../src/lib/apex/ingest-run";
import { runApexDocs } from "../src/lib/apex/docs-run";
import { runDbIngest, runDbDocs } from "../src/lib/dbobjects/run";
import { normalizarTermo } from "../src/lib/ai/ontology";
import { mesclarTermos, type TermoAcumulado } from "../src/lib/ai/ontology-merge";
import { criarJobOntologia } from "../src/lib/ai/ontology-enqueue";
import { normalizeDoc } from "../src/lib/blocks/convert";
import { blocksToPlainWithImageMarkers, blocksToText } from "../src/lib/blocks/serialize";
import { publishNodeCore, unpublishNodeCore } from "../src/lib/content/publish-core";
import { reindexNodeChunks } from "../src/lib/content/chunk";
import { scanSpaceQuality } from "../src/lib/quality/scan";
import { processDigests } from "../src/lib/subscriptions/digest";
import { SessaoCaptura } from "../src/lib/capture/browser";
import { planejarCaptura, escreverArtigoEducativo } from "../src/lib/capture/generate";
import { resolverMidias, type MediaRef } from "../src/lib/studio/media";
import type { ProposalNode } from "../src/lib/studio/proposal";
import type { ProposedNode } from "../src/lib/importer/structure";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** `image/svg+xml` viraria a extensão "svg+xml" no split ingênuo do mime. */
const EXT_POR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
};

async function setProgress(
  jobId: string,
  patch: Record<string, unknown>,
  logLine?: string,
) {
  if (Object.keys(patch).length) {
    await supabase.from("import_jobs").update(patch).eq("id", jobId);
  }
  // Append pelo banco (`log || …`) em vez de read-modify-write no worker:
  // duas escritas concorrentes perdiam linhas do log.
  if (logLine) {
    await supabase.rpc("import_job_log_append", { p_job_id: jobId, p_msg: logLine });
  }
}

/** Registra uma linha só no log, sem mexer em status/progresso. */
function logJob(jobId: string, msg: string) {
  return setProgress(jobId, {}, msg);
}

/**
 * Estados a partir dos quais faz sentido processar. Uma re-entrega do pg-boss
 * de um job já em 'preview'/'done' sobrescreveria o result_tree que o usuário
 * talvez já esteja revisando.
 */
const PROCESSAVEIS = new Set(["queued", "extracting", "inferring"]);

async function processJob(jobId: string) {
  const { data: job } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (!job) throw new Error(`Job ${jobId} não encontrado`);

  if (!PROCESSAVEIS.has(job.status)) {
    console.log(`Job ${jobId} está em '${job.status}' — nada a fazer.`);
    return;
  }

  await setProgress(jobId, { status: "extracting", progress: 10 }, "Baixando arquivo");
  const { data: file, error: dlErr } = await supabase.storage
    .from("imports")
    .download(job.source_file);
  if (dlErr || !file) throw new Error(`Falha ao baixar: ${dlErr?.message}`);
  const buf = Buffer.from(await file.arrayBuffer());

  // FLUXOGRAMA: a planilha vira PDF (LibreOffice) e a IA (visão) LÊ aba por aba,
  // redesenhando cada fluxo no bloco `flow` + o passo a passo. Caminho próprio.
  if (job.flow_render) {
    await processFlowchart(jobId, job, buf);
    return;
  }

  await setProgress(jobId, { progress: 30 }, "Extraindo conteúdo");
  const extraction = await extractDocument(
    buf,
    job.original_name ?? job.source_file,
    job.mime ?? undefined,
  );

  // Sobe as imagens extraídas para o bucket de assets → URLs.
  const podadas = extraction.droppedChrome ?? 0;
  const molduraTexto = extraction.droppedChromeText ?? 0;
  await setProgress(
    jobId,
    { progress: 50 },
    `Extraídas ${extraction.images.length} imagens` +
      (podadas ? ` (${podadas} descartadas: repetidas em toda página, tratadas como cabeçalho/rodapé)` : "") +
      (molduraTexto
        ? `. ${molduraTexto} linha(s) de cabeçalho/rodapé/paginação removidas do texto (mobília de impressão)`
        : "") +
      (extraction.imagesCapped
        ? ". ATENÇÃO: o documento tem mais imagens do que o limite por importação — as das últimas páginas ficaram de fora"
        : ""),
  );

  // Deduplicação por checksum: o caminho no Storage É o hash do conteúdo, então
  // o mesmo logo repetido — ou o mesmo arquivo reimportado — sobe uma única vez.
  const porChecksum = new Map<string, string>();
  const imageUrls: string[] = [];
  for (const img of extraction.images) {
    if (img.url) {
      imageUrls.push(img.url); // já é pública; não rehospedamos
      continue;
    }
    const bytes = Buffer.from(img.contentBase64, "base64");
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const cache = porChecksum.get(checksum);
    if (cache !== undefined) {
      imageUrls.push(cache);
      continue;
    }
    const ext = EXT_POR_MIME[img.mime] ?? "png";
    const path = `${job.space_id}/img/${checksum}.${ext}`;
    const { error } = await supabase.storage
      .from("assets")
      .upload(path, bytes, { contentType: img.mime, upsert: true });
    const { data } = supabase.storage.from("assets").getPublicUrl(path);
    const url = error ? "" : data.publicUrl;
    if (error) {
      // Também no log do job: só no console, o usuário via a imagem sumida
      // sem nenhuma explicação na tela.
      console.error(`Falha ao subir imagem ${checksum.slice(0, 8)}: ${error.message}`);
      await logJob(jobId, `Falha ao enviar uma imagem: ${error.message}`);
    }
    porChecksum.set(checksum, url);
    imageUrls.push(url);
  }
  const enviadas = porChecksum.size;
  if (extraction.images.length > 0) {
    await setProgress(
      jobId,
      {},
      `${enviadas} imagens enviadas ao Storage` +
        (extraction.images.length > enviadas
          ? ` (${extraction.images.length - enviadas} reaproveitadas por checksum)`
          : ""),
    );
  }

  await setProgress(jobId, { status: "inferring", progress: 65 }, "Inferindo estrutura");

  let tree = heuristicTree(extraction);
  let usedAi = false;

  // Leitura por IA (Fase A): a IA LÊ o documento (PDF nativo p/ Anthropic/Gemini,
  // páginas rasterizadas p/ OpenAI, texto no fallback) e projeta a árvore. É o
  // caminho PADRÃO sempre que houver IA configurada para "import_structure" (na
  // página Sistema); QUALQUER falha — ou ausência de chave — cai na heurística,
  // então nada regride.
  if (await hasAiKey("import_structure")) {
    const cfg = await resolveAi("import_structure");
    if (cfg) {
      try {
        const docInput = await buildDocInput({
          kind: cfg.kind,
          buf,
          extraction,
          rasterize: rasterizePdf,
        });
        await logJob(jobId, `Leitura pela IA (${docInput.modo})…`);
        // Transparência: OpenAI só "vê" o documento quando as páginas são
        // rasterizadas. Se a rasterização não rolou (ex.: @napi-rs/canvas
        // ausente no ambiente), a IA leu SÓ a transcrição. Avisa em vez de
        // fingir que enxergou as telas.
        if (cfg.kind === "openai" && docInput.modo === "texto" && extraction.source === "pdf") {
          await logJob(
            jobId,
            "OpenAI não recebeu as páginas como imagem (rasterização falhou — verifique @napi-rs/canvas); leu só a transcrição. Alternativa: usar Anthropic ou Gemini em import_structure (PDF nativo, sem rasterizar).",
          );
        }
        const r = await readOutline(docInput, extraction);
        if ("tree" in r && r.tree.length > 0) {
          tree = r.tree;
          usedAi = true;
          await setProgress(jobId, { progress: 85 }, `Estrutura lida pela IA (${docInput.modo})`);
        } else if ("erro" in r) {
          await logJob(jobId, `Leitura por IA não usada: ${r.erro} — segue heurística`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await logJob(jobId, `Leitura por IA falhou: ${msg} — segue heurística`);
      }
    }
  }

  // Sem leitura por IA aplicada: caminho antigo (refino que só reagrupa a lista
  // plana quando o documento chega sem hierarquia própria).
  if (!usedAi && (await hasAiKey("import_structure"))) {
    const { tree: refined, erro } = await refineStructureWithLLM(tree);
    if (refined && refined.length > 0) {
      tree = refined;
      usedAi = true;
    }
    await setProgress(
      jobId,
      { progress: 85 },
      usedAi
        ? "Estrutura agrupada pela IA"
        : `Estrutura vinda do próprio documento${erro ? ` — ${erro}` : ""}`,
    );
  } else if (!usedAi) {
    await setProgress(
      jobId,
      { progress: 85 },
      "Sem IA configurada para Importação — estrutura por heurística",
    );
  }

  // PASSA B (Fase C): a IA gera o CONTEÚDO RICO de cada artigo (todos os blocos
  // do editor). Padrão quando houver IA para "import_layout"; sequencial (rate
  // limit). Falha por artigo não derruba o job — o conteúdo fica em parágrafos fiéis.
  // O layout rico NÃO roda mais automático: a prévia mostra o texto FIEL. A
  // melhora de layout virou OPT-IN ("Melhorar layout" na confirmação, com as
  // preferências) e roda a MESMA IA rica (Fase C / generateArticle) em
  // `processImprove`.
  const usedAiContent = false;

  await setProgress(
    jobId,
    {
      status: "preview",
      progress: 100,
      result_tree: { tree, images: imageUrls, usedAi, usedAiContent },
    },
    "Pronto para revisão",
  );
}

/**
 * FLUXOGRAMA (planilha): converte o xlsx em PDF (LibreOffice), a IA (visão) interpreta
 * cada ABA como um grafo (nós + setas + início/fim) e monta um artigo por fluxo — com
 * o passo a passo e o fluxograma REDESENHADO no bloco `flow`. Termina em 'preview'
 * (mesma tela de revisão do import normal). Qualquer falha sobe e o job vira 'error'.
 */
async function processFlowchart(
  jobId: string,
  job: { original_name: string | null; flow_render: string | null },
  buf: Buffer,
) {
  if (!(await hasAiKey("import_structure"))) {
    throw new Error("Configure uma IA de VISÃO em 'import_structure' (Sistema→IA) para interpretar fluxogramas.");
  }
  await setProgress(jobId, { status: "extracting", progress: 25 }, "Convertendo a planilha em PDF (LibreOffice)…");
  const pdf = await renderOfficeToPdf(buf, job.original_name ?? "planilha.xlsx");

  await setProgress(jobId, { status: "inferring", progress: 55 }, "Lendo os fluxogramas (visão), aba por aba…");
  const extraction = await extractDocument(pdf, "convertido.pdf", "application/pdf");
  const cfg = await resolveAi("import_structure");
  if (!cfg) throw new Error("IA de 'import_structure' indisponível.");
  const docInput = await buildDocInput({
    kind: cfg.kind,
    buf: pdf,
    extraction,
    rasterize: rasterizePdf,
    forceImages: job.flow_render === "image",
  });
  await logJob(jobId, `Leitura pela IA (${docInput.modo}) — modo fluxograma (${job.flow_render}).`);

  const r = await readFlowchart(docInput);
  if ("erro" in r) throw new Error(`Interpretação do fluxo: ${r.erro}`);

  const tituloRaiz = (job.original_name ?? "Fluxos").replace(/\.[^.]+$/, "").trim();
  const tree = montarArvoreFluxos(r.fluxos, tituloRaiz);
  if (!tree.length) throw new Error("Nenhum fluxo aproveitável foi interpretado.");

  await setProgress(
    jobId,
    { status: "preview", progress: 100, result_tree: { tree, images: [], usedAi: true, usedAiContent: true } },
    `Pronto para revisão — ${r.fluxos.length} fluxo(s) interpretado(s)`,
  );
}

/**
 * Fase 'improving': a IA reformata o layout de cada artigo importado
 * (opção marcada na confirmação). Sequencial de propósito — mesmo motivo dos
 * segmentos: rate limit do provedor e progresso legível.
 *
 * Falha em UM artigo não derruba a fase: o artigo fica como veio da extração
 * (a rede de segurança do improveLayout também recusa resultado que perdeu
 * texto) e a linha do log conta o motivo.
 */
async function processImprove(jobId: string, nodeIds: string[]) {
  const { data: job } = await supabase
    .from("import_jobs")
    .select("status, result_tree")
    .eq("id", jobId)
    .single();
  // Re-entrega de um job já concluído não pode reformatar tudo de novo.
  if (job?.status !== "improving") {
    console.log(`Job ${jobId} não está em 'improving' (${job?.status}) — ignorando.`);
    return;
  }
  // Direção do autor (orientações livres + preferências) gravada na materialização —
  // vai ao prompt de cada artigo (generateArticle) para guiar a formatação.
  const direcao = (job.result_tree as { direcaoLayout?: string } | null)?.direcaoLayout || undefined;
  if (direcao) await logJob(jobId, `Aplicando as orientações do autor à formatação.`);

  let ok = 0;
  let mantidos = 0;
  for (const [i, nodeId] of nodeIds.entries()) {
    const rotulo = `${i + 1}/${nodeIds.length}`;
    const { data: node } = await supabase
      .from("nodes")
      .select("title")
      .eq("id", nodeId)
      .maybeSingle();
    const { data: art } = await supabase
      .from("articles")
      .select("id, content_json")
      .eq("node_id", nodeId)
      .maybeSingle();
    if (!art) {
      mantidos++;
      await logJob(jobId, `Layout ${rotulo}: artigo não encontrado — pulado.`);
      continue;
    }

    const { text, images } = blocksToPlainWithImageMarkers(
      normalizeDoc(art.content_json).blocks,
    );
    // MESMO processo rico da leitura por IA (Fase C): reveste em blocos ricos,
    // com rede de fidelidade — se a IA resumir/parafrasear, degrada para
    // parágrafos fiéis (nunca perde conteúdo), e o `aviso` conta o motivo.
    const { doc, aviso } = await generateArticle(text, images, direcao);
    const texto = blocksToText(doc.blocks);
    await supabase
      .from("articles")
      .update({
        content_json: doc,
        content_text: texto,
        excerpt: texto.slice(0, 200),
      })
      .eq("id", art.id);
    if (aviso) {
      mantidos++;
      await logJob(jobId, `Layout ${rotulo}: "${node?.title ?? nodeId}" — ${aviso}`);
    } else {
      ok++;
    }
    await setProgress(jobId, {
      progress: Math.round(((i + 1) / nodeIds.length) * 100),
    });
  }

  await setProgress(
    jobId,
    { status: "done", progress: 100 },
    `Layout melhorado em ${ok} artigo(s)` +
      (mantidos ? `; ${mantidos} mantido(s) como veio.` : "."),
  );
}

/**
 * Geração de embeddings em segundo plano (aba Embeddings → botão Gerar de uma
 * documentação/subárvore/artigo). Regenera os chunks COM embeddings de cada
 * artigo do escopo, atualizando o progresso em `embedding_jobs` (Realtime move
 * a barra na tela). Falha por artigo não derruba o job.
 */
async function processEmbeddings(jobId: string): Promise<void> {
  const { data: job } = await supabase.from("embedding_jobs").select("*").eq("id", jobId).single();
  if (!job) throw new Error(`Job de embeddings ${jobId} não encontrado`);
  if (job.status !== "queued") {
    console.log(`Embeddings job ${jobId} em '${job.status}' — nada a fazer.`);
    return;
  }

  // Resolve os nós-artigo do escopo.
  /**
   * DOCUMENTO DA BASE — arquivo ou página indexada para o chatbot.
   *
   * A varredura sempre leu `articles`, filtrando por `node_id`. Documento subido
   * para o chatbot não tem `node_id`: ele vira `chunks` e nunca passou por
   * ontologia. O resultado era um beco — não adiantava re-subir o arquivo, porque
   * esse caminho nunca gerou ontologia em momento nenhum.
   *
   * O texto já está lá, chunkado no upload. Faltava a varredura olhar para ele.
   */
  /**
   * O DICIONÁRIO DE DADOS — tabelas, colunas e rótulos importados.
   *
   * A ingestão já alimenta a ontologia de forma DETERMINÍSTICA (rótulo vira
   * termo, coluna vira sinônimo). O que faltava era a camada de IA: quem
   * pergunta "quantos funcionários na unidade 3" não escreve "Filial" nem
   * "COD_FILIAL" — escreve "unidade". Esse sinônimo nenhuma regra deriva; ele
   * precisa de quem conheça o domínio.
   *
   * Usa `sinonimosDeTermos`, a mesma da importação por arquivo: recebe os termos
   * PRONTOS e só enriquece, sem inventar termos fora da lista. Uma segunda
   * extração produziria vocabulário com critério diferente, e o mesmo jargão
   * viraria dois termos conforme a porta de entrada.
   *
   * ── O que entra, e o que fica de fora ───────────────────────────────────
   * Só coluna COM RÓTULO, e rótulo que sirva (ver `ehRotuloUtil`): mandar
   * `COD_ALCADA` cru para a IA é pedir que ela adivinhe, e ela adivinha. Sem
   * rótulo, o caminho certo é extraí-lo do comentário (`rotuloDoComentario`),
   * que é determinístico — não gastar token chutando.
   *
   * DISTINTOS por rótulo normalizado: 2.221 colunas com rótulo viram ~1.256
   * termos. Mandar as 2.221 seria pagar duas vezes pela mesma palavra.
   */
  if (job.scope === "dicionario") {
    await supabase.from("ontology_jobs").update({ status: "running", done: 0, progress: 0 }).eq("id", jobId);

    const porTermo = new Map<string, { term: string; aliases: Set<string> }>();
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from("data_dictionary")
        .select("label, db_column, db_table")
        .eq("space_id", job.space_id)
        .eq("kind", "column")
        .not("label", "is", null)
        .range(from, from + 999);
      const lote = data ?? [];
      for (const c of lote) {
        if (!ehRotuloUtil(c.label)) continue;
        const term = String(c.label).trim();
        const norm = normalizarTermo(term);
        if (!norm) continue;
        const e = porTermo.get(norm) ?? { term, aliases: new Set<string>() };
        // A COLUNA como sinônimo já entra aqui: a IA a recebe como pista do que
        // o campo é, e a devolve junto — sem isso ela perderia o único vínculo
        // com o banco que o termo tem.
        if (c.db_column) e.aliases.add(String(c.db_column));
        porTermo.set(norm, e);
      }
      if (lote.length < 1000) break;
    }

    const entradas = [...porTermo.values()].map((e) => ({ term: e.term, aliases: [...e.aliases] }));
    if (entradas.length === 0) {
      await supabase.from("ontology_jobs").update({ status: "done", progress: 100, found: 0 }).eq("id", jobId);
      return;
    }

    const lotes = emLotes(entradas, 60);
    await supabase.from("ontology_jobs").update({ total: lotes.length }).eq("id", jobId);

    const acumulado = new Map<string, TermoAcumulado>();
    let feitos = 0;
    for (const lote of lotes) {
      try {
        for (const t of await sinonimosDeTermos(lote)) {
          const norm = normalizarTermo(t.term);
          if (!norm) continue;
          const ex = acumulado.get(norm) ?? { term: t.term, kind: t.kind, description: t.description, aliases: new Set<string>() };
          if (!ex.description && t.description) ex.description = t.description;
          for (const a of t.aliases) if (normalizarTermo(a) && normalizarTermo(a) !== norm) ex.aliases.add(a);
          acumulado.set(norm, ex);
        }
      } catch (e) {
        // Um lote que falha não pode levar os outros 20 junto: são 60 termos de
        // ~1.250, e perder tudo por causa de um timeout seria desproporcional.
        console.error("Ontologia do dicionário — lote falhou:", e instanceof Error ? e.message : e);
      }
      feitos += 1;
      await supabase.from("ontology_jobs").update({ done: feitos, progress: Math.round((feitos / lotes.length) * 100) }).eq("id", jobId);
    }

    const found = await mesclarTermos(supabase, job.space_id, acumulado, { source: "ia", createdBy: job.created_by });
    await supabase.from("ontology_jobs").update({ status: "done", progress: 100, found }).eq("id", jobId);
    return;
  }

  if (job.scope === "document" && job.target_id) {
    await supabase.from("ontology_jobs").update({ status: "running", done: 0, progress: 0 }).eq("id", jobId);
    const found = await varrerOntologiaDeDocumento(job.space_id, job.target_id, job.created_by, async (done, total) => {
      await supabase
        .from("ontology_jobs")
        .update({ total, done, progress: total ? Math.round((done / total) * 100) : 100 })
        .eq("id", jobId);
    });
    await supabase.from("ontology_jobs").update({ status: "done", progress: 100, found }).eq("id", jobId);
    return;
  }

  let nodeIds: string[] = [];
  if (job.scope === "article" && job.target_id) {
    nodeIds = [job.target_id];
  } else if (job.scope === "subtree" && job.target_id) {
    const { data: sub } = await supabase.rpc("subtree_ids", { p_node_id: job.target_id });
    nodeIds = ((sub ?? []) as { id: string; type: string }[])
      .filter((r) => r.type === "article")
      .map((r) => r.id);
  } else {
    const { data: nodes } = await supabase
      .from("nodes")
      .select("id")
      .eq("space_id", job.space_id)
      .eq("type", "article")
      .is("deleted_at", null);
    nodeIds = (nodes ?? []).map((n) => n.id);
  }

  await supabase
    .from("embedding_jobs")
    .update({ status: "running", total: nodeIds.length, done: 0, progress: nodeIds.length ? 0 : 100 })
    .eq("id", jobId);

  let done = 0;
  for (const nodeId of nodeIds) {
    try {
      const { data: art } = await supabase
        .from("articles")
        .select("id, content_json")
        .eq("node_id", nodeId)
        .maybeSingle();
      if (art) {
        await reindexNodeChunks(supabase, {
          nodeId,
          articleId: art.id,
          spaceId: job.space_id,
          doc: art.content_json,
          withEmbeddings: true,
          embeddedBy: job.created_by,
        });
      }
    } catch (e) {
      console.error(`Embeddings do nó ${nodeId} falhou:`, e instanceof Error ? e.message : e);
    }
    done += 1;
    await supabase
      .from("embedding_jobs")
      .update({ done, progress: Math.round((done / Math.max(1, nodeIds.length)) * 100) })
      .eq("id", jobId);
  }

  await supabase.from("embedding_jobs").update({ status: "done", progress: 100 }).eq("id", jobId);
}

/** Agrupa textos em lotes até ~maxChars por lote (um artigo nunca é partido). */
function agruparPorTamanho(textos: string[], maxChars: number): string[] {
  const lotes: string[] = [];
  let atual = "";
  for (const t of textos) {
    if (atual && atual.length + t.length > maxChars) {
      lotes.push(atual);
      atual = "";
    }
    atual = atual ? `${atual}\n\n---\n\n${t}` : t;
  }
  if (atual) lotes.push(atual);
  return lotes;
}

/**
 * NÚCLEO da ontologia (reutilizado pela varredura E pelo lote): a IA (do Chat)
 * lê o texto dos artigos `nodeIds` (cada um com seu CAMINHO DE PASTAS, para
 * entender o contexto) e sugere termos + sinônimos, gravados com origem 'ia' e
 * MERGE inteligente (termo/sinônimo já existente — como canônico OU alias de
 * outro — NÃO duplica nem conflaciona; só acrescenta o que falta; curadoria
 * manual preservada). Carimba `articles.ontology_at`. `onProgress(done,total)`
 * é chamado por lote. Retorna quantos itens (termos+aliases) foram gravados.
 */
/**
 * O NÚCLEO da varredura: pedaços de texto → termos e sinônimos gravados.
 *
 * Extraído de `varrerOntologia` quando a varredura passou a valer também para
 * documentos da base de conhecimento. As duas precisam usar o MESMO extrator e
 * o MESMO merge: uma segunda implementação produziria vocabulário com critério
 * diferente, e aí o mesmo jargão viraria dois termos conforme a porta de
 * entrada — artigo ou arquivo.
 */
async function gravarTermosVarridos(
  spaceId: string,
  pedacos: string[],
  createdBy: string | null,
  onProgress?: (done: number, total: number) => Promise<void>,
): Promise<number> {
  const lotes = agruparPorTamanho(pedacos, 40_000);
  await onProgress?.(0, lotes.length);

  const acumulado = new Map<
    string,
    { term: string; kind: string; description: string | null; aliases: Set<string> }
  >();
  let done = 0;
  for (const lote of lotes) {
    try {
      const termos = await extrairTermos(lote);
      for (const t of termos) {
        const norm = normalizarTermo(t.term);
        if (!norm) continue;
        const ex = acumulado.get(norm) ?? {
          term: t.term,
          kind: t.kind,
          description: t.description,
          aliases: new Set<string>(),
        };
        if (!ex.description && t.description) ex.description = t.description;
        for (const a of t.aliases) {
          if (normalizarTermo(a) && normalizarTermo(a) !== norm) ex.aliases.add(a);
        }
        acumulado.set(norm, ex);
      }
    } catch (e) {
      console.error(`Ontologia lote falhou:`, e instanceof Error ? e.message : e);
    }
    done += 1;
    await onProgress?.(done, lotes.length);
  }

  // MERGE compartilhado com a importação por arquivo (não duplica termo/alias).
  return mesclarTermos(supabase, spaceId, acumulado, { source: "ia", createdBy });
}

async function varrerOntologia(
  spaceId: string,
  nodeIds: string[],
  createdBy: string | null,
  onProgress?: (done: number, total: number) => Promise<void>,
): Promise<number> {
  const { data: allNodes } = await supabase
    .from("nodes")
    .select("id, parent_id, title, type")
    .eq("space_id", spaceId)
    .is("deleted_at", null);
  const nodeById = new Map((allNodes ?? []).map((n) => [n.id, n]));
  const caminhoPastas = (nodeId: string): string => {
    const partes: string[] = [];
    let cur = nodeById.get(nodeId)?.parent_id ?? null;
    for (let i = 0; cur && i < 50; i++) {
      const p = nodeById.get(cur);
      if (!p) break;
      if (p.type === "folder") partes.unshift(p.title);
      cur = p.parent_id;
    }
    return partes.join(" > ");
  };

  // Texto dos artigos em FATIAS (`.in()` com centenas de UUIDs estoura a URL).
  const arts: { node_id: string | null; content_text: string | null }[] = [];
  for (let i = 0; i < nodeIds.length; i += 200) {
    const { data } = await supabase
      .from("articles")
      .select("node_id, content_text")
      .in("node_id", nodeIds.slice(i, i + 200));
    if (data) arts.push(...data);
  }

  const pedacos = arts
    .map((a) => {
      const titulo = (a.node_id && nodeById.get(a.node_id)?.title) || "";
      const caminho = a.node_id ? caminhoPastas(a.node_id) : "";
      const cabecalho = caminho ? `[${caminho}]\n# ${titulo}` : `# ${titulo}`;
      return `${cabecalho}\n${a.content_text ?? ""}`.trim();
    })
    .filter((t) => t.length > 20);
  const found = await gravarTermosVarridos(spaceId, pedacos, createdBy, onProgress);

  // Carimba os artigos varridos (bolinha de ontologia na árvore).
  const agora = new Date().toISOString();
  for (let i = 0; i < nodeIds.length; i += 200) {
    await supabase.from("articles").update({ ontology_at: agora }).in("node_id", nodeIds.slice(i, i + 200));
  }
  return found;
}

/** Job de varredura de ontologia: resolve o escopo e chama o núcleo. */
async function processOntologyScan(jobId: string): Promise<void> {
  const { data: job } = await supabase.from("ontology_jobs").select("*").eq("id", jobId).single();
  if (!job) throw new Error(`Job de ontologia ${jobId} não encontrado`);
  if (job.status !== "queued") {
    console.log(`Ontologia job ${jobId} em '${job.status}' — nada a fazer.`);
    return;
  }

  let nodeIds: string[] = [];
  if (job.scope === "article" && job.target_id) {
    nodeIds = [job.target_id];
  } else if (job.scope === "subtree" && job.target_id) {
    const { data: sub } = await supabase.rpc("subtree_ids", { p_node_id: job.target_id });
    nodeIds = ((sub ?? []) as { id: string; type: string }[]).filter((r) => r.type === "article").map((r) => r.id);
  } else {
    const { data: arts } = await supabase
      .from("nodes")
      .select("id")
      .eq("space_id", job.space_id)
      .eq("type", "article")
      .is("deleted_at", null);
    nodeIds = (arts ?? []).map((n) => n.id);
  }

  await supabase.from("ontology_jobs").update({ status: "running", done: 0, progress: 0 }).eq("id", jobId);
  const found = await varrerOntologia(job.space_id, nodeIds, job.created_by, async (done, total) => {
    await supabase
      .from("ontology_jobs")
      .update({ total, done, progress: total ? Math.round((done / total) * 100) : 100 })
      .eq("id", jobId);
  });
  await supabase.from("ontology_jobs").update({ status: "done", progress: 100, found }).eq("id", jobId);
}

/**
 * Varre os CHUNKS de um documento da base de conhecimento.
 *
 * Reusa `extrairTermos`, `sinonimosDeTermos` e `mesclarTermos` — os mesmos dos
 * artigos. Uma segunda extração produziria vocabulário com critério diferente,
 * e aí o mesmo jargão viraria dois termos conforme a porta de entrada.
 *
 * O `heading_path` do chunk entra como contexto, igual ao caminho de pastas do
 * artigo: "Férias > Aquisitivo" ajuda o extrator a saber que "aquisitivo" é
 * termo do domínio e não adjetivo solto.
 */
async function varrerOntologiaDeDocumento(
  spaceId: string,
  documentId: string,
  createdBy: string | null,
  onProgress?: (done: number, total: number) => Promise<void>,
): Promise<number> {
  const { data: doc } = await supabase
    .from("knowledge_documents")
    .select("title")
    .eq("id", documentId)
    .maybeSingle();

  const chunks: { content: string; heading_path: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("chunks")
      .select("content, heading_path")
      .eq("document_id", documentId)
      .range(from, from + 999);
    const lote = data ?? [];
    chunks.push(...lote);
    if (lote.length < 1000) break;
  }
  if (chunks.length === 0) return 0;

  const pedacos = chunks
    .map((c) => [doc?.title ?? "", c.heading_path ?? "", c.content ?? ""].filter(Boolean).join("\n"))
    .filter((t) => t.trim().length > 40);

  return gravarTermosVarridos(spaceId, pedacos, createdBy, onProgress);
}

const MAX_TERMOS_IMPORT = 5000;

/** Quebra o texto extraído em entradas {termo, sinônimos dados}. 1 linha = 1
 * termo; separadores (`,;|` ou tab) dividem termo × sinônimos. Pula linha-prosa
 * (curta demais/longa demais) e deduplica pelo termo normalizado. */
function parseEntradasOntologia(texto: string): { term: string; aliases: string[] }[] {
  const entradas: { term: string; aliases: string[] }[] = [];
  const vistos = new Set<string>();
  for (const linha of texto.split(/\r?\n/)) {
    const partes = linha.split(/[;,\t|]/).map((p) => p.trim()).filter(Boolean);
    const term = partes[0];
    if (!term || term.length < 2 || term.length > 120) continue; // ignora prosa/ruído
    const key = normalizarTermo(term);
    if (!key || vistos.has(key)) continue;
    vistos.add(key);
    entradas.push({ term, aliases: partes.slice(1) });
    if (entradas.length >= MAX_TERMOS_IMPORT) break;
  }
  return entradas;
}

function emLotes<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Job de IMPORTAÇÃO por arquivo: extrai palavras, gera sinônimos por IA e cria
 * termos+aliases em massa (mesmo merge da varredura). */
async function processOntologyImport(jobId: string): Promise<void> {
  const { data: job } = await supabase.from("ontology_jobs").select("*").eq("id", jobId).single();
  if (!job) throw new Error(`Job de importação ${jobId} não encontrado`);
  if (job.status !== "queued") {
    console.log(`Importação de ontologia ${jobId} em '${job.status}' — nada a fazer.`);
    return;
  }
  if (!job.source_file) throw new Error("Job de importação sem arquivo de origem.");

  await supabase.from("ontology_jobs").update({ status: "running", done: 0, progress: 0 }).eq("id", jobId);

  const { data: file, error: dlErr } = await supabase.storage.from("imports").download(job.source_file);
  if (dlErr || !file) throw new Error(`Falha ao baixar o arquivo: ${dlErr?.message ?? "vazio"}`);
  const buf = Buffer.from(await file.arrayBuffer());
  const extraction = await extractDocument(buf, job.original_name ?? job.source_file);
  const texto = extraction.blocks.map((b) => b.text).join("\n");

  const entradas = parseEntradasOntologia(texto);
  const lotes = emLotes(entradas, 60);
  await supabase.from("ontology_jobs").update({ total: lotes.length }).eq("id", jobId);

  const acumulado = new Map<string, TermoAcumulado>();
  let done = 0;
  for (const lote of lotes) {
    try {
      for (const t of await sinonimosDeTermos(lote)) {
        const norm = normalizarTermo(t.term);
        if (!norm) continue;
        const ex = acumulado.get(norm) ?? { term: t.term, kind: t.kind, description: t.description, aliases: new Set<string>() };
        if (!ex.description && t.description) ex.description = t.description;
        for (const a of t.aliases) if (normalizarTermo(a) && normalizarTermo(a) !== norm) ex.aliases.add(a);
        acumulado.set(norm, ex);
      }
    } catch (e) {
      console.error(`Importação de ontologia — lote falhou:`, e instanceof Error ? e.message : e);
    }
    done += 1;
    await supabase.from("ontology_jobs").update({ done, progress: Math.round((done / lotes.length) * 100) }).eq("id", jobId);
  }

  const found = await mesclarTermos(supabase, job.space_id, acumulado, { source: "upload", createdBy: job.created_by });
  await supabase.from("ontology_jobs").update({ status: "done", progress: 100, found }).eq("id", jobId);
  await supabase.storage.from("imports").remove([job.source_file]).catch(() => {});
}

/**
 * LOTE em segundo plano da seleção múltipla: publica → embedding → ontologia,
 * NESSA prioridade, UM item de cada vez (não simultâneo). Publicar já gera
 * embedding; a fase de embedding só é útil sem publicar ou para regerar.
 */
async function processBulk(jobId: string): Promise<void> {
  const { data: job } = await supabase.from("bulk_jobs").select("*").eq("id", jobId).single();
  if (!job) throw new Error(`Job de lote ${jobId} não encontrado`);
  if (job.status !== "queued") {
    console.log(`Lote ${jobId} em '${job.status}' — nada a fazer.`);
    return;
  }

  // Seleção → ARTIGOS, em ordem, sem repetir (pasta → subárvore de artigos).
  const artigos: string[] = [];
  const visto = new Set<string>();
  for (const nid of (job.node_ids ?? []) as string[]) {
    const { data: n } = await supabase.from("nodes").select("id, type").eq("id", nid).maybeSingle();
    if (!n) continue;
    if (n.type === "article") {
      if (!visto.has(n.id)) { visto.add(n.id); artigos.push(n.id); }
    } else {
      const { data: sub } = await supabase.rpc("subtree_ids", { p_node_id: nid });
      for (const r of (sub ?? []) as { id: string; type: string }[])
        if (r.type === "article" && !visto.has(r.id)) { visto.add(r.id); artigos.push(r.id); }
    }
  }

  const total =
    (job.do_publish ? artigos.length : 0) +
    (job.do_embedding ? artigos.length : 0) +
    (job.do_ontology ? 1 : 0);
  let done = 0;
  const tick = (phase: string) =>
    supabase
      .from("bulk_jobs")
      .update({ status: "running", phase, total, done, progress: total ? Math.round((done / total) * 100) : 100 })
      .eq("id", jobId);
  await tick("publicar");

  if (job.do_publish) {
    for (const nodeId of artigos) {
      try {
        const r = await publishNodeCore(supabase, nodeId, job.space_id, "Publicação em lote");
        if (!r.ok) console.error(`Lote publicar ${nodeId}:`, r.error);
      } catch (e) {
        console.error(`Lote publicar ${nodeId}:`, e instanceof Error ? e.message : e);
      }
      done += 1;
      await tick("publicar");
    }
  }

  if (job.do_embedding) {
    await tick("embedding");
    for (const nodeId of artigos) {
      try {
        const { data: art } = await supabase.from("articles").select("id, content_json").eq("node_id", nodeId).maybeSingle();
        if (art)
          await reindexNodeChunks(supabase, {
            nodeId,
            articleId: art.id,
            spaceId: job.space_id,
            doc: art.content_json,
            withEmbeddings: true,
            embeddedBy: job.created_by,
          });
      } catch (e) {
        console.error(`Lote embedding ${nodeId}:`, e instanceof Error ? e.message : e);
      }
      done += 1;
      await tick("embedding");
    }
  }

  if (job.do_ontology) {
    await tick("ontologia");
    try {
      await varrerOntologia(job.space_id, artigos, job.created_by);
    } catch (e) {
      console.error(`Lote ontologia:`, e instanceof Error ? e.message : e);
    }
    done += 1;
  }

  await supabase.from("bulk_jobs").update({ status: "done", phase: null, progress: 100, done: total }).eq("id", jobId);
}

/**
 * Publicações agendadas vencidas: executa a MESMA lógica do publicar manual
 * (rascunho → oficial, snapshot, embeddings) e o despublicar com redirect.
 * Roda pelo cron do pg-boss a cada minuto; cada nó falha isolado.
 */
async function processScheduled(boss: PgBoss): Promise<void> {
  const agora = new Date().toISOString();

  const { data: paraPublicar } = await supabase
    .from("nodes")
    .select("id, space_id, title")
    .lte("publish_at", agora)
    .neq("status", "published")
    .is("deleted_at", null)
    .limit(50);
  for (const n of paraPublicar ?? []) {
    try {
      const r = await publishNodeCore(supabase, n.id, n.space_id, "Publicação agendada");
      if (!r.ok) throw new Error(r.error);
      console.log(`Agendado publicado: "${n.title}" (${n.id})`);
      // Mesmo acoplamento do publicar manual: embedding já saiu inline no
      // núcleo; a ontologia vai para a fila (efeito de sistema, não bloqueia).
      try {
        const ontId = await criarJobOntologia(supabase, {
          spaceId: n.space_id,
          scope: "article",
          targetId: n.id,
          createdBy: null,
        });
        if (ontId) await boss.send("ontology-scan", { jobId: ontId });
      } catch (e2) {
        console.error(`Agendado ${n.id}: falha ao enfileirar ontologia:`, e2 instanceof Error ? e2.message : e2);
      }
    } catch (e) {
      // Zera o agendamento mesmo na falha: repetir a cada minuto para sempre
      // só encheria o log — o autor vê o artigo ainda em rascunho e reage.
      await supabase.from("nodes").update({ publish_at: null }).eq("id", n.id);
      console.error(`Agendado FALHOU ao publicar ${n.id}:`, e instanceof Error ? e.message : e);
    }
  }

  const { data: paraDespublicar } = await supabase
    .from("nodes")
    .select("id, space_id, title, unpublish_redirect_to")
    .lte("unpublish_at", agora)
    .eq("status", "published")
    .is("deleted_at", null)
    .limit(50);
  for (const n of paraDespublicar ?? []) {
    try {
      const r = await unpublishNodeCore(supabase, n.id, n.space_id, n.unpublish_redirect_to);
      if (!r.ok) throw new Error(r.error);
      console.log(`Agendado despublicado: "${n.title}" (${n.id})`);
    } catch (e) {
      await supabase.from("nodes").update({ unpublish_at: null }).eq("id", n.id);
      console.error(`Agendado FALHOU ao despublicar ${n.id}:`, e instanceof Error ? e.message : e);
    }
  }
}

// ── Backup / Restauração ──────────────────────────────────────────────────────
async function bkUpdate(jobId: string, patch: Record<string, unknown>) {
  await supabase.from("backup_jobs").update(patch).eq("id", jobId);
}

/** Apaga backups (arquivos + registro) além do prazo de retenção configurado. */
async function pruneBackups() {
  const { data: cfg } = await supabase.from("backup_settings").select("retention_days").eq("id", true).single();
  const days = cfg?.retention_days ?? 30;
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data: velhos } = await supabase
    .from("backup_jobs").select("id, storage_path")
    .in("kind", ["manual", "auto"]).eq("status", "done").lt("created_at", cutoff);
  for (const b of velhos ?? []) {
    if (b.storage_path) await deleteBackupObjects(supabase, b.storage_path).catch(() => {});
    await supabase.from("backup_jobs").delete().eq("id", b.id);
  }
}

async function processBackup(jobId: string) {
  const { data: job } = await supabase.from("backup_jobs").select("*").eq("id", jobId).single();
  if (!job) return;
  await bkUpdate(jobId, { status: "running", progress: 0, phase: "iniciando" });
  const client = new pg.Client(parseDbConfig());
  await client.connect();
  try {
    const res = await performBackup({
      pg: client, supabase, jobId, includeStorage: job.include_storage,
      onProgress: (phase, pct) => bkUpdate(jobId, { phase, progress: pct }),
    });
    await bkUpdate(jobId, {
      status: "done", progress: 100, phase: "concluído", storage_path: res.storagePath,
      bytes: res.bytes, tables_count: res.tablesCount, rows_count: res.rowsCount,
      files_count: res.filesCount, updated_at: new Date().toISOString(),
    });
    await pruneBackups().catch((e) => console.error("Retenção de backups falhou:", e));
  } finally {
    await client.end();
  }
}

async function processRestore(jobId: string) {
  const { data: job } = await supabase.from("backup_jobs").select("*").eq("id", jobId).single();
  if (!job || !job.storage_path) throw new Error("Backup de origem inválido.");
  await bkUpdate(jobId, { status: "running", progress: 0, phase: "restaurando" });
  const client = new pg.Client(parseDbConfig());
  await client.connect();
  try {
    const res = await performRestore({
      pg: client, supabase, sourcePath: job.storage_path,
      onProgress: (phase, pct) => bkUpdate(jobId, { phase, progress: pct }),
    });
    await bkUpdate(jobId, {
      status: "done", progress: 100, phase: "concluído", tables_count: res.tablesCount,
      rows_count: res.rowsCount, files_count: res.filesCount, updated_at: new Date().toISOString(),
    });
  } finally {
    await client.end();
  }
}

/** Desempacota um .zip de backup (upload/GitHub) para a pasta `<jobId>/`. */
async function processBackupImport(jobId: string, incomingPath: string) {
  await bkUpdate(jobId, { status: "running", progress: 10, phase: "importando" });
  const { data } = await supabase.storage.from("backups").download(incomingPath);
  if (!data) throw new Error("Arquivo enviado não encontrado.");
  const bytes = new Uint8Array(await data.arrayBuffer());
  const { manifest } = await unpackBackup(supabase, bytes, jobId);
  await bkUpdate(jobId, {
    status: "done", progress: 100, phase: "concluído", storage_path: jobId,
    tables_count: manifest?.db?.length ?? null, files_count: null,
    include_storage: manifest?.include_storage ?? false, updated_at: new Date().toISOString(),
  });
  await supabase.storage.from("backups").remove([incomingPath]);
}

async function githubConfig() {
  const { data: s } = await supabase.from("backup_settings").select("github_repo, github_branch, github_path").eq("id", true).single();
  const { data: sec } = await supabase.from("backup_secrets").select("github_token_enc").eq("id", true).single();
  const token = tryDecryptSecret(sec?.github_token_enc ?? null);
  if (!s?.github_repo || !token) throw new Error("Configure o repositório e o token do GitHub em Sistema → Backup.");
  return { repo: s.github_repo, branch: s.github_branch || "main", path: s.github_path || "backups", token };
}

async function processGithubSave(jobId: string, sourceBackupId: string) {
  await bkUpdate(jobId, { status: "running", progress: 10, phase: "empacotando" });
  const cfg = await githubConfig();
  const { data: src } = await supabase.from("backup_jobs").select("storage_path, created_at").eq("id", sourceBackupId).single();
  if (!src?.storage_path) throw new Error("Backup de origem inválido.");
  const zip = await packBackup(supabase, src.storage_path);
  const mb = zip.length / 1048576;
  if (mb > 95) throw new Error(`Backup grande demais para o GitHub (${mb.toFixed(0)} MB; limite ~100 MB). Use um backup só do banco, ou o download.`);
  await bkUpdate(jobId, { progress: 50, phase: "enviando ao GitHub", bytes: zip.length });
  const filename = `backup-${String(src.created_at).slice(0, 10)}-${sourceBackupId.slice(0, 8)}.zip`;
  const r = await pushToGithub({ ...cfg, filename, bytes: zip, message: `Backup ${filename}` });
  await bkUpdate(jobId, { status: "done", progress: 100, phase: `GitHub: ${r.path}`, updated_at: new Date().toISOString() });
}

async function processGithubImport(jobId: string, filePath?: string) {
  await bkUpdate(jobId, { status: "running", progress: 10, phase: "baixando do GitHub" });
  const cfg = await githubConfig();
  let fp = filePath;
  if (!fp) {
    const list = await listGithubBackups(cfg);
    if (!list.length) throw new Error("Nenhum backup .zip encontrado no repositório do GitHub.");
    fp = list[0]!.path;
  }
  const bytes = await downloadGithubFile({ token: cfg.token, repo: cfg.repo, branch: cfg.branch, filePath: fp });
  await bkUpdate(jobId, { progress: 60, phase: "desempacotando" });
  const { manifest } = await unpackBackup(supabase, bytes, jobId);
  await bkUpdate(jobId, {
    status: "done", progress: 100, phase: `de ${fp}`, storage_path: jobId,
    tables_count: manifest?.db?.length ?? null, include_storage: manifest?.include_storage ?? false,
    updated_at: new Date().toISOString(),
  });
}

/** Lê `backup_settings` e (re)programa o backup automático no pg-boss. */
async function applyBackupSchedule(boss: PgBoss) {
  const { data: cfg } = await supabase.from("backup_settings").select("*").eq("id", true).single();
  try { await boss.unschedule("backup"); } catch { /* nada agendado ainda */ }
  if (cfg?.auto_enabled) {
    const cron = cfg.frequency === "weekly" ? `0 ${cfg.hour} * * ${cfg.weekday}` : `0 ${cfg.hour} * * *`;
    await boss.schedule("backup", cron, { auto: true });
    console.log(`Backup automático agendado: ${cron}`);
  }
}

// ── Captura de telas (prints) ───────────────────────────────────────────────

type CaptureDestino =
  | { kind: "import"; parentId: string | null; instrucao?: string; importJobId?: string }
  | { kind: "studio"; sessionId: string; targetTmpId: string; instrucao?: string };

const CAPTURE_PROCESSAVEIS = new Set(["queued", "running", "capturing", "writing"]);

/** Atualiza um nó da proposta do Estúdio pelo tmpId (recursivo, imutável). */
function atualizarNoProposta(
  nodes: ProposalNode[],
  tmpId: string,
  fn: (n: ProposalNode) => ProposalNode,
): ProposalNode[] {
  return nodes.map((n) =>
    n.tmpId === tmpId ? fn(n) : { ...n, children: atualizarNoProposta(n.children, tmpId, fn) },
  );
}

/**
 * Abre a URL (login opcional), a IA escolhe os prints, captura, sobe ao bucket
 * `assets` (dedup por checksum) e aterrissa conforme o destino: prévia do
 * Importador (artigo pronto com os prints) ou sessão do Estúdio (prints como
 * mídia + texto como material). Credenciais são apagadas ANTES de abrir o browser.
 */
async function processCapture(jobId: string) {
  const { data: job } = await supabase
    .from("capture_jobs")
    .select("id, space_id, url, mode, status, destino, needs_login, created_by")
    .eq("id", jobId)
    .single();
  if (!job || !CAPTURE_PROCESSAVEIS.has(job.status)) return;

  const destino = (job.destino ?? {}) as CaptureDestino;
  const modo = (job.mode === "interactive" ? "interactive" : "static") as "static" | "interactive";
  const logs: { at: string; msg: string }[] = [];
  const passo = async (patch: Record<string, unknown>, msg?: string) => {
    if (msg) {
      logs.push({ at: new Date().toISOString(), msg });
      console.log(`  captura ${jobId}: ${msg}`);
    }
    await supabase.from("capture_jobs").update({ ...patch, ...(msg ? { log: logs } : {}) }).eq("id", jobId);
  };

  await passo({ status: "running", progress: 5 }, "Abrindo a página");

  // Credenciais efêmeras: lê, APAGA e decifra (delete-after-use, antes do browser).
  let login: { usuario: string; senha: string } | undefined;
  if (job.needs_login) {
    const { data: sec } = await supabase
      .from("capture_secrets")
      .select("usuario_enc, senha_enc")
      .eq("job_id", jobId)
      .maybeSingle();
    await supabase.from("capture_secrets").delete().eq("job_id", jobId);
    const usuario = tryDecryptSecret(sec?.usuario_enc ?? null);
    const senha = tryDecryptSecret(sec?.senha_enc ?? null);
    if (usuario && senha) login = { usuario, senha };
  }

  const sessao = await SessaoCaptura.iniciar({ url: job.url, modo, ...(login ? { login } : {}) });
  try {
    await passo(
      { status: "capturing", progress: 25 },
      `${sessao.inventario.elementos.length} elemento(s); escolhendo os prints`,
    );
    const instrucao = destino.instrucao ?? "";
    const planos = await planejarCaptura(sessao.inventario, instrucao, modo);
    const pngs = await sessao.capturar(planos);
    if (!pngs.length) throw new Error("Nenhum print pôde ser capturado nesta página");
    // Eventos da página (alerta/validação/erro) percebidos durante a navegação.
    for (const ev of sessao.eventos.slice(0, 8)) await passo({}, `A tela respondeu: ${ev}`);
    await passo({ progress: 60 }, `${pngs.length} print(s) capturado(s)`);

    // Sobe cada print ao bucket `assets` (dedup por checksum) → MediaRef[].
    const midias: MediaRef[] = [];
    for (const p of pngs) {
      const checksum = createHash("sha256").update(p.png).digest("hex");
      const path = `${job.space_id}/shots/${checksum}.png`;
      const { error } = await supabase.storage
        .from("assets")
        .upload(path, p.png, { contentType: "image/png", upsert: true });
      const url = error ? "" : supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;
      if (!url) continue;
      midias.push({
        id: randomUUID().replace(/-/g, "").slice(0, 8),
        kind: "image",
        url,
        name: p.legenda || "Print",
        alt: p.legenda ?? "",
      });
    }
    if (!midias.length) throw new Error("Falha ao guardar os prints no Storage");

    await passo({ status: "writing", progress: 80 }, "Montando o artigo");

    const instrucaoComEventos = sessao.eventos.length
      ? `${instrucao}\n\nMensagens que a tela mostrou durante a navegação (documente os retornos/validações relevantes): ${sessao.eventos.join("; ")}`
      : instrucao;
    if (destino.kind === "import") {
      const titulo = (sessao.inventario.titulo || "Artigo").slice(0, 200);
      const doc = await escreverArtigoEducativo({ inv: sessao.inventario, midias, titulo, instrucao: instrucaoComEventos });
      const node: ProposedNode = { title: titulo, content: [], children: [], blocks: doc };
      // Cria o job do Importador já em 'preview' (a prévia de 4 etapas assume daqui).
      const { data: imp } = await supabase
        .from("import_jobs")
        .insert({
          space_id: job.space_id,
          source_file: job.url,
          original_name: `Prints de ${titulo}`.slice(0, 160),
          mime: "text/html",
          size_bytes: 0,
          status: "preview",
          progress: 100,
          target_parent_id: destino.parentId ?? null,
          created_by: job.created_by,
          result_tree: { tree: [node], images: midias.map((m) => m.url), usedAi: true, usedAiContent: true },
        })
        .select("id")
        .single();
      // Guarda o id do job criado no destino, para a UI abrir a prévia certa.
      await supabase
        .from("capture_jobs")
        .update({ destino: { ...destino, importJobId: imp?.id ?? null } })
        .eq("id", jobId);
    } else {
      // Estúdio: anexa os prints como mídia no artigo-alvo + texto da página como material.
      const { data: sess } = await supabase
        .from("studio_sessions")
        .select("proposal, materiais")
        .eq("id", destino.sessionId)
        .single();
      const proposal = (sess?.proposal ?? []) as ProposalNode[];
      const nova = atualizarNoProposta(proposal, destino.targetTmpId, (n) => {
        const todas = [...(n.midias ?? []), ...midias];
        const doc = n.doc ? { ...n.doc, blocks: resolverMidias(n.doc.blocks, todas) } : n.doc;
        return { ...n, midias: todas, doc };
      });
      const materiais = [...((sess?.materiais ?? []) as { nome: string; texto: string }[])];
      if (!materiais.some((m) => m.texto.includes(job.url))) {
        materiais.push({
          nome: `Web: ${sessao.inventario.titulo || job.url}`,
          texto: `(Fonte: ${job.url})\n${sessao.inventario.texto}`,
        });
      }
      await supabase
        .from("studio_sessions")
        .update({ proposal: nova, materiais, updated_at: new Date().toISOString() })
        .eq("id", destino.sessionId);
    }

    await passo({ status: "done", progress: 100 }, "Concluído");
  } finally {
    await sessao.fechar();
  }
}

async function main() {
  const boss = new PgBoss({ ...parseDbConfig(), schema: "pgboss" });
  await boss.start();
  await boss.createQueue("import");
  await boss.createQueue("import-improve");
  await boss.createQueue("capture");
  await boss.createQueue("scheduled-publish");
  await boss.createQueue("quality-scan");
  await boss.createQueue("embeddings-generate");
  await boss.createQueue("node-embedding");
  await boss.createQueue("ontology-scan");
  await boss.createQueue("ontology-import");
  await boss.createQueue("ontology-translate");
  await boss.createQueue("apex-ingest");
  await boss.createQueue("apex-docs");
  await boss.createQueue("db-ingest");
  await boss.createQueue("db-docs");
  await boss.createQueue("bulk-process");
  await boss.createQueue("analyze-semantic");
  await boss.createQueue("backup");
  await boss.createQueue("backup-restore");
  await boss.createQueue("backup-reschedule");
  await boss.createQueue("backup-import");
  await boss.createQueue("backup-github-save");
  await boss.createQueue("backup-github-import");
  await boss.createQueue("digests");
  await boss.createQueue("tool-runs-cleanup");
  await applyBackupSchedule(boss);
  // Digests de assinaturas: tick de 15 min (instant sai no próximo tick;
  // daily/weekly têm gate de horário dentro do processador).
  await boss.schedule("digests", "*/15 * * * *");
  // Cron do próprio pg-boss: um tick por minuto, singleton (não acumula).
  await boss.schedule("scheduled-publish", "* * * * *");
  // Retenção do log de execução das ferramentas: apaga > 30 dias, 1×/dia.
  await boss.schedule("tool-runs-cleanup", "17 3 * * *");
  console.log("Worker de importação pronto. Aguardando jobs…");

  await boss.work("capture", { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Captura de telas (job ${jobId})`);
      try {
        await processCapture(jobId);
        console.log(`Captura job ${jobId} concluída`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Captura job ${jobId} falhou:`, msg);
        await supabase
          .from("capture_jobs")
          .update({ status: "error", error: msg.slice(0, 500) })
          .eq("id", jobId);
      }
    }
  });

  await boss.work("quality-scan", async (jobs) => {
    for (const job of jobs) {
      const { spaceId } = job.data as { spaceId: string };
      console.log(`Varredura de qualidade do espaço ${spaceId}…`);
      try {
        const r = await scanSpaceQuality(supabase, spaceId);
        console.log(`Qualidade: ${r.artigos} artigo(s), ${r.issues} issue(s).`);
      } catch (e) {
        console.error("Varredura de qualidade falhou:", e instanceof Error ? e.message : e);
      }
    }
  });

  await boss.work("digests", async () => {
    try {
      const r = await processDigests(
        supabase,
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3008",
      );
      if (r.enviados) console.log(`Digests enviados: ${r.enviados}`);
    } catch (e) {
      console.error("Digests falharam:", e instanceof Error ? e.message : e);
    }
  });

  await boss.work("scheduled-publish", async () => {
    try {
      await processScheduled(boss);
    } catch (e) {
      console.error("Varredura de agendados falhou:", e instanceof Error ? e.message : e);
    }
  });

  await boss.work("tool-runs-cleanup", async () => {
    try {
      const limite = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data, error } = await supabase.from("ai_tool_runs").delete().lt("created_at", limite).select("id");
      if (error) console.error("Limpeza de ai_tool_runs falhou:", error.message);
      else if (data?.length) console.log(`Log de execução: ${data.length} registro(s) antigos removidos.`);
    } catch (e) {
      console.error("Limpeza de ai_tool_runs falhou:", e instanceof Error ? e.message : e);
    }
    // Lotes de análise antigos (concluídos/erro há > 2 dias) — dados efêmeros.
    try {
      const limite = new Date(Date.now() - 2 * 86400_000).toISOString();
      const { data } = await supabase
        .from("analysis_jobs")
        .delete()
        .lt("updated_at", limite)
        .in("status", ["concluido", "erro"])
        .select("id");
      if (data?.length) console.log(`Análises: ${data.length} lote(s) antigos removidos.`);
    } catch (e) {
      console.error("Limpeza de analysis_jobs falhou:", e instanceof Error ? e.message : e);
    }
    // Jobs de análise semântica do widget (done/error/canceled há > 2 dias) — chunks caem em cascata.
    try {
      const limite = new Date(Date.now() - 2 * 86400_000).toISOString();
      const { data } = await supabase.from("widget_analysis_jobs").delete().lt("updated_at", limite).in("status", ["done", "error", "canceled"]).select("id");
      if (data?.length) console.log(`Análise semântica: ${data.length} job(s) antigos removidos.`);
    } catch (e) {
      console.error("Limpeza de widget_analysis_jobs falhou:", e instanceof Error ? e.message : e);
    }
    // Datasets coletados do widget há > 7 dias (cache de coleta; recoletável). Cascata p/ jobs que os referenciam.
    try {
      const limite = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data } = await supabase.from("widget_datasets").delete().lt("created_at", limite).select("id");
      if (data?.length) console.log(`Datasets do widget: ${data.length} conjunto(s) antigos removidos.`);
    } catch (e) {
      console.error("Limpeza de widget_datasets falhou:", e instanceof Error ? e.message : e);
    }
  });

  await boss.work("embeddings-generate", async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Gerando embeddings (job ${jobId})`);
      try {
        await processEmbeddings(jobId);
        console.log(`Embeddings job ${jobId} concluído`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Embeddings job ${jobId} falhou:`, msg);
        await supabase.from("embedding_jobs").update({ status: "error", error: msg }).eq("id", jobId);
      }
    }
  });

  await boss.work("node-embedding", async (jobs) => {
    for (const job of jobs) {
      const { nodeId, spaceId, embeddedBy } = job.data as {
        nodeId: string;
        spaceId: string;
        embeddedBy: string | null;
      };
      const { data: art } = await supabase
        .from("articles")
        .select("id, content_json")
        .eq("node_id", nodeId)
        .maybeSingle();
      if (!art) {
        console.log(`Embedding do nó ${nodeId}: artigo não encontrado (ignorado).`);
        continue;
      }
      // Deixa a exceção subir: pg-boss reprocessa (retryLimit) — a publicação
      // já ocorreu; aqui só (re)geramos os vetores até conseguir.
      await reindexNodeChunks(supabase, {
        nodeId,
        articleId: art.id,
        spaceId,
        doc: art.content_json,
        withEmbeddings: true,
        embeddedBy: embeddedBy ?? undefined,
      });
      console.log(`Embedding do nó ${nodeId} concluído.`);
    }
  });

  await boss.work("ontology-scan", async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Varredura de ontologia (job ${jobId})`);
      try {
        await processOntologyScan(jobId);
        console.log(`Ontologia job ${jobId} concluído`);
        // Auto-migração: os termos novos da varredura entram nas traduções dos idiomas habilitados.
        try {
          const { data: j } = await supabase.from("ontology_jobs").select("space_id").eq("id", jobId).single();
          if (j?.space_id) await enfileirarTraducoesPendentes(supabase, j.space_id, null);
        } catch { /* best-effort */ }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Ontologia job ${jobId} falhou:`, msg);
        await supabase.from("ontology_jobs").update({ status: "error", error: msg }).eq("id", jobId);
      }
    }
  });

  await boss.work("ontology-import", async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Importação de ontologia (job ${jobId})`);
      try {
        await processOntologyImport(jobId);
        console.log(`Importação de ontologia ${jobId} concluída`);
        try {
          const { data: j } = await supabase.from("ontology_jobs").select("space_id").eq("id", jobId).single();
          if (j?.space_id) await enfileirarTraducoesPendentes(supabase, j.space_id, null);
        } catch { /* best-effort */ }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Importação de ontologia ${jobId} falhou:`, msg);
        await supabase.from("ontology_jobs").update({ status: "error", error: msg }).eq("id", jobId);
      }
    }
  });

  await boss.work("ontology-translate", async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Tradução de ontologia (job ${jobId})`);
      try {
        const { traduzidos } = await runTraducaoOntologia(supabase, jobId);
        console.log(`Tradução de ontologia ${jobId} concluída (${traduzidos} termos)`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Tradução de ontologia ${jobId} falhou:`, msg);
        await supabase.from("ontology_translation_jobs").update({ status: "error", error: msg }).eq("id", jobId);
      }
    }
  });

  await boss.work("apex-ingest", async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Ingestão de app APEX (job ${jobId})`);
      try {
        const r = await runApexIngest(supabase, jobId);
        console.log(`Ingestão APEX ${jobId} concluída (${r.componentes} componentes, ${r.colunas} colunas, ${r.termos} termos)`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Ingestão APEX ${jobId} falhou:`, msg);
        await supabase.from("data_dictionary_jobs").update({ status: "error", error: msg }).eq("id", jobId);
      }
    }
  });

  await boss.work("apex-docs", async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Documentação de app APEX (job ${jobId})`);
      try {
        const r = await runApexDocs(supabase, jobId);
        console.log(`Documentação APEX ${jobId} concluída (${r.paginas} páginas, ${r.artigos} artigos)`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Documentação APEX ${jobId} falhou:`, msg);
        await supabase.from("data_dictionary_jobs").update({ status: "error", error: msg }).eq("id", jobId);
      }
    }
  });

  await boss.work("db-ingest", async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Ingestão de objetos de banco (job ${jobId})`);
      try {
        const r = await runDbIngest(supabase, jobId);
        console.log(`Ingestão de banco ${jobId} concluída (${r.objetos} objetos, ${r.colunas} colunas, ${r.termos} termos)`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Ingestão de banco ${jobId} falhou:`, msg);
        await supabase.from("data_dictionary_jobs").update({ status: "error", error: msg }).eq("id", jobId);
      }
    }
  });

  await boss.work("db-docs", async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Documentação técnica de banco (job ${jobId})`);
      try {
        const r = await runDbDocs(supabase, jobId);
        console.log(`Documentação de banco ${jobId} concluída (${r.objetos} objetos, ${r.artigos} artigos)`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Documentação de banco ${jobId} falhou:`, msg);
        await supabase.from("data_dictionary_jobs").update({ status: "error", error: msg }).eq("id", jobId);
      }
    }
  });

  await boss.work("bulk-process", async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Processamento em lote (job ${jobId})`);
      try {
        await processBulk(jobId);
        console.log(`Lote ${jobId} concluído`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Lote ${jobId} falhou:`, msg);
        await supabase.from("bulk_jobs").update({ status: "error", error: msg }).eq("id", jobId);
      }
    }
  });

  // Análise de dados em lote (map-reduce/OCR) — tira o pesado da camada web.
  // batchSize 2: processa até 2 lotes por vez neste worker (escale com réplicas).
  await boss.work("analyze", { batchSize: 2 }, async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Análise em lote (job ${jobId})`);
      try {
        await processAnalyzeJob(jobId);
        console.log(`Análise ${jobId} concluída`);
      } catch (e) {
        console.error(`Análise ${jobId} falhou:`, e instanceof Error ? e.message : String(e));
        throw e; // deixa o pg-boss reprocessar (retryLimit no enqueue)
      }
    }
  });

  await boss.work("analyze-semantic", { batchSize: 2 }, async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Análise semântica (job ${jobId})`);
      try {
        await processSemanticJob(jobId);
        console.log(`Análise semântica ${jobId} concluída`);
      } catch (e) {
        console.error(`Análise semântica ${jobId} falhou:`, e instanceof Error ? e.message : String(e));
        throw e; // pg-boss retenta
      }
    }
  });

  await boss.work("backup", async (jobs) => {
    for (const job of jobs) {
      const data = job.data as { jobId?: string; auto?: boolean };
      let jobId = data.jobId;
      try {
        // Disparo agendado (cron): cria o registro do backup na hora.
        if (!jobId && data.auto) {
          const { data: cfg } = await supabase.from("backup_settings").select("include_storage").eq("id", true).single();
          const { data: row } = await supabase
            .from("backup_jobs").insert({ kind: "auto", include_storage: cfg?.include_storage ?? true })
            .select("id").single();
          jobId = row?.id;
          await supabase.from("backup_settings").update({ last_run_at: new Date().toISOString() }).eq("id", true);
        }
        if (!jobId) continue;
        console.log(`Backup (job ${jobId})`);
        await processBackup(jobId);
        console.log(`Backup ${jobId} concluído`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Backup ${jobId ?? "?"} falhou:`, msg);
        if (jobId) await bkUpdate(jobId, { status: "error", error: msg, updated_at: new Date().toISOString() });
      }
    }
  });

  await boss.work("backup-restore", async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Restauração (job ${jobId})`);
      try {
        await processRestore(jobId);
        console.log(`Restauração ${jobId} concluída`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Restauração ${jobId} falhou:`, msg);
        await bkUpdate(jobId, { status: "error", error: msg, updated_at: new Date().toISOString() });
      }
    }
  });

  await boss.work("backup-reschedule", async () => {
    try {
      await applyBackupSchedule(boss);
    } catch (e) {
      console.error("Reprogramação de backup falhou:", e instanceof Error ? e.message : e);
    }
  });

  const backupJobHandler = (fn: (data: Record<string, unknown>) => Promise<void>, nome: string) =>
    async (jobs: { data: unknown }[]) => {
      for (const job of jobs) {
        const data = job.data as { jobId: string } & Record<string, unknown>;
        try {
          await fn(data);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`${nome} ${data.jobId} falhou:`, msg);
          if (data.jobId) await bkUpdate(data.jobId, { status: "error", error: msg, updated_at: new Date().toISOString() });
        }
      }
    };

  await boss.work("backup-import", backupJobHandler((d) => processBackupImport(d.jobId as string, d.incomingPath as string), "Importação de backup"));
  await boss.work("backup-github-save", backupJobHandler((d) => processGithubSave(d.jobId as string, d.sourceBackupId as string), "Envio ao GitHub"));
  await boss.work("backup-github-import", backupJobHandler((d) => processGithubImport(d.jobId as string, d.filePath as string | undefined), "Importação do GitHub"));

  // `batchSize: 1`: importação é UM arquivo de cada vez. Vários uploads viram
  // vários jobs 'queued'; o worker busca e processa um, só então pega o próximo
  // — nada de dois PDFs concorrendo (memória/IA) e recuperação limpa se cair no
  // meio (só um job fica 'active' por vez). O laço abaixo segue defensivo.
  await boss.work("import", { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      const { jobId } = job.data as { jobId: string };
      console.log(`Processando job ${jobId}`);
      try {
        await processJob(jobId);
        console.log(`Job ${jobId} concluído (preview)`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Job ${jobId} falhou:`, msg);
        await setProgress(jobId, { status: "error", error: msg }, `Erro: ${msg}`);
      }
    }
  });

  await boss.work("import-improve", async (jobs) => {
    for (const job of jobs) {
      const { jobId, nodeIds } = job.data as { jobId: string; nodeIds: string[] };
      console.log(`Melhorando layout do job ${jobId} (${nodeIds?.length ?? 0} artigos)`);
      try {
        await processImprove(jobId, nodeIds ?? []);
        console.log(`Job ${jobId} — layout concluído`);
      } catch (e) {
        // A árvore JÁ está importada: falhar aqui não pode marcar o job como
        // 'error' (pareceria que a importação se perdeu). Conclui com aviso.
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Job ${jobId} — melhoria falhou:`, msg);
        await setProgress(
          jobId,
          { status: "done", progress: 100 },
          `Melhoria de layout interrompida: ${msg}. Os artigos mantêm o conteúdo importado.`,
        );
      }
    }
  });

  // Parada graciosa: sem isso, um deploy ou Ctrl+C no meio de uma importação
  // abandonava o job em 'extracting'/'inferring' para sempre — o cron
  // fail_stale_import_jobs limpa depois, mas o usuário perdia a importação
  // sem entender por quê. `wait: true` deixa o job em curso terminar.
  let encerrando = false;
  const encerrar = async (sinal: string) => {
    if (encerrando) return;
    encerrando = true;
    console.log(`\n${sinal} recebido — terminando o job em curso antes de sair…`);
    try {
      await boss.stop({ wait: true });
      console.log("Worker encerrado.");
    } catch (e) {
      console.error("Falha ao encerrar:", e);
    }
    process.exit(0);
  };
  process.on("SIGTERM", () => void encerrar("SIGTERM"));
  process.on("SIGINT", () => void encerrar("SIGINT"));
}

main().catch((e) => {
  console.error("Worker morreu:", e);
  process.exit(1);
});
