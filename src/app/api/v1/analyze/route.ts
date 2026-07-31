import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorize, apiJson } from "@/lib/api/manage";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeTrackForSpace, type TrackFields } from "@/lib/tracking/resolve";
import { analisarDados, type Linha, type ResultadoAnalise } from "@/lib/analyze/analyze";
import { parseCsv, decodeBytesToText } from "@/lib/analyze/core";
import { interpretarArquivos, type ArquivoIn } from "@/lib/analyze/files";

export const runtime = "nodejs";
export const maxDuration = 300; // a análise (map-reduce / visão) pode demorar

const MAX_LINHAS = 50_000;

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

  if (existente?.status === "concluido" && existente.result) {
    return responder(db, spaceId, body, existente.result as unknown as ResultadoAnalise, existente.destino);
  }

  // Linhas do chunk — de `rows` OU do CSV (texto/base64). Com cabeçalho, as
  // colunas saem da 1ª linha do 1º chunk.
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

  // Grava o chunk (idempotente por seq).
  const seq = body.seq ?? job.received_chunks;
  if (extraido.rows.length) {
    const { error } = await db
      .from("analysis_chunks")
      .upsert({ job_id: job.id, seq, rows: extraido.rows as never }, { onConflict: "job_id,seq", ignoreDuplicates: true });
    if (error) return apiJson({ error: "Falha ao gravar o chunk." }, 500);
  }

  const { data: chunks } = await db.from("analysis_chunks").select("seq, rows").eq("job_id", job.id).order("seq");
  const receivedChunks = chunks?.length ?? 0;
  const receivedRows = (chunks ?? []).reduce((a, c) => a + ((c.rows as unknown[])?.length ?? 0), 0);
  if (receivedRows > MAX_LINHAS) {
    await db.from("analysis_jobs").update({ status: "erro", error: "Excedeu o teto de linhas." }).eq("id", job.id);
    return apiJson({ error: `Lote excede o teto de ${MAX_LINHAS} linhas.` }, 413);
  }
  await db
    .from("analysis_jobs")
    .update({ received_chunks: receivedChunks, received_rows: receivedRows, updated_at: new Date().toISOString() })
    .eq("id", job.id);

  // Só é final se pediram (final/total) E há algo para analisar (linhas OU arquivos).
  const temArquivos = !!body.arquivos?.length;
  const querFechar = body.final === true || (job.total_chunks != null && receivedChunks >= job.total_chunks);
  if (!querFechar) {
    return apiJson({ ok: true, batchId: body.batchId, recebidos_chunks: receivedChunks, recebidos_linhas: receivedRows, final: false });
  }

  // FINAL → monta 100% e analisa.
  await db.from("analysis_jobs").update({ status: "analisando" }).eq("id", job.id);
  const linhas: Linha[] = (chunks ?? []).flatMap((c) => (c.rows as Linha[]) ?? []);
  const colunas: string[] = (job.columns as string[] | null) ?? body.columns ?? gerarColunas(linhas);
  if (!linhas.length && !temArquivos) {
    await db.from("analysis_jobs").update({ status: "erro", error: "Sem dados nem arquivos para analisar." }).eq("id", job.id);
    return apiJson({ error: "Nada para analisar: envie linhas (rows/csv) e/ou arquivos." }, 400);
  }

  const arq = temArquivos ? await interpretarArquivos(body.arquivos as ArquivoIn[]) : null;
  let resultado: ResultadoAnalise;
  try {
    resultado = await analisarDados({
      colunas,
      linhas,
      instrucao: body.instrucao ?? (job.instrucao as string | null) ?? undefined,
      persona: body.persona,
      contextoArquivos: arq?.texto,
      imageParts: arq?.imageParts,
      fileParts: arq?.fileParts,
      llm: body.llm,
      meta: { kind: "system" },
    });
  } catch (e) {
    await db.from("analysis_jobs").update({ status: "erro", error: (e as Error).message }).eq("id", job.id);
    return apiJson({ error: "Falha na análise.", detalhe: (e as Error).message }, 500);
  }
  if (arq?.metas.length) resultado = { ...resultado, meta: { ...resultado.meta, ...({ arquivos: arq.metas } as object) } };

  await db.from("analysis_jobs").update({ status: "concluido", result: resultado as never }).eq("id", job.id);
  await db.from("analysis_chunks").delete().eq("job_id", job.id);
  return responder(db, spaceId, body, resultado, body.destino ?? job.destino);
}

