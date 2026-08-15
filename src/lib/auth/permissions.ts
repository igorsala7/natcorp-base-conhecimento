import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/** Ponte até os tipos serem regerados. Ver o uso em `permissoesDo`. */
type RpcSolta = (nome: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

/** Erro de autorização — o servidor recusa, independentemente da UI. */
export class PermissionError extends Error {
  constructor(public permission: string) {
    super(`Permissão negada: ${permission}`);
    this.name = "PermissionError";
  }
}

/** Usuário autenticado (validado no servidor) ou null. */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Verifica uma permissão para o usuário atual, no escopo do espaço.
 * Fonte única: a função SQL has_permission() (mesma usada pela RLS).
 */
export async function hasPermission(
  permission: string,
  spaceId: string | null = null,
): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc("has_permission", {
    p_user_id: user.id,
    p_permission_key: permission,
    p_space_id: spaceId ?? undefined,
  });
  return !error && data === true;
}

/**
 * TODAS as permissões do usuário no escopo, em UMA ida ao banco.
 *
 * `hasPermission` custa dois round-trips (o `auth.getUser()` e a RPC) e responde
 * uma pergunta só. Isso servia enquanto a UI perguntava três ou quatro coisas
 * por página. Não serve para a navegação nova, que decide a visibilidade de nove
 * itens a cada render e filtra ~40 destinos no Cmd+K enquanto a pessoa digita.
 *
 * `cache()` do React memoiza POR REQUEST: o layout, a sidebar e a paleta podem
 * chamar à vontade no mesmo render que o banco é consultado uma vez. Fora do
 * request o cache não existe — trocar o papel de alguém não fica preso em
 * memória de servidor.
 *
 * ── Onde NÃO usar ───────────────────────────────────────────────────────────
 * Isto é para DESENHAR a interface. Server Action e Route Handler continuam
 * usando `requirePermission`, que fala com a mesma função SQL da RLS. A UI
 * esconde; o servidor recusa. Trocar um pelo outro transformaria uma decisão de
 * segurança numa decisão de renderização.
 */
export const permissoesDo = cache(async (spaceId: string | null = null): Promise<Set<string>> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  // O cast some quando a migration `20260816120000_permissoes_em_conjunto.sql`
  // for aplicada e os tipos, regerados (`supabase gen types typescript`). Fica
  // estreito de propósito — só o nome da função, não o retorno.
  const { data, error } = await (supabase.rpc as unknown as RpcSolta)("permissions_of", {
    p_user_id: user.id,
    p_space_id: spaceId ?? undefined,
  });
  // Erro vira conjunto vazio, não exceção: uma falha aqui deve esconder itens do
  // menu, nunca derrubar a página inteira do admin.
  if (error || !Array.isArray(data)) return new Set();
  return new Set(data as string[]);
});

/**
 * Exige a permissão; lança PermissionError se faltar. Use no topo de toda
 * Server Action / Route Handler sensível — a UI esconde, mas aqui é onde recusa.
 */
export async function requirePermission(
  permission: string,
  spaceId: string | null = null,
): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new PermissionError(permission);
  const ok = await hasPermission(permission, spaceId);
  if (!ok) throw new PermissionError(permission);
  return user;
}
