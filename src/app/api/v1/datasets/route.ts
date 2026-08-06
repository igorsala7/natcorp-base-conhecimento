import type { NextRequest } from "next/server";
import { resolveWidgetKey, originAllowed, corsHeaders, clientIp, extractKey, rateLimitOk } from "@/lib/widget/auth";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import { createAdminClient } from "@/lib/supabase/admin";
import { putDatasetRows, readDatasetRows, removeDatasetObject } from "@/lib/widget/dataset-store";
import type { Database } from "@/lib/database.types";
import { celulaDataset } from "@/lib/chat/dataset-sanitize";

type DatasetInsert = Database["public"]["Tables"]["widget_datasets"]["Insert"];

/**
 * POST /api/v1/datasets — persiste o CONJUNTO coletado do relatório por id, no escopo
 * do usuário (Fase F1 da análise A/B). O widget coleta uma vez, salva aqui e passa a
 * mandar só o `id` no chat — o servidor rehidrata o dataset por id (registrarTabelaTela)
 * e as ferramentas de análise funcionam igual, sem reenviar todas as linhas por turno.
 *
 * O widget não fala com o banco: esta rota valida a CHAVE pública do widget + o TOKEN
 * de rastreio (identidade confiável), resolve o escopo (space_id, user_ref) e grava/lê
 * com service-role. ISOLAMENTO POR USUÁRIO: toda query filtra por space_id + user_ref.
 *
 * Ações (`action`): "save" | "get" | "delete".
 *   save   → { clientKey, sourceName?, columns[], rows[][], total? } → { ok, id, total }
 *   get    → { id } → { ok, id, source_name, columns, rows, total, created_at }
 *   delete → { id } → { ok }
 */
export const runtime = "nodejs";

const MAX_ROWS = 100_000; // teto de linhas por dataset (casa com p_amostra_linhas do Oracle)
const MAX_BYTES = 42_000_000; // ~40 MB de `rows` serializado (guarda de segurança do jsonb)

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

  let p: {
    action?: unknown; key?: unknown; track?: unknown; id?: unknown;
    clientKey?: unknown; sourceName?: unknown; columns?: unknown; rows?: unknown; total?: unknown;
  };
  try { p = await req.json(); } catch { return json({ ok: false, erro: "JSON inválido." }, 400); }

  const key = await resolveWidgetKey(extractKey(req, p.key));
  if (!key) return json({ ok: false, erro: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) return json({ ok: false, erro: "Origem não autorizada." }, 403);
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) return json({ ok: false, erro: "Muitas requisições. Tente em instantes." }, 429);

  // Identidade via token de rastreio — escopo dos datasets. Vazia → recusa (nunca usa
  // sessionId como identidade: é gerado no browser e adivinhável).
  const track = await decodeTrackForSpace(key.space_id, p.track);
  const ident = String(track.p_usuario || track.p_matricula || "").trim();
  if (!ident) return json({ ok: false, erro: "Sem identidade no rastreio — não sei de quem é o dataset." }, 400);
  const userRef = `${String(track.p_base || "").trim()}:${ident}`;

  const db = createAdminClient();
  const action = String(p.action ?? "").trim();

  if (action === "save") {
    // client_key nunca vazio: garante a unicidade por (usuário, relatório+filtro).
    const clientKey = String(p.clientKey ?? "").trim() || crypto.randomUUID();
    // A tela às vezes manda NUL numa célula — o Postgres recusa (22P05) e o dataset
    // inteiro deixava de salvar, com 500. Limpa na entrada, coluna e linha.
    const columns = Array.isArray(p.columns) ? p.columns.map((c) => celulaDataset(c)).slice(0, 300) : [];
    const rows = Array.isArray(p.rows)
      ? (p.rows as unknown[]).slice(0, MAX_ROWS).map((r) => (Array.isArray(r) ? r.map((c) => celulaDataset(c)) : []))
      : [];
    if (!columns.length || !rows.length) return json({ ok: false, erro: "Dataset vazio (sem colunas/linhas)." }, 400);
    // Guarda de tamanho (teto absoluto). Acima do limiar inline, as linhas vão gzip p/ o
    // Storage (a coluna `rows` fica NULL) — evita o statement_timeout do JSONB gigante.
    const serialized = JSON.stringify(rows);
    if (serialized.length > MAX_BYTES) {
      return json({ ok: false, erro: "Conjunto grande demais para salvar — refine o filtro do relatório." }, 413);
    }
    let armazenado: { rows: string[][] | null; storagePath: string | null };
    try {
      armazenado = await putDatasetRows(db, { spaceId: key.space_id, userRef, clientKey, rows, serialized });
    } catch (e) {
      console.error("[datasets] storage:", e);
      return json({ ok: false, erro: "Falha ao salvar o dataset." }, 500);
    }
    const registro: DatasetInsert = {
      space_id: key.space_id,
      widget_key_id: key.id,
      user_ref: userRef,
      client_key: clientKey,
      source_name: String(p.sourceName ?? "").slice(0, 200) || null,
      columns,
      rows: armazenado.rows,
      storage_path: armazenado.storagePath,
      total: typeof p.total === "number" && Number.isFinite(p.total) ? p.total : rows.length,
    };
    const { data, error } = await db
      .from("widget_datasets")
      .upsert(registro, { onConflict: "space_id,user_ref,client_key" })
      .select("id, total")
      .single();
    if (error || !data) { console.error("[datasets] save:", error); return json({ ok: false, erro: "Falha ao salvar o dataset." }, 500); }
    return json({ ok: true, id: data.id, total: data.total }, 200);
  }

  if (action === "get") {
    const id = String(p.id ?? "");
    if (!id) return json({ ok: false, erro: "Informe o id." }, 400);
    const { data, error } = await db
      .from("widget_datasets")
      .select("id, source_name, columns, rows, storage_path, total, created_at")
      .eq("id", id)
      .eq("space_id", key.space_id)   // fronteira de isolamento: id sozinho NUNCA basta
      .eq("user_ref", userRef)
      .maybeSingle();
    if (error) { console.error("[datasets] get:", error); return json({ ok: false, erro: "Falha ao carregar o dataset." }, 500); }
    if (!data) return json({ ok: false, erro: "Dataset não encontrado." }, 404);
    // Linhas do Storage (gzip) quando grande; senão inline em `rows`.
    const rows = await readDatasetRows(db, data);
    return json({ ok: true, id: data.id, source_name: data.source_name, columns: data.columns, rows, total: data.total, created_at: data.created_at }, 200);
  }

  if (action === "delete") {
    const id = String(p.id ?? "");
    if (!id) return json({ ok: false, erro: "Informe o id." }, 400);
    // Lê o storage_path no escopo do usuário para limpar o blob junto com a linha.
    const { data: alvo } = await db
      .from("widget_datasets")
      .select("storage_path")
      .eq("id", id)
      .eq("space_id", key.space_id)
      .eq("user_ref", userRef)
      .maybeSingle();
    const { error } = await db
      .from("widget_datasets")
      .delete()
      .eq("id", id)
      .eq("space_id", key.space_id)
      .eq("user_ref", userRef);
    if (error) { console.error("[datasets] delete:", error); return json({ ok: false, erro: "Falha ao apagar o dataset." }, 500); }
    await removeDatasetObject(db, alvo?.storage_path);
    return json({ ok: true }, 200);
  }

  return json({ ok: false, erro: "Ação desconhecida." }, 400);
}
