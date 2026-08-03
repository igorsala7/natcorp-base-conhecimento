import "server-only";
import { generateText } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeTrackForSpace, type TrackFields } from "@/lib/tracking/resolve";
import { chatModel, aiTimeout, ehTimeout, type UsageMeta } from "@/lib/ai/config";
import { generateObjectResiliente } from "@/lib/ai/generate";
import { chunkSchema, CHUNK_SIZE } from "@/lib/chat/analysis-router";
import { readDatasetRows } from "@/lib/widget/dataset-store";

type Db = ReturnType<typeof createAdminClient>;
const now = () => new Date().toISOString();
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Processa UM job de análise SEMÂNTICA (modo B) — rodado pelo worker.
 *
 * Lê o dataset SEMPRE filtrando pelo escopo DO JOB (space_id + user_ref → isolamento),
 * classifica o texto da coluna-alvo em lotes (map, saída estruturada), agrega em código
 * (reduce EXATO) e escreve uma síntese. Atribui o consumo AO USUÁRIO (kind:"user" +
 * p_* re-derivados do token cifrado do job). Idempotente (não reprocessa 'done').
 */
export async function processSemanticJob(jobId: string): Promise<void> {
  const db = createAdminClient();
  const { data: job } = await db.from("widget_analysis_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return;
  if (job.status === "done") return;
  await db.from("widget_analysis_jobs").update({ status: "running", updated_at: now() }).eq("id", jobId);

  try {
    // Dataset SEMPRE no escopo do job (um id sozinho nunca basta — nada vaza entre usuários).
    const { data: ds } = await db
      .from("widget_datasets")
      .select("columns, rows, storage_path")
      .eq("id", job.dataset_id)
      .eq("space_id", job.space_id)
      .eq("user_ref", job.user_ref)
      .maybeSingle();
    if (!ds || !Array.isArray(ds.columns)) throw new Error("Dataset não encontrado no escopo do usuário.");
    const colunas = (ds.columns as unknown[]).map(String);
    // Linhas do Storage (gzip) quando grande; senão inline em `rows`.
    const linhas = await readDatasetRows(db, ds);
    if (!linhas.length) throw new Error("Dataset vazio no escopo do usuário.");
    const idxAlvo = colunas.findIndex((c) => norm(c) === norm(job.target_column));
    if (idxAlvo < 0) throw new Error(`Coluna "${job.target_column}" não encontrada no dataset.`);
    const rotulos = (Array.isArray(job.rotulos) ? (job.rotulos as unknown[]) : []).map(String).filter(Boolean);
    if (!rotulos.length) throw new Error("Sem rótulos de classificação.");
    const criterio = String(job.instrucao ?? "").trim() || "classifique o conteúdo";

    const track = await identidadeTrack(job.space_id, job.track);
    const meta: UsageMeta = { kind: "user", ...track };
    const model = await chatModel(meta, track.p_base ?? "");
    const schema = chunkSchema(rotulos);
    const total = linhas.length;

    // ── MAP: classifica em lotes; grava o parcial (idempotente) e o progresso. ──
    const classificados: { rotulo: string; motivo: string | null }[] = [];
    let seq = 0;
    for (let start = 0; start < total; start += CHUNK_SIZE) {
      const lote = linhas.slice(start, start + CHUNK_SIZE);
      const textos = lote.map((r, k) => `${k}\t${String(r[idxAlvo] ?? "").slice(0, 500)}`).join("\n");
      let itens: { i: number; rotulo: string; confianca: string; motivo: string | null }[] = [];
      try {
        const { object } = await generateObjectResiliente({
          model,
          schema,
          abortSignal: aiTimeout("chat"),
          prompt:
            `Classifique CADA item pelo critério: "${criterio}".\n` +
            `Rótulos permitidos (use EXATAMENTE um por item): ${rotulos.join(", ")}.\n` +
            `Responda um objeto por item, com "i" = o índice de entrada. Seja consistente e conciso no "motivo".\n\n` +
            `ITENS (i<TAB>texto):\n${textos}`,
        });
        itens = object.itens ?? [];
      } catch (e) {
        if (ehTimeout(e)) { /* lote em timeout → segue; entra como não-classificado */ }
      }
      for (const it of itens) {
        const k = Number(it.i);
        if (k >= 0 && k < lote.length && rotulos.includes(String(it.rotulo))) {
          classificados.push({ rotulo: String(it.rotulo), motivo: it.motivo ? String(it.motivo) : null });
        }
      }
      await db.from("widget_analysis_chunks").upsert({ job_id: jobId, seq, result: itens as never }, { onConflict: "job_id,seq" });
      seq++;
      const processed = Math.min(total, start + CHUNK_SIZE);
      await db.from("widget_analysis_jobs").update({ processed, total, progress: total ? Math.round((processed / total) * 90) : 90, updated_at: now() }).eq("id", jobId);
    }
    // Muitos lotes falharam → não entrega um resultado enganoso (deixa o pg-boss retentar).
    if (total > 0 && classificados.length < total * 0.5) throw new Error("Falha ao classificar a maior parte dos registros — tente novamente.");

    // ── REDUCE (em código): distribuição EXATA + exemplos por rótulo. ──
    const distribuicao: Record<string, number> = {};
    for (const r of rotulos) distribuicao[r] = 0;
    const exemplos: Record<string, string[]> = {};
    for (const c of classificados) {
      distribuicao[c.rotulo] = (distribuicao[c.rotulo] ?? 0) + 1;
      if (c.motivo) { (exemplos[c.rotulo] ??= []); if (exemplos[c.rotulo]!.length < 5) exemplos[c.rotulo]!.push(c.motivo); }
    }
    const naoClassificados = total - classificados.length;
    const distTxt = Object.entries(distribuicao).map(([k, v]) => `${k}: ${v} (${total ? Math.round((v / total) * 100) : 0}%)`).join(" | ");

    // ── SÍNTESE (texto) ancorada na distribuição exata. ──
    const { text } = await generateText({
      model,
      abortSignal: aiTimeout("chat"),
      maxOutputTokens: 1400,
      system:
        "Você é um analista sênior (pt-BR). Escreva uma conclusão OBJETIVA baseada SOMENTE na distribuição EXATA e nos exemplos fornecidos. " +
        "Não invente números. Seja direto: responda a pergunta (ex.: 'há alto grau?'), destaque o que chama atenção e dê uma recomendação curta.",
      prompt:
        `Critério analisado por linha: "${criterio}" sobre ${total} registros` +
        (naoClassificados ? ` (${naoClassificados} não classificados)` : "") + `.\n\n` +
        `DISTRIBUIÇÃO EXATA: ${distTxt}\n\n` +
        `EXEMPLOS de motivos por rótulo:\n${Object.entries(exemplos).map(([k, v]) => `- ${k}: ${v.slice(0, 3).join(" ; ")}`).join("\n") || "(sem exemplos)"}`,
    });
    const narrativa = text.trim();

    const result = { distribuicao, exemplos, narrativa, total, naoClassificados, criterio, coluna: job.target_column };
    const convId = await postarNoChat(db, job, narrativa);
    await db
      .from("widget_analysis_jobs")
      .update({ status: "done", progress: 100, processed: total, result: { ...result, conversationId: convId } as never, updated_at: now() })
      .eq("id", jobId);
    await db.from("widget_analysis_chunks").delete().eq("job_id", jobId);
  } catch (e) {
    await db.from("widget_analysis_jobs").update({ status: "error", error: (e as Error).message, updated_at: now() }).eq("id", jobId);
    throw e; // deixa o pg-boss registrar a retentativa
  }
}

async function identidadeTrack(spaceId: string, token: unknown): Promise<TrackFields> {
  return (await decodeTrackForSpace(spaceId, token).catch(() => ({}))) as TrackFields;
}

/** Posta a análise na conversa do usuário (escopo por track). Cria a conversa se preciso. */
async function postarNoChat(
  db: Db,
  job: { space_id: string; conversation_id: string | null; session_id: string | null; track: string | null; total: number },
  analise: string,
): Promise<string | null> {
  const track = await identidadeTrack(job.space_id, job.track);
  if (!Object.keys(track).length) return null; // sem identidade → não posta
  let convId = job.conversation_id ?? null;
  if (!convId) {
    const { data: conv } = await db
      .from("conversations")
      .insert({ space_id: job.space_id, session_id: job.session_id ?? null, ...track })
      .select("id")
      .single();
    convId = conv?.id ?? null;
  }
  if (!convId) return null;
  await db.from("messages").insert({ conversation_id: convId, role: "assistant", content: analise });
  return convId;
}
