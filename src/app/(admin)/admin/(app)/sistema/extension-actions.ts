"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, hasPermission, requirePermission } from "@/lib/auth/permissions";
import { generateExtToken, hashExtToken, extTokenPrefix } from "@/lib/ext/auth";
import { montarRascunho, criarNoRascunho, reHospedarPrint, type TrailEvent } from "@/lib/ext/assemble";
import { montarItensTimeline, agruparEmSecoes, type SecaoCaptura } from "@/lib/ext/timeline";
import { escreverSecaoDaCaptura } from "@/lib/ext/write";
import { deleteSessionData } from "@/lib/ext/retention";
import type { MediaRef } from "@/lib/studio/media";
import type { Block, BlockDoc } from "@/lib/blocks/schema";

export type ExtTokenRow = {
  id: string;
  label: string | null;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};
export type ExtSessionRow = {
  id: string;
  title: string | null;
  status: string;
  event_count: number;
  started_at: string;
  ended_at: string | null;
  node_id: string | null;
};
export type CreateTokenResult =
  | { ok: true; token: string; prefix: string }
  | { ok: false; error: string };

/** Gera um token pessoal de extensão. O valor cru só é devolvido AQUI, uma vez. */
export async function createExtensionToken(label?: string): Promise<CreateTokenResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sua sessão expirou. Recarregue a página." };
  const lbl = z.string().max(80).nullable().optional().safeParse(label ?? null);
  if (!lbl.success) return { ok: false, error: "Rótulo inválido." };

  const token = generateExtToken();
  const supabase = await createClient();
  const { error } = await supabase.from("extension_tokens").insert({
    user_id: user.id,
    label: lbl.data?.trim() || null,
    token_hash: hashExtToken(token),
    token_prefix: extTokenPrefix(token),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, token, prefix: extTokenPrefix(token) };
}

/** Tokens do usuário logado (nunca o valor cru — só o prefixo). */
export async function listExtensionTokens(): Promise<ExtTokenRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("extension_tokens")
    .select("id, label, token_prefix, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as ExtTokenRow[];
}

/** Revoga um token (marca `revoked_at`). A RLS garante que é do próprio usuário. */
export async function revokeExtensionToken(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await getSessionUser())) return { ok: false, error: "Sessão expirada." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("extension_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Sessões recentes do usuário logado (para conferir que a captura chegou). */
export async function listExtensionSessions(): Promise<ExtSessionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("extension_sessions")
    .select("id, title, status, event_count, started_at, ended_at, node_id")
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as ExtSessionRow[];
}

// ── Revisão de sessão (Fase 5.5) ─────────────────────────────────────────────
export type ReviewEvent = {
  id: string;
  kind: string;
  url: string | null;
  title: string | null;
  label: string | null;
  discarded: boolean;
  created_at: string;
  /** URL assinada do print (bucket privado) para exibir a miniatura. */
  thumbUrl: string | null;
};
export type SessionReview = {
  id: string;
  title: string | null;
  status: string;
  node_id: string | null;
  space_id: string | null;
  events: ReviewEvent[];
};

/** Sessão + eventos capturados (para revisar antes de gerar o rascunho). */
export async function getSessionReview(sessionId: string): Promise<SessionReview | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient(); // RLS: só a própria sessão/eventos
  const { data: sess } = await supabase
    .from("extension_sessions")
    .select("id, title, status, node_id, space_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!sess) return null;
  const { data: evs } = await supabase
    .from("extension_events")
    .select("id, kind, url, title, label, storage_path, discarded, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const admin = createAdminClient();
  const events: ReviewEvent[] = [];
  for (const e of evs ?? []) {
    let thumbUrl: string | null = null;
    if (e.kind === "shot" && e.storage_path) {
      const { data } = await admin.storage.from("imports").createSignedUrl(e.storage_path, 3600);
      thumbUrl = data?.signedUrl ?? null;
    }
    events.push({
      id: e.id,
      kind: e.kind,
      url: e.url,
      title: e.title,
      label: e.label,
      discarded: e.discarded,
      created_at: e.created_at,
      thumbUrl,
    });
  }
  return { id: sess.id, title: sess.title, status: sess.status, node_id: sess.node_id, space_id: sess.space_id, events };
}

/** Marca/desmarca um evento como descartado (não entra no rascunho). */
export async function toggleExtEvent(eventId: string, discarded: boolean): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sessão expirada." };
  const supabase = await createClient();
  // A RLS só devolve eventos das próprias sessões — confirma a posse.
  const { data: ev } = await supabase.from("extension_events").select("id").eq("id", eventId).maybeSingle();
  if (!ev) return { ok: false, error: "Evento não encontrado." };
  const admin = createAdminClient();
  const { error } = await admin.from("extension_events").update({ discarded }).eq("id", eventId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Exclui a sessão e seus arquivos brutos (prints/áudios). LGPD/retenção. */
export async function deleteExtensionSession(sessionId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sessão expirada." };
  const supabase = await createClient(); // RLS: só a própria sessão
  const { data: sess } = await supabase.from("extension_sessions").select("id, space_id").eq("id", sessionId).maybeSingle();
  if (!sess) return { ok: false, error: "Sessão não encontrada." };

  await deleteSessionData(sessionId);

  const admin = createAdminClient();
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "extension.session_delete",
    entity_type: "extension_session",
    entity_id: sessionId,
    space_id: sess.space_id,
  });
  revalidatePath("/admin/sistema");
  return { ok: true };
}

/** Documentações onde o usuário logado pode CRIAR conteúdo. */
export async function listAuthorSpaces(): Promise<{ id: string; name: string; type: string }[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data: spaces } = await supabase.from("spaces").select("id, name, type").order("type").order("name");
  const out: { id: string; name: string; type: string }[] = [];
  for (const s of spaces ?? []) {
    if (await hasPermission("content.create", s.id)) out.push({ id: s.id, name: s.name, type: s.type });
  }
  return out;
}

