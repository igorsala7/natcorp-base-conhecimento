import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorize, apiJson } from "@/lib/api/manage";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueAnalyze } from "@/lib/jobs/boss";
import { parseCsv, decodeBytesToText } from "@/lib/analyze/core";
import type { Linha } from "@/lib/analyze/analyze";
import type { AnalyzeParams } from "@/lib/analyze/run-job";

export const runtime = "nodejs";
export const maxDuration = 60; // o trabalho pesado vai para o worker; aqui só enfileira

const MAX_LINHAS = 50_000;
const MAX_ARQUIVOS_B64 = 25_000_000; // ~18 MB de arquivos por lote (cabem no params)

const identidadeSchema = z
  .object({
    empresa: z.union([z.string(), z.number()]).optional(),
    matricula: z.union([z.string(), z.number()]).optional(),
    usuario: z.union([z.string(), z.number()]).optional(),
    perfil: z.string().max(80).optional(),
    portal: z.string().max(40).optional(),
    cpf: z.string().max(20).optional(),
  })
  .optional();

const bodySchema = z.object({
  space: z.string().min(1).max(200),
  batchId: z.string().min(1).max(200),
  seq: z.number().int().min(0).optional(),
  total: z.number().int().min(1).max(100_000).optional(),
  final: z.boolean().optional(),
  aguardar: z.boolean().optional(),
  columns: z.array(z.string()).max(500).optional(),
  rows: z.array(z.unknown()).max(MAX_LINHAS).optional(),
  csv: z.string().max(16_000_000).optional(),
  csvBase64: z.string().max(22_000_000).optional(),
  delimiter: z.string().length(1).optional(),
  hasHeader: z.boolean().optional(),
  instrucao: z.string().max(8000).optional(),
  persona: z.string().max(8000).optional(),
  llm: z.object({ provider: z.string().max(40).optional(), model: z.string().max(120).optional() }).optional(),
  arquivos: z.array(z.object({ nome: z.string().max(200), mime: z.string().max(120).optional(), base64: z.string().max(30_000_000) })).max(20).optional(),
  destino: z.enum(["api", "chat", "ambos"]).optional(),
  track: z.string().optional(),
  identidade: identidadeSchema,
  sessionId: z.string().max(200).optional(),
  conversationId: z.string().uuid().optional(),
});
type Body = z.infer<typeof bodySchema>;
type Db = ReturnType<typeof createAdminClient>;

