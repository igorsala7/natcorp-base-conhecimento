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
import { createHash } from "node:crypto";
import PgBoss from "pg-boss";
import { createClient } from "@supabase/supabase-js";
import { parseDbConfig } from "../src/lib/jobs/db-config";
import { extractDocument } from "../src/lib/importer/extract";
import {
  heuristicTree,
  refineStructureWithLLM,
} from "../src/lib/importer/structure";
import { buildDocInput } from "../src/lib/importer/doc-input";
import { rasterizePdf } from "../src/lib/importer/rasterize";
import { readOutline } from "../src/lib/importer/read-outline";
import { generateArticle } from "../src/lib/importer/generate-article";
import { hasAiKey, resolveAi } from "../src/lib/ai/config";
import { normalizeDoc } from "../src/lib/blocks/convert";
import { blocksToPlainWithImageMarkers, blocksToText } from "../src/lib/blocks/serialize";
import { publishNodeCore, unpublishNodeCore } from "../src/lib/content/publish-core";
import { reindexNodeChunks } from "../src/lib/content/chunk";
import { scanSpaceQuality } from "../src/lib/quality/scan";
import { processDigests } from "../src/lib/subscriptions/digest";

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
    const { doc, aviso } = await generateArticle(text, images);
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

/**
 * Publicações agendadas vencidas: executa a MESMA lógica do publicar manual
 * (rascunho → oficial, snapshot, embeddings) e o despublicar com redirect.
 * Roda pelo cron do pg-boss a cada minuto; cada nó falha isolado.
 */
async function processScheduled(): Promise<void> {
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

async function main() {
  const boss = new PgBoss({ ...parseDbConfig(), schema: "pgboss" });
  await boss.start();
  await boss.createQueue("import");
  await boss.createQueue("import-improve");
  await boss.createQueue("scheduled-publish");
  await boss.createQueue("quality-scan");
  await boss.createQueue("embeddings-generate");
  await boss.createQueue("digests");
  // Digests de assinaturas: tick de 15 min (instant sai no próximo tick;
  // daily/weekly têm gate de horário dentro do processador).
  await boss.schedule("digests", "*/15 * * * *");
  // Cron do próprio pg-boss: um tick por minuto, singleton (não acumula).
  await boss.schedule("scheduled-publish", "* * * * *");
  console.log("Worker de importação pronto. Aguardando jobs…");

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
      await processScheduled();
    } catch (e) {
      console.error("Varredura de agendados falhou:", e instanceof Error ? e.message : e);
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