/** Gera o rascunho a partir da sessão, pelo admin (revisão), pulando descartados. */
export async function finalizeSessionAdmin(
  sessionId: string,
  spaceId: string,
  title: string,
): Promise<{ ok: true; nodeId: string } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sessão expirada." };
  if (!spaceId) return { ok: false, error: "Escolha a documentação de destino." };
  try {
    await requirePermission("content.create", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para criar conteúdo nessa documentação." };
  }
  const supabase = await createClient();
  const { data: sess } = await supabase.from("extension_sessions").select("id, status").eq("id", sessionId).maybeSingle();
  if (!sess) return { ok: false, error: "Sessão não encontrada." };
  if (sess.status !== "active") return { ok: false, error: "Esta sessão já foi finalizada." };

  const admin = createAdminClient();
  const { data: eventos } = await admin
    .from("extension_events")
    .select("kind, url, title, label, storage_path, created_at, t_ms, meta")
    .eq("session_id", sessionId)
    .eq("discarded", false)
    .order("created_at", { ascending: true });

  const doc = await montarRascunho(spaceId, (eventos ?? []) as TrailEvent[]);
  const criado = await criarNoRascunho(user.id, spaceId, null, title?.trim() || "Rascunho da captura", doc);
  if (!criado.ok) return criado;

  await admin
    .from("extension_sessions")
    .update({ status: "finalized", ended_at: new Date().toISOString(), space_id: spaceId, node_id: criado.nodeId })
    .eq("id", sessionId);
  revalidatePath("/admin/conteudo");
  return { ok: true, nodeId: criado.nodeId };
}

// ── Prévia por IA (req. 4a) ──────────────────────────────────────────────────
// Mostra, ANTES de salvar, o que a IA faz com o conteúdo capturado: monta o
// artigo SEÇÃO A SEÇÃO (uma por tela), cada uma aparecendo assim que fica pronta.

export type PreviewSecaoInfo = {
  idx: number;
  titulo: string;
  url: string | null;
  temNarracao: boolean;
  numPrints: number;
};
export type PreviewPlano =
  | { ok: true; titulo: string; secoes: PreviewSecaoInfo[] }
  | { ok: false; error: string };

/** Carrega os eventos mantidos e devolve as seções (por tela) + contexto das varreduras. */
async function carregarCaptura(sessionId: string): Promise<{ secoes: SecaoCaptura[]; contexto: string } | null> {
  const admin = createAdminClient();
  const { data: eventos } = await admin
    .from("extension_events")
    .select("kind, url, title, label, storage_path, created_at, t_ms, meta")
    .eq("session_id", sessionId)
    .eq("discarded", false)
    .order("created_at", { ascending: true });
  if (!eventos) return null;
  const secoes = agruparEmSecoes(montarItensTimeline(eventos as TrailEvent[]));
  const contexto = eventos
    .filter((e) => e.kind === "scan" && e.label)
    .map((e) => e.label)
    .join("\n\n")
    .slice(0, 6000);
  return { secoes, contexto };
}

