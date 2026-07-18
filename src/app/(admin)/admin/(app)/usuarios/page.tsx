import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listRoles, currentMaxLevel } from "@/lib/auth/roles";
import { UsersManager } from "./users-manager";

export const metadata: Metadata = { title: "Usuários" };

export type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: string;
  created_at: string;
  last_seen_at: string | null;
  memberships: {
    id: string;
    space_id: string | null;
    role_key: string;
    role_name: string;
    role_level: number;
  }[];
};

/**
 * Tela de Usuários (Fase 0.5). Lista com filtro, convite, troca de papel,
 * suspensão, remoção e revogação de sessões — tudo protegido por has_permission.
 * A UI só mostra o que o usuário pode fazer; o servidor é quem recusa.
 */
export default async function UsuariosPage() {
  const canView = await hasPermission("user.view");
  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="mt-2 text-text-muted">
          Você não tem permissão para ver esta área.
        </p>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: profiles }, { data: memberships }, roles, actorLevel, canInvite, canManage, canSuspend] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, status, created_at, last_seen_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("memberships")
        .select("id, user_id, space_id, roles(key, name, level)"),
      listRoles(),
      currentMaxLevel(null),
      hasPermission("user.invite"),
      hasPermission("user.manage"),
      hasPermission("user.suspend"),
    ]);

  const byUser = new Map<string, UserRow["memberships"]>();
  for (const m of memberships ?? []) {
    const role = m.roles as unknown as {
      key: string;
      name: string;
      level: number;
    } | null;
    if (!role) continue;
    const list = byUser.get(m.user_id) ?? [];
    list.push({
      id: m.id,
      space_id: m.space_id,
      role_key: role.key,
      role_name: role.name,
      role_level: role.level,
    });
    byUser.set(m.user_id, list);
  }

  const users: UserRow[] = (profiles ?? []).map((p) => ({
    ...p,
    memberships: byUser.get(p.id) ?? [],
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="mt-1 text-sm text-text-muted">
            {users.length} {users.length === 1 ? "usuário" : "usuários"} · você é
            nível {actorLevel}
          </p>
        </div>
      </div>

      <UsersManager
        users={users}
        roles={roles}
        actorLevel={actorLevel}
        can={{ invite: canInvite, manage: canManage, suspend: canSuspend }}
      />
    </div>
  );
}
