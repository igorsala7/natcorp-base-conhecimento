import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

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