/** Monta a resposta conforme o destino. Chat EXIGE dados de sessão — sem eles,
 *  cai para "api" (só Response). */
async function responder(db: Db, spaceId: string, body: Body, result: ResultadoAnalise, destinoJob: string) {
  let destino = (body.destino ?? destinoJob ?? "api") as "api" | "chat" | "ambos";
  const corpo: Record<string, unknown> = { ok: true, batchId: body.batchId, final: true };
  if (destino === "chat" || destino === "ambos") {
    const { track, temSessao } = await resolverIdentidade(spaceId, body);
    if (!temSessao) {
      corpo.aviso = "Sem dados de sessão (track/identidade): a análise NÃO foi enviada ao chat; retornada só via API.";
      destino = "api";
    } else {
      const convId = await postarNoChat(db, spaceId, body, track, result);
      if (convId) corpo.conversationId = convId;
    }
  }
  corpo.destino = destino;
  if (destino === "api" || destino === "ambos") {
    corpo.analise = result.analise;
    corpo.resumo = result.resumo;
    corpo.meta = result.meta;
  }
  return apiJson(corpo, 200);
}

/** Identidade da sessão: token `track` cifrado E/OU campos crus (empresa, etc.). */
async function resolverIdentidade(spaceId: string, body: Body): Promise<{ track: TrackFields; temSessao: boolean }> {
  const doToken = (await decodeTrackForSpace(spaceId, body.track).catch(() => ({}))) as TrackFields;
  const crus: TrackFields = {};
  const id = body.identidade;
  if (id) {
    if (id.empresa != null) crus.p_empresa = String(id.empresa);
    if (id.matricula != null) crus.p_matricula = String(id.matricula);
    if (id.usuario != null) crus.p_usuario = String(id.usuario);
    if (id.perfil != null) crus.p_perfil = String(id.perfil);
    if (id.portal != null) crus.p_portal = String(id.portal);
  }
  const track = { ...doToken, ...crus };
  return { track, temSessao: Object.keys(track).length > 0 };
}

/** Posta a análise na conversa (aparece no chat do widget via histórico). */
async function postarNoChat(db: Db, spaceId: string, body: Body, track: TrackFields, result: ResultadoAnalise): Promise<string | null> {
  let convId = body.conversationId ?? null;
  if (!convId) {
    const { data: conv } = await db
      .from("conversations")
      .insert({ space_id: spaceId, session_id: body.sessionId ?? null, ...track })
      .select("id")
      .single();
    convId = conv?.id ?? null;
  }
  if (!convId) return null;
  const pergunta = (body.instrucao?.trim() || "Análise dos dados enviados") + ` (${result.meta.linhas} registros)`;
  await db.from("messages").insert({ conversation_id: convId, role: "user", content: pergunta });
  await db.from("messages").insert({ conversation_id: convId, role: "assistant", content: result.analise });
  return convId;
}

/** Linhas do chunk: `rows` OU `csv`/`csvBase64`. Com cabeçalho, a 1ª linha vira
 *  as colunas — só no 1º chunk. */
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

function gerarColunas(linhas: Linha[]): string[] {
  const primeira = linhas[0];
  if (primeira && !Array.isArray(primeira) && typeof primeira === "object") return Object.keys(primeira);
  const n = Array.isArray(primeira) ? primeira.length : 0;
  return Array.from({ length: n }, (_, i) => `col${i + 1}`);
}

/** Lê a requisição em 3 formatos: JSON (completo), text/csv (corpo = CSV) e
 *  multipart/form-data (arquivos + params na query). */
async function lerRequisicao(req: NextRequest): Promise<Body> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return bodySchema.parse(await req.json());
  }
  const base = paramsDaQuery(new URL(req.url).searchParams);
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const arquivos: ArquivoIn[] = [];
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
      else arquivos.push({ nome, mime: v.type, base64: Buffer.from(bytes).toString("base64") });
    }
    return bodySchema.parse({ ...base, ...(csv != null ? { csv } : {}), ...(arquivos.length ? { arquivos } : {}) });
  }
  // text/csv, text/plain, etc. → o corpo é a tabela CSV.
  return bodySchema.parse({ ...base, csv: await req.text() });
}

/** Params dos modos crus (text/csv e multipart) via query string. */
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
