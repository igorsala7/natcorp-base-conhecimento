import type { NextRequest } from "next/server";
import { resolveWidgetKey, originAllowed, corsHeaders, clientIp, extractKey, rateLimitOk } from "@/lib/widget/auth";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/database.types";
import { embedMany } from "ai";
import { embeddingModel, embeddingCallOptions } from "@/lib/ai/config";

type SavedInsert = Database["public"]["Tables"]["widget_saved_reports"]["Insert"];

/**
 * POST /api/v1/saved-reports — CRUD dos relatórios salvos do usuário do widget.
 *
 * O widget não fala com o banco (origem diferente + sem service-role no browser).
 * Esta rota valida a CHAVE pública do widget + o TOKEN de rastreio (identidade
 * confiável), resolve o escopo do usuário e grava/lê com service-role.
 *
 * Ações (campo `action`): "save" | "list" | "get" | "delete".
 *   save   → { name, columns[], rows[][], total, sourceName } → { ok, id, name, created_at }
 *   list   → { ok, itens: [{ id, name, source_name, total, created_at }] }  (sem linhas)
 *   get    → { id } → { ok, id, name, source_name, columns, rows, total, created_at }
 *   delete → { id } → { ok }
 */
export const runtime = "nodejs";

const MAX_ROWS = 20000; // teto por relatório salvo (evita jsonb gigante)
const MAX_FILE_B64 = 12_000_000; // ~9 MB de arquivo em base64 (teto de segurança)

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
    name?: unknown; sourceName?: unknown; columns?: unknown; rows?: unknown; total?: unknown;
    kind?: unknown; fileName?: unknown; mime?: unknown; content?: unknown; chart?: unknown; origem?: unknown;
    message?: unknown; relatorioIds?: unknown; modo?: unknown;
  };
  try { p = await req.json(); } catch { return json({ ok: false, erro: "JSON inválido." }, 400); }

  const key = await resolveWidgetKey(extractKey(req, p.key));
  if (!key) return json({ ok: false, erro: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) return json({ ok: false, erro: "Origem não autorizada." }, 403);
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) return json({ ok: false, erro: "Muitas requisições. Tente em instantes." }, 429);

  // Identidade do usuário via token de rastreio — escopo dos relatórios salvos.
  const track = await decodeTrackForSpace(key.space_id, p.track);
  const ident = String(track.p_usuario || track.p_matricula || "").trim();
  if (!ident) return json({ ok: false, erro: "Sem identidade no rastreio — não sei de quem é o relatório." }, 400);
  const userRef = `${String(track.p_base || "").trim()}:${ident}`;

  const db = createAdminClient();
  const action = String(p.action ?? "").trim();

  if (action === "save") {
    const name = String(p.name ?? "").trim().slice(0, 200);
    if (!name) return json({ ok: false, erro: "Informe um nome." }, 400);
    const kind = p.kind === "file" || p.kind === "chart" ? p.kind : "report";
    const columns = Array.isArray(p.columns) ? p.columns.map((c) => String(c)).slice(0, 300) : [];
    const rows = Array.isArray(p.rows)
      ? (p.rows as unknown[]).slice(0, MAX_ROWS).map((r) => (Array.isArray(r) ? r.map((c) => (c == null ? "" : String(c))) : []))
      : [];
    const registro: SavedInsert = {
      space_id: key.space_id,
      widget_key_id: key.id,
      user_ref: userRef,
      name,
      kind,
      source_name: String(p.sourceName ?? "").slice(0, 200) || null,
      columns,
      rows,
      total: typeof p.total === "number" && Number.isFinite(p.total) ? p.total : rows.length,
      // "upload" só quando o widget marca (arquivo enviado pelo usuário); o resto é gerado.
      origem: p.origem === "upload" ? "upload" : "gerado",
    };
    if (kind === "file") {
      const content = String(p.content ?? "");
      const fileName = String(p.fileName ?? name).slice(0, 200);
      if (!content) return json({ ok: false, erro: "Arquivo sem conteúdo." }, 400);
      if (content.length > MAX_FILE_B64) return json({ ok: false, erro: "Arquivo grande demais para salvar." }, 413);
      registro.file_name = fileName;
      registro.mime = String(p.mime ?? "").slice(0, 120) || null;
      registro.content = content;
    } else if (kind === "chart") {
      if (!p.chart || typeof p.chart !== "object") return json({ ok: false, erro: "Gráfico sem dados." }, 400);
      registro.chart = p.chart as Json;
    } else {
      if (!columns.length || !rows.length) return json({ ok: false, erro: "Não há dados coletados para salvar." }, 400);
    }
    const { data, error } = await db.from("widget_saved_reports").insert(registro).select("id, name, created_at").single();
    if (error || !data) { console.error("[saved-reports] save:", error); return json({ ok: false, erro: "Falha ao salvar.", detalhe: error?.message }, 500); }
    return json({ ok: true, id: data.id, name: data.name, created_at: data.created_at }, 200);
  }

  if (action === "list") {
    const { data, error } = await db
      .from("widget_saved_reports")
      .select("id, name, kind, source_name, file_name, mime, columns, total, created_at, origem")
      .eq("space_id", key.space_id)
      .eq("user_ref", userRef)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { console.error("[saved-reports] list:", error); return json({ ok: false, erro: "Falha ao listar.", detalhe: error.message }, 500); }
    return json({ ok: true, itens: data ?? [] }, 200);
  }

  if (action === "get") {
    const id = String(p.id ?? "");
    if (!id) return json({ ok: false, erro: "Informe o id." }, 400);
    const { data, error } = await db
      .from("widget_saved_reports")
      .select("id, name, kind, source_name, file_name, mime, content, chart, columns, rows, total, created_at")
      .eq("id", id)
      .eq("space_id", key.space_id)
      .eq("user_ref", userRef)
      .maybeSingle();
    if (error) { console.error("[saved-reports] get:", error); return json({ ok: false, erro: "Falha ao carregar.", detalhe: error.message }, 500); }
    if (!data) return json({ ok: false, erro: "Relatório não encontrado." }, 404);
    return json({ ok: true, ...data }, 200);
  }

  // Relevância SEMÂNTICA: dos relatórios salvos HOJE, quais fazem sentido com a
  // mensagem do usuário (embedding da mensagem × descritor de cada item). Usado para
  // só oferecer o cruzamento quando é pertinente. Degrada com `fallback` (léxico).
  if (action === "relevantes") {
    const message = String(p.message ?? "").trim();
    const hojeStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const inicioHoje = new Date(`${hojeStr}T00:00:00-03:00`).toISOString();
    const { data, error } = await db
      .from("widget_saved_reports")
      .select("id, name, kind, source_name, file_name, columns, total, created_at")
      .eq("space_id", key.space_id)
      .eq("user_ref", userRef)
      .gte("created_at", inicioHoje)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) { console.error("[saved-reports] relevantes:", error); return json({ ok: true, temHoje: false, itens: [] }, 200); }
    const itens = data ?? [];
    if (!itens.length || !message) return json({ ok: true, temHoje: itens.length > 0, itens: [] }, 200);
    const descritor = (it: (typeof itens)[number]) =>
      [it.name, it.source_name, Array.isArray(it.columns) ? (it.columns as unknown[]).join(" ") : "", it.file_name]
        .filter(Boolean).join(" — ").slice(0, 500);
    try {
      const { embeddings } = await embedMany({
        model: await embeddingModel(),
        values: [message, ...itens.map(descritor)],
        providerOptions: await embeddingCallOptions(),
      });
      const q = embeddings[0] ?? [];
      const sim = (a: readonly number[], b: readonly number[]) => {
        let d = 0, na = 0, nb = 0;
        for (let i = 0; i < a.length; i++) { const x = a[i] ?? 0, y = b[i] ?? 0; d += x * y; na += x * x; nb += y * y; }
        return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
      };
      const LIMIAR = 0.33; // cosseno (text-embedding-3-small): relacionados ≳0.33
      const rel = itens
        .map((it, i) => ({ it, s: sim(q, embeddings[i + 1] ?? []) }))
        .filter((x) => x.s >= LIMIAR)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.it);
      return json({ ok: true, temHoje: true, itens: rel }, 200);
    } catch (e) {
      console.error("[saved-reports] embed relevância falhou:", e);
      return json({ ok: true, temHoje: true, fallback: true, itens }, 200); // widget cai no léxico
    }
  }

  // Seleção da "Base de Dados" (fontes) persistida por usuário.
  if (action === "base_get") {
    const { data } = await db
      .from("widget_base_selection")
      .select("relatorio_ids, modo")
      .eq("space_id", key.space_id)
      .eq("user_ref", userRef)
      .maybeSingle();
    return json({ ok: true, relatorioIds: (data?.relatorio_ids as unknown[]) ?? [], modo: data?.modo ?? "completa" }, 200);
  }
  if (action === "base_set") {
    const relatorioIds = Array.isArray(p.relatorioIds) ? p.relatorioIds.map((x) => String(x)).slice(0, 100) : [];
    const modo = p.modo === "exclusiva" ? "exclusiva" : "completa";
    const { error } = await db
      .from("widget_base_selection")
      .upsert({ space_id: key.space_id, user_ref: userRef, relatorio_ids: relatorioIds, modo, updated_at: new Date().toISOString() }, { onConflict: "space_id,user_ref" });
    if (error) { console.error("[saved-reports] base_set:", error); return json({ ok: false, erro: "Falha ao salvar a seleção.", detalhe: error.message }, 500); }
    return json({ ok: true }, 200);
  }

  if (action === "delete") {
    const id = String(p.id ?? "");
    if (!id) return json({ ok: false, erro: "Informe o id." }, 400);
    const { error } = await db
      .from("widget_saved_reports")
      .delete()
      .eq("id", id)
      .eq("space_id", key.space_id)
      .eq("user_ref", userRef);
    if (error) { console.error("[saved-reports] delete:", error); return json({ ok: false, erro: "Falha ao apagar.", detalhe: error.message }, 500); }
    return json({ ok: true }, 200);
  }

  return json({ ok: false, erro: "Ação desconhecida." }, 400);
}
