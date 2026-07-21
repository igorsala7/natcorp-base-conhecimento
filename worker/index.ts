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
import { hasAiKey } from "../src/lib/ai/config";

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
  await setProgress(
    jobId,
    { progress: 50 },
    `Extraídas ${extraction.images.length} imagens` +
      (podadas ? ` (${podadas} descartadas: repetidas em toda página, tratadas como cabeçalho/rodapé)` : "") +
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
  const heuristic = heuristicTree(extraction);

  // Refino por LLM: agora a árvore da IA é REALMENTE aplicada (antes só a
  // heurística era usada). Se a IA falhar/indisponível, cai na heurística.
  let tree = heuristic;
  let usedAi = false;
  if (await hasAiKey("import_structure")) {
    const { tree: refined, erro } = await refineStructureWithLLM(heuristic);
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
  } else {
    await setProgress(
      jobId,
      { progress: 85 },
      "Sem IA configurada para Importação — estrutura por heurística",
    );
  }

  await setProgress(
    jobId,
    {
      status: "preview",
      progress: 100,
      result_tree: { tree, images: imageUrls, usedAi },
    },
    "Pronto para revisão",
  );
}

async function main() {
  const boss = new PgBoss({ ...parseDbConfig(), schema: "pgboss" });
  await boss.start();
  await boss.createQueue("import");
  console.log("Worker de importação pronto. Aguardando jobs…");

  await boss.work("import", async (jobs) => {
    // Itera o lote inteiro: `const job = jobs[0]` descartava em SILÊNCIO
    // jobs[1..n] quando o pg-boss entregava mais de um, e eles nunca eram
    // marcados como concluídos nem como erro.
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
