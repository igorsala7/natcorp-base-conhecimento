import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeTrackForSpace, type TrackFields } from "@/lib/tracking/resolve";
import { analisarDados, type Linha } from "./analyze";
import { interpretarArquivos, type ArquivoIn } from "./files";

type Db = ReturnType<typeof createAdminClient>;

/** Config do job guardada em analysis_jobs.params (o worker precisa disso). */
export type AnalyzeParams = {
  persona?: string | null;
  llm?: { provider?: string | null; model?: string | null } | null;
  track?: string | null;
  identidade?: {
    empresa?: string | number;
    matricula?: string | number;
    usuario?: string | number;
    perfil?: string;
    portal?: string;
    cpf?: string;
  } | null;
  sessionId?: string | null;
  conversationId?: string | null;
  arquivos?: ArquivoIn[] | null;
};

/**
 * Processa UM job de análise (rodado pelo worker): monta 100% dos dados a partir
 * dos chunks, roda a IA e grava o resultado em analysis_jobs.result. Se o destino
 * inclui chat, posta na conversa. Idempotente (não reprocessa 'concluido').
 */
export async function processAnalyzeJob(jobId: string): Promise<void> {
  const db = createAdminClient();
  const { data: job } = await db.from("analysis_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return;
  if (job.status === "concluido") return;
  await db.from("analysis_jobs").update({ status: "analisando", updated_at: new Date().toISOString() }).eq("id", jobId);

  try {
    const { data: chunks } = await db.from("analysis_chunks").select("seq, rows").eq("job_id", jobId).order("seq");
    const linhas: Linha[] = (chunks ?? []).flatMap((c) => (c.rows as Linha[]) ?? []);
    const colunas: string[] = (job.columns as string[] | null) ?? gerarColunas(linhas);
    const p = (job.params ?? {}) as AnalyzeParams;
    if (!linhas.length && !p.arquivos?.length) throw new Error("Sem dados nem arquivos para analisar.");

    const arq = p.arquivos?.length ? await interpretarArquivos(p.arquivos) : null;
    const resultado = await analisarDados({
      colunas,
      linhas,
      instrucao: (job.instrucao as string | null) ?? undefined,
      persona: p.persona ?? undefined,
      contextoArquivos: arq?.texto,
      imageParts: arq?.imageParts,
      fileParts: arq?.fileParts,
      llm: p.llm ?? undefined,
      meta: { kind: "system" },
    });

    const payload: Record<string, unknown> = {
      analise: resultado.analise,
      resumo: resultado.resumo,
      meta: { ...resultado.meta, ...(arq?.metas.length ? { arquivos: arq.metas } : {}) },
    };
    const destino = String(job.destino ?? "api");
    if (destino === "chat" || destino === "ambos") {
      const convId = await postarNoChat(db, job.space_id as string, p, resultado.analise, resultado.meta.linhas);
      if (convId) payload.conversationId = convId;
    }

    await db.from("analysis_jobs").update({ status: "concluido", result: payload as never, updated_at: new Date().toISOString() }).eq("id", jobId);
    await db.from("analysis_chunks").delete().eq("job_id", jobId);
  } catch (e) {
    await db.from("analysis_jobs").update({ status: "erro", error: (e as Error).message, updated_at: new Date().toISOString() }).eq("id", jobId);
    throw e; // deixa o pg-boss registrar a retentativa
  }
}

function gerarColunas(linhas: Linha[]): string[] {
  const primeira = linhas[0];
  if (primeira && !Array.isArray(primeira) && typeof primeira === "object") return Object.keys(primeira);
  const n = Array.isArray(primeira) ? primeira.length : 0;
  return Array.from({ length: n }, (_, i) => `col${i + 1}`);
}

async function identidadeParaTrack(spaceId: string, p: AnalyzeParams): Promise<TrackFields> {
  const doToken = (await decodeTrackForSpace(spaceId, p.track).catch(() => ({}))) as TrackFields;
  const crus: TrackFields = {};
  const id = p.identidade;
  if (id) {
    if (id.empresa != null) crus.p_empresa = String(id.empresa);
    if (id.matricula != null) crus.p_matricula = String(id.matricula);
    if (id.usuario != null) crus.p_usuario = String(id.usuario);
    if (id.perfil != null) crus.p_perfil = String(id.perfil);
    if (id.portal != null) crus.p_portal = String(id.portal);
  }
  return { ...doToken, ...crus };
}

async function postarNoChat(db: Db, spaceId: string, p: AnalyzeParams, analise: string, linhas: number): Promise<string | null> {
  const track = await identidadeParaTrack(spaceId, p);
  if (!Object.keys(track).length) return null; // sem sessão → não posta
  let convId = p.conversationId ?? null;
  if (!convId) {
    const { data: conv } = await db
      .from("conversations")
      .insert({ space_id: spaceId, session_id: p.sessionId ?? null, ...track })
      .select("id")
      .single();
    convId = conv?.id ?? null;
  }
  if (!convId) return null;
  await db.from("messages").insert({ conversation_id: convId, role: "user", content: `Análise dos dados enviados (${linhas} registros)` });
  await db.from("messages").insert({ conversation_id: convId, role: "assistant", content: analise });
  return convId;
}