// GET /api/v1/analyze?space=slug&batchId=... (ou ?jobId=...) — poll do resultado.
export async function GET(req: NextRequest) {
  const auth = await authorize(req, "data.analyze");
  if ("error" in auth) return auth.error;
  const u = new URL(req.url);
  const jobId = u.searchParams.get("jobId");
  const space = u.searchParams.get("space");
  const batchId = u.searchParams.get("batchId");
  const db = createAdminClient();
  let job;
  if (jobId) {
    ({ data: job } = await db.from("analysis_jobs").select("*").eq("id", jobId).maybeSingle());
  } else if (space && batchId) {
    const { data: sp } = await db.from("spaces").select("id").eq("slug", space).maybeSingle();
    if (!sp) return apiJson({ error: "Espaço não encontrado." }, 404);
    ({ data: job } = await db.from("analysis_jobs").select("*").eq("space_id", sp.id).eq("batch_id", batchId).maybeSingle());
  } else {
    return apiJson({ error: "Informe jobId, ou space + batchId." }, 400);
  }
  if (!job) return apiJson({ error: "Lote não encontrado." }, 404);
  return apiJson(statusPayload(job), 200);
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req, "data.analyze");
  if ("error" in auth) return auth.error;

  let body: Body;
  try {
    body = await lerRequisicao(req);
  } catch (e) {
    return apiJson({ error: "Payload inválido.", detalhe: (e as Error).message }, 400);
  }

  const db = createAdminClient();
  const { data: space } = await db.from("spaces").select("id").eq("slug", body.space).maybeSingle();
  if (!space) return apiJson({ error: `Espaço "${body.space}" não encontrado.` }, 404);
  const spaceId = space.id;

  const { data: existente } = await db
    .from("analysis_jobs")
    .select("*")
    .eq("space_id", spaceId)
    .eq("batch_id", body.batchId)
    .maybeSingle();

  // Já concluído/na fila → idempotente: devolve o status atual (sem reenfileirar).
  if (existente && existente.status !== "coletando") {
    return apiJson(statusPayload(existente), 200);
  }

  const jaTemColunas = !!(existente?.columns ?? body.columns);
  let extraido: { rows: Linha[]; columns?: string[] };
  try {
    extraido = extrairDados(body, jaTemColunas);
  } catch (e) {
    return apiJson({ error: "CSV inválido.", detalhe: (e as Error).message }, 400);
  }
  const colsIniciais = body.columns ?? extraido.columns ?? null;

  let job = existente;
  if (!job) {
    const { data: novo, error } = await db
      .from("analysis_jobs")
      .insert({
        space_id: spaceId,
        batch_id: body.batchId,
        status: "coletando",
        columns: colsIniciais,
        instrucao: body.instrucao ?? null,
        destino: body.destino ?? "api",
        total_chunks: body.total ?? null,
      })
      .select("*")
      .single();
    if (error || !novo) return apiJson({ error: "Falha ao abrir o lote." }, 500);
    job = novo;
  } else {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (colsIniciais && !job.columns) patch.columns = colsIniciais;
    if (body.instrucao) patch.instrucao = body.instrucao;
    if (body.destino) patch.destino = body.destino;
    if (body.total && !job.total_chunks) patch.total_chunks = body.total;
    await db.from("analysis_jobs").update(patch as never).eq("id", job.id);
    job = { ...job, ...patch } as typeof job;
  }

  const seq = body.seq ?? job.received_chunks;
  if (extraido.rows.length) {
    const { error } = await db
      .from("analysis_chunks")
      .upsert({ job_id: job.id, seq, rows: extraido.rows as never }, { onConflict: "job_id,seq", ignoreDuplicates: true });
    if (error) return apiJson({ error: "Falha ao gravar o chunk." }, 500);
  }

  const { data: chunks } = await db.from("analysis_chunks").select("seq").eq("job_id", job.id);
  const receivedChunks = chunks?.length ?? 0;
  // Recontagem de linhas: uma agregação leve (evita puxar as linhas de novo).
  const { count: receivedRows } = await contarLinhas(db, job.id);
  if (receivedRows > MAX_LINHAS) {
    await db.from("analysis_jobs").update({ status: "erro", error: "Excedeu o teto de linhas." }).eq("id", job.id);
    return apiJson({ error: `Lote excede o teto de ${MAX_LINHAS} linhas.` }, 413);
  }
  await db
    .from("analysis_jobs")
    .update({ received_chunks: receivedChunks, received_rows: receivedRows, updated_at: new Date().toISOString() })
    .eq("id", job.id);

  const querFechar = body.final === true || (job.total_chunks != null && receivedChunks >= job.total_chunks);
  if (!querFechar) {
    return apiJson({ ok: true, batchId: body.batchId, jobId: job.id, recebidos_chunks: receivedChunks, recebidos_linhas: receivedRows, final: false }, 200);
  }

  // FINAL → valida, guarda a config e ENFILEIRA (o worker analisa).
  const temArquivos = !!body.arquivos?.length;
  if (!receivedRows && !temArquivos) {
    await db.from("analysis_jobs").update({ status: "erro", error: "Sem dados nem arquivos." }).eq("id", job.id);
    return apiJson({ error: "Nada para analisar: envie linhas (rows/csv) e/ou arquivos." }, 400);
  }
  if (temArquivos && (body.arquivos ?? []).reduce((a, f) => a + f.base64.length, 0) > MAX_ARQUIVOS_B64) {
    return apiJson({ error: "Arquivos grandes demais para a análise em lote (some > ~18 MB)." }, 413);
  }

  // Gate de sessão: chat exige identidade; sem ela, cai para api-only.
  let destinoFinal = (body.destino ?? job.destino ?? "api") as "api" | "chat" | "ambos";
  let aviso: string | undefined;
  if ((destinoFinal === "chat" || destinoFinal === "ambos") && !(body.track || body.identidade)) {
    aviso = "Sem dados de sessão (track/identidade): a análise NÃO irá ao chat; consulte pelo poll/GET.";
    destinoFinal = "api";
  }

  const params: AnalyzeParams = {
    persona: body.persona ?? null,
    llm: body.llm ?? null,
    track: body.track ?? null,
    identidade: body.identidade ?? null,
    sessionId: body.sessionId ?? null,
    conversationId: body.conversationId ?? null,
    arquivos: body.arquivos ?? null,
  };
  await db
    .from("analysis_jobs")
    .update({ status: "na_fila", destino: destinoFinal, instrucao: body.instrucao ?? job.instrucao, params: params as never, updated_at: new Date().toISOString() })
    .eq("id", job.id);

  try {
    await enqueueAnalyze(job.id);
  } catch (e) {
    await db.from("analysis_jobs").update({ status: "erro", error: "Falha ao enfileirar: " + (e as Error).message }).eq("id", job.id);
    return apiJson({ error: "Não foi possível enfileirar a análise (worker/fila indisponível)." }, 503);
  }

  // Conveniência: aguarda um pouco pelo resultado (jobs pequenos). Cap curto para
  // não segurar a camada web; jobs grandes retornam o jobId para poll.
  if (body.aguardar) {
    const pronto = await esperarJob(db, job.id, 15_000);
    if (pronto) return apiJson(statusPayload(pronto), 200);
  }
  return apiJson({ ok: true, batchId: body.batchId, jobId: job.id, status: "na_fila", final: true, ...(aviso ? { aviso } : {}) }, 202);
}

