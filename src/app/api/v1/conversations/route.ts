import type { NextRequest } from "next/server";
import { resolveWidgetKey, originAllowed, corsHeaders, clientIp, extractKey, rateLimitOk } from "@/lib/widget/auth";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderReport } from "@/lib/reports/exporters";
import { resolveMedia } from "@/lib/chat/history-store";
import { normalizeSpec } from "@/lib/chat/chart-spec";
import type { ReportSpec, ReportBlock, ReportFormat } from "@/lib/reports/report-spec";
import type { BrandInfo } from "@/lib/reports/pdf";

/**
 * POST /api/v1/conversations — Histórico de conversas do usuário do widget.
 *
 * Mesma auth/isolamento dos relatórios salvos: valida a CHAVE pública + o TOKEN de
 * rastreio (identidade confiável), resolve o escopo do usuário (space_id + userRef)
 * e lê/escreve com service-role. Um id sozinho NUNCA basta — tudo filtra por escopo.
 *
 * Ações (`action`):
 *   list   → { ok, itens: [{ id, created_at, disclaimer, title, subtitle, mensagens }] }
 *   get    → { id } → { ok, id, created_at, disclaimer, page, mensagens: [{ role, content, created_at }] }
 *   delete → { id } → { ok }  (as mensagens caem por ON DELETE CASCADE)
 *   export → { id, formato: 'docx'|'pdf'|'csv' } → { ok, filename, mime, content(base64) }
 */
export const runtime = "nodejs";

// Subtítulo dos arquivos exportados do histórico (ressalva global da IA).
const RESSALVA_EXPORT = "Sou uma IA e posso cometer enganos — sempre valide as informações.";
const MAX_CONVERSAS = 100; // teto da listagem
const MAX_MSGS_LISTA = 1000; // teto real do PostgREST; subtítulo/contagem são best-effort (o título vem da coluna)
const MAX_MSGS_EXPORT = 500; // teto de mensagens por arquivo exportado
const MAX_TXT_MSG = 8000; // teto de caracteres por mensagem exportada
const FORMATOS_EXPORT: ReportFormat[] = ["docx", "pdf", "csv"];