/** Confere posse da sessão (RLS) + permissão de autoria; devolve o título ou um erro. */
async function autorizarPreview(sessionId: string, spaceId: string): Promise<{ ok: true; titulo: string } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sua sessão expirou. Recarregue a página." };
  if (!spaceId) return { ok: false, error: "Escolha a documentação de destino." };
  if (!(await hasPermission("content.create", spaceId)))
    return { ok: false, error: "Sem permissão para criar conteúdo nessa documentação." };
  const supabase = await createClient(); // RLS: só a própria sessão
  const { data: sess } = await supabase.from("extension_sessions").select("id, title").eq("id", sessionId).maybeSingle();
  if (!sess) return { ok: false, error: "Sessão não encontrada." };
  return { ok: true, titulo: sess.title ?? "Rascunho da captura" };
}

/** Passo 1 da prévia: o esqueleto (uma entrada por tela) — rápido, sem IA. */
export async function previewSecoesCaptura(sessionId: string, spaceId: string): Promise<PreviewPlano> {
  const auth = await autorizarPreview(sessionId, spaceId);
  if (!auth.ok) return auth;
  const cap = await carregarCaptura(sessionId);
  if (!cap || !cap.secoes.length) return { ok: false, error: "Nada para pré-visualizar. Capture telas, narração ou prints." };
  return {
    ok: true,
    titulo: auth.titulo,
    secoes: cap.secoes.map((s, idx) => ({
      idx,
      titulo: s.titulo,
      url: s.url,
      temNarracao: s.textos.some((t) => t.trim()),
      numPrints: s.prints.length,
    })),
  };
}

/** Passo 2 da prévia: a IA escreve UMA seção (re-hospeda os prints daquela tela). */
export async function escreverSecaoCaptura(
  sessionId: string,
  spaceId: string,
  idx: number,
): Promise<{ ok: true; blocks: Block[] } | { ok: false; error: string }> {
  const auth = await autorizarPreview(sessionId, spaceId);
  if (!auth.ok) return auth;
  const cap = await carregarCaptura(sessionId);
  if (!cap) return { ok: false, error: "Falha ao ler a captura." };
  const sec = cap.secoes[idx];
  if (!sec) return { ok: false, error: "Seção inexistente." };
  const midias: MediaRef[] = [];
  for (const p of sec.prints) {
    const m = await reHospedarPrint(spaceId, p.storagePath, p.title || sec.titulo);
    if (m) midias.push(m);
  }
  const blocks = await escreverSecaoDaCaptura({
    titulo: sec.titulo,
    url: sec.url,
    narrativa: sec.textos.join("\n\n"),
    contexto: cap.contexto,
    midias,
  });
  return { ok: true, blocks };
}

/** Bloco de topo, validação leve — a prévia veio da nossa própria IA. */
const docIaSchema = z.object({
  version: z.literal(2),
  blocks: z.array(z.object({ id: z.string().min(1), type: z.string().min(1) }).passthrough()).min(1).max(4000),
});

/** Salva a versão pré-visualizada pela IA como rascunho (em vez do determinístico). */
export async function finalizarComDocIA(
  sessionId: string,
  spaceId: string,
  title: string,
  doc: unknown,
): Promise<{ ok: true; nodeId: string } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sessão expirada." };
  if (!spaceId) return { ok: false, error: "Escolha a documentação de destino." };
  try {
    await requirePermission("content.create", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para criar conteúdo nessa documentação." };
  }
  const parsed = docIaSchema.safeParse(doc);
  if (!parsed.success) return { ok: false, error: "Prévia inválida — gere a prévia de novo." };

  const supabase = await createClient();
  const { data: sess } = await supabase.from("extension_sessions").select("id, status").eq("id", sessionId).maybeSingle();
  if (!sess) return { ok: false, error: "Sessão não encontrada." };
  if (sess.status !== "active") return { ok: false, error: "Esta sessão já foi finalizada." };

  const criado = await criarNoRascunho(user.id, spaceId, null, title?.trim() || "Rascunho da captura", parsed.data as unknown as BlockDoc);
  if (!criado.ok) return criado;

  const admin = createAdminClient();
  await admin
    .from("extension_sessions")
    .update({ status: "finalized", ended_at: new Date().toISOString(), space_id: spaceId, node_id: criado.nodeId })
    .eq("id", sessionId);
  revalidatePath("/admin/conteudo");
  return { ok: true, nodeId: criado.nodeId };
}