// ————————————————————————————————————————————————————————————————

type Job = { id: string; batch_id: string; status: string; result: unknown; error: string | null };

/** Payload de status/resultado devolvido no POST idempotente e no GET/poll. */
function statusPayload(job: Job): Record<string, unknown> {
  const base: Record<string, unknown> = { ok: true, batchId: job.batch_id, jobId: job.id, status: job.status };
  if (job.status === "concluido" && job.result) Object.assign(base, job.result as object, { final: true });
  if (job.status === "erro") base.erro = job.error ?? "Falha na análise.";
  return base;
}

/** Long-poll interno (aguardar): checa o status do job até `ms` ou concluir. */
async function esperarJob(db: Db, jobId: string, ms: number): Promise<Job | null> {
  const ate = Date.now() + ms;
  while (Date.now() < ate) {
    await new Promise((r) => setTimeout(r, 1500));
    const { data } = await db.from("analysis_jobs").select("id, batch_id, status, result, error").eq("id", jobId).maybeSingle();
    if (data && (data.status === "concluido" || data.status === "erro")) return data as Job;
  }
  return null;
}

/** Conta as linhas recebidas somando o tamanho dos arrays `rows` dos chunks. */
async function contarLinhas(db: Db, jobId: string): Promise<{ count: number }> {
  const { data } = await db.from("analysis_chunks").select("rows").eq("job_id", jobId);
  const count = (data ?? []).reduce((a, c) => a + ((c.rows as unknown[])?.length ?? 0), 0);
  return { count };
}

function extrairDados(body: Body, jaTemColunas: boolean): { rows: Linha[]; columns?: string[] } {
  const csvText =
    body.csvBase64 != null
      ? decodeBytesToText(new Uint8Array(Buffer.from(body.csvBase64, "base64")))
      : body.csv != null
        ? body.csv
        : null;
  if (csvText != null) {
    const matriz = parseCsv(csvText, body.delimiter);
    const temHeader = body.hasHeader !== false && !body.columns && !jaTemColunas;
    if (temHeader && matriz.length) return { columns: matriz[0]!.map((c) => String(c)), rows: matriz.slice(1) as Linha[] };
    return { rows: matriz as Linha[] };
  }
  return { rows: (body.rows ?? []) as Linha[] };
}

async function lerRequisicao(req: NextRequest): Promise<Body> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return bodySchema.parse(await req.json());
  const base = paramsDaQuery(new URL(req.url).searchParams);
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const arquivos: Body["arquivos"] = [];
    let csv: string | undefined;
    for (const [k, v] of form.entries()) {
      if (typeof v === "string") {
        if (k === "params") Object.assign(base, JSON.parse(v));
        else base[k] = v;
        continue;
      }
      const bytes = new Uint8Array(await v.arrayBuffer());
      const nome = v.name || k;
      const ehTabela = k === "data" || k === "csv" || (k === "file" && /\.(csv|tsv|txt)$/i.test(nome) && csv == null);
      if (ehTabela) csv = decodeBytesToText(bytes);
      else arquivos!.push({ nome, mime: v.type, base64: Buffer.from(bytes).toString("base64") });
    }
    return bodySchema.parse({ ...base, ...(csv != null ? { csv } : {}), ...(arquivos!.length ? { arquivos } : {}) });
  }
  return bodySchema.parse({ ...base, csv: await req.text() });
}

function paramsDaQuery(q: URLSearchParams): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  const g = (k: string) => q.get(k) ?? undefined;
  for (const k of ["space", "batchId", "instrucao", "persona", "destino", "delimiter", "track", "sessionId", "conversationId"]) {
    const v = g(k);
    if (v != null) p[k] = v;
  }
  if (g("seq") != null) p.seq = Number(g("seq"));
  if (g("total") != null) p.total = Number(g("total"));
  if (g("final") != null) p.final = g("final") === "true" || g("final") === "1";
  if (g("aguardar") != null) p.aguardar = g("aguardar") === "true" || g("aguardar") === "1";
  if (g("hasHeader") != null) p.hasHeader = !(g("hasHeader") === "false" || g("hasHeader") === "0");
  if (g("provider") != null || g("model") != null) p.llm = { provider: g("provider"), model: g("model") };
  const id: Record<string, string> = {};
  for (const k of ["empresa", "matricula", "usuario", "perfil", "portal", "cpf"]) {
    const v = g(k);
    if (v != null) id[k] = v;
  }
  if (Object.keys(id).length) p.identidade = id;
  return p;
}