function corta(s: string, n: number): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

  let p: {
    action?: unknown; key?: unknown; track?: unknown; id?: unknown; formato?: unknown;
    conversationId?: unknown; pergunta?: unknown; escolha?: unknown; chart?: unknown;
  };
  try { p = await req.json(); } catch { return json({ ok: false, erro: "JSON inválido." }, 400); }

  const key = await resolveWidgetKey(extractKey(req, p.key));
  if (!key) return json({ ok: false, erro: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) return json({ ok: false, erro: "Origem não autorizada." }, 403);
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) return json({ ok: false, erro: "Muitas requisições. Tente em instantes." }, 429);

  // Identidade do usuário via token de rastreio — escopo do histórico.
  const track = await decodeTrackForSpace(key.space_id, p.track);
  const ident = String(track.p_usuario || track.p_matricula || "").trim();
  if (!ident) return json({ ok: false, erro: "Sem identidade no rastreio — não sei de quem é a conversa." }, 400);
  const userRef = `${String(track.p_base || "").trim()}:${ident}`;

  const db = createAdminClient();
  const action = String(p.action ?? "").trim();

  if (action === "list") {
    const { data: convs, error } = await db
      .from("conversations")
      .select("id, created_at, disclaimer, page, title")
      .eq("space_id", key.space_id)
      .eq("widget_user_ref", userRef)
      .order("created_at", { ascending: false })
      .limit(MAX_CONVERSAS);
    if (error) { console.error("[conversations] list:", error); return json({ ok: false, erro: "Falha ao listar.", detalhe: error.message }, 500); }
    const lista = convs ?? [];
    if (!lista.length) return json({ ok: true, itens: [] }, 200);

    // O TÍTULO vem da coluna (robusto). Subtítulo (1ª resposta) e contagem são
    // best-effort num lote de mensagens — o PostgREST teto em 1000 linhas, então em
    // volumes altos alguns podem faltar, mas o título nunca falha. Ver [[tree-1000-row-cap]].
    const ids = lista.map((c) => c.id);
    const { data: msgs } = await db
      .from("messages")
      .select("conversation_id, role, content, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: true })
      .limit(MAX_MSGS_LISTA);
    const primeiroUser: Record<string, string> = {};
    const primeiroAssist: Record<string, string> = {};
    const conta: Record<string, number> = {};
    for (const m of msgs ?? []) {
      const cid = m.conversation_id;
      conta[cid] = (conta[cid] ?? 0) + 1;
      if (m.role === "user" && !primeiroUser[cid]) primeiroUser[cid] = String(m.content ?? "");
      else if (m.role === "assistant" && !primeiroAssist[cid]) primeiroAssist[cid] = String(m.content ?? "");
    }
    const itens = lista.map((c) => {
      const pageObj = c.page && typeof c.page === "object" ? (c.page as { title?: unknown; path?: unknown }) : null;
      const pageTitle = pageObj ? String(pageObj.title ?? pageObj.path ?? "").trim() : "";
      return {
        id: c.id,
        created_at: c.created_at,
        disclaimer: c.disclaimer ?? null,
        title: corta(c.title || primeiroUser[c.id] || pageTitle || "Conversa", 90),
        subtitle: corta(primeiroAssist[c.id] || pageTitle || "", 130),
        mensagens: conta[c.id] ?? 0,
      };
    });
    return json({ ok: true, itens }, 200);
  }

  if (action === "get") {
    const id = String(p.id ?? "");
    if (!id) return json({ ok: false, erro: "Informe o id." }, 400);
    const { data: conv, error } = await db
      .from("conversations")
      .select("id, created_at, disclaimer, p_usuario, p_matricula, p_empresa")
      .eq("id", id)
      .eq("space_id", key.space_id)
      .eq("widget_user_ref", userRef)
      .maybeSingle();
    if (error) { console.error("[conversations] get:", error); return json({ ok: false, erro: "Falha ao carregar.", detalhe: error.message }, 500); }
    if (!conv) return json({ ok: false, erro: "Conversa não encontrada." }, 404);
    const { data: msgs } = await db
      .from("messages")
      .select("role, content, created_at, citations, media, attachments")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(MAX_MSGS_EXPORT);
    // Reidrata a mídia (gráficos inline + arquivos como URL assinada) igual ao chat.
    const mensagens = [];
    for (const m of msgs ?? []) {
      if (m.role !== "user" && m.role !== "assistant") continue;
      const media = await resolveMedia(db, m.media);
      mensagens.push({
        role: m.role,
        content: m.content,
        created_at: m.created_at,
        ...(Array.isArray(m.citations) && m.citations.length ? { citations: m.citations } : {}),
        ...(Array.isArray(m.attachments) && m.attachments.length ? { attachments: m.attachments } : {}),
        ...(media.length ? { media } : {}),
      });
    }
    // Identificador do usuário da conversa (nome/usuário → matrícula) + empresa.
    const usuario = String(conv.p_usuario || conv.p_matricula || "").trim();
    return json({
      ok: true,
      id: conv.id,
      created_at: conv.created_at,
      disclaimer: conv.disclaimer ?? null,
      usuario: usuario || null,
      empresa: (conv.p_empresa ? String(conv.p_empresa) : null),
      mensagens,
    }, 200);
  }

  if (action === "delete") {
    const id = String(p.id ?? "");
    if (!id) return json({ ok: false, erro: "Informe o id." }, 400);
    const { error } = await db
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("space_id", key.space_id)
      .eq("widget_user_ref", userRef);
    if (error) { console.error("[conversations] delete:", error); return json({ ok: false, erro: "Falha ao apagar.", detalhe: error.message }, 500); }
    return json({ ok: true }, 200);
  }

  // Registra uma ESCOLHA por botão (pergunta do agente + opção clicada + gráfico opcional)
  // como mensagens da conversa, para o Q&A dos botões ficar no HISTÓRICO ao reabrir.
  if (action === "append") {
    const convId = String(p.conversationId ?? p.id ?? "");
    if (!convId) return json({ ok: false, erro: "Informe a conversa." }, 400);
    const { data: conv } = await db
      .from("conversations")
      .select("id")
      .eq("id", convId)
      .eq("space_id", key.space_id)
      .eq("widget_user_ref", userRef)
      .maybeSingle();
    if (!conv) return json({ ok: false, erro: "Conversa não encontrada." }, 404);
    const pergunta = String(p.pergunta ?? "").trim().slice(0, 2000);
    const escolha = String(p.escolha ?? "").trim().slice(0, 500);
    const chart = p.chart && typeof p.chart === "object" ? p.chart : null;
    // created_at CRESCENTE (pergunta → escolha → gráfico) para a ordem no histórico ser estável.
    const base = Date.now();
    const linhas: { conversation_id: string; role: string; content: string; media?: unknown; created_at: string }[] = [];
    if (pergunta) linhas.push({ conversation_id: convId, role: "assistant", content: pergunta, created_at: new Date(base).toISOString() });
    if (escolha) linhas.push({ conversation_id: convId, role: "user", content: escolha, created_at: new Date(base + 1).toISOString() });
    if (chart) linhas.push({ conversation_id: convId, role: "assistant", content: "", media: [{ kind: "chart", spec: chart }], created_at: new Date(base + 2).toISOString() });
    if (!linhas.length) return json({ ok: true }, 200);
    const { error } = await db.from("messages").insert(linhas as never);
    if (error) { console.error("[conversations] append:", error); return json({ ok: false, erro: "Falha ao registrar.", detalhe: error.message }, 500); }
    return json({ ok: true }, 200);
  }

  if (action === "export") {
    const id = String(p.id ?? "");
    if (!id) return json({ ok: false, erro: "Informe o id." }, 400);
    const formato = (FORMATOS_EXPORT as string[]).includes(String(p.formato)) ? (p.formato as ReportFormat) : "pdf";
    const { data: conv, error } = await db
      .from("conversations")
      .select("id, created_at, disclaimer, p_usuario, p_matricula")
      .eq("id", id)
      .eq("space_id", key.space_id)
      .eq("widget_user_ref", userRef)
      .maybeSingle();
    if (error) { console.error("[conversations] export:", error); return json({ ok: false, erro: "Falha ao carregar.", detalhe: error.message }, 500); }
    if (!conv) return json({ ok: false, erro: "Conversa não encontrada." }, 404);
    const { data: msgs } = await db
      .from("messages")
      .select("role, content, created_at, media")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(MAX_MSGS_EXPORT);
    const lista = (msgs ?? []).filter((m) => m.role === "user" || m.role === "assistant");
    if (!lista.length) return json({ ok: false, erro: "Conversa sem mensagens para exportar." }, 400);

    const usuarioExp = String(conv.p_usuario || conv.p_matricula || "").trim();
    const rotuloUser = usuarioExp ? `Usuário (${usuarioExp})` : "Usuário";
    const titulo = corta(lista.find((m) => m.role === "user")?.content ?? "Conversa", 120) || "Conversa";
    const dataIni = new Date(conv.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const blocos: ReportBlock[] = [];
    // Cabeçalho: data de início + ressalva do agente (quando houver).
    const introLinhas = [`_Conversa iniciada em ${dataIni}._`];
    if (conv.disclaimer) introLinhas.push("", `**Ressalva do agente:** ${conv.disclaimer}`);
    blocos.push({ tipo: "texto", texto: introLinhas.join("\n") });
    for (const m of lista) {
      // Cabeçalho da mensagem: QUEM (usuário identificado × assistente) + QUANDO.
      const label = m.role === "user" ? rotuloUser : "Assistente (IA)";
      const quando = m.created_at ? new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
      const cab = `**${label}**${quando ? ` — _${quando}_` : ""}`;
      const corpo = corta(m.content ?? "", MAX_TXT_MSG);
      blocos.push({ tipo: "texto", texto: corpo ? `${cab}\n\n${corpo}` : cab });
      // Mídia: gráfico vira bloco de gráfico; arquivo vira nota (não dá p/ embutir binário).
      const media = await resolveMedia(db, m.media);
      for (const it of media) {
        if (it.kind === "chart") {
          const g = normalizeSpec(it.spec);
          if (g) blocos.push({ tipo: "grafico", grafico: g });
        } else if (it.kind === "file") {
          blocos.push({ tipo: "texto", texto: `_[arquivo anexado: ${it.filename}]_` });
        }
      }
    }
    const spec: ReportSpec = { titulo, subtitulo: RESSALVA_EXPORT, formato, blocos };
    const brand: BrandInfo = {
      marca: (key.config?.title as string) || "Conversa",
      primariaHex: (key.config?.primaryColor as string) || "#511C76",
      dataHoje: "Gerado em " + new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    };
    try {
      const out = await renderReport(spec, brand);
      return json({ ok: true, filename: out.filename, mime: out.mimeType, content: out.base64 }, 200);
    } catch (e) {
      console.error("[conversations] export render:", e);
      return json({ ok: false, erro: "Falha ao gerar o arquivo." }, 500);
    }
  }

  return json({ ok: false, erro: "Ação desconhecida." }, 400);
}
