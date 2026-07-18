"use client";

import { useMemo, useState, useTransition } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role } from "@/lib/auth/roles";
import type { UserRow } from "./page";
import {
  inviteUser,
  changeUserRole,
  setUserSuspended,
  removeUser,
  revokeSessions,
  type ActionState,
} from "./actions";

type Perms = { invite: boolean; manage: boolean; suspend: boolean };

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  invited: "Convidado",
  suspended: "Suspenso",
};

function maxLevel(u: UserRow) {
  return u.memberships.reduce((max, m) => Math.max(max, m.role_level), 0);
}

function InviteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Convidando…" : "Convidar"}
    </Button>
  );
}

function InviteForm({
  roles,
  actorLevel,
  onDone,
}: {
  roles: Role[];
  actorLevel: number;
  onDone: (msg: string) => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await inviteUser(prev, fd);
      if (res?.ok) onDone(res.ok);
      return res;
    },
    undefined,
  );

  // Só papéis abaixo do nível do ator (não-escalada, refletida na UI).
  const assignable = roles.filter((r) => r.level < actorLevel);

  return (
    <form
      action={action}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex-1 space-y-1.5" style={{ minWidth: 220 }}>
        <label htmlFor="invite-email" className="text-sm font-medium">
          E-mail
        </label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="pessoa@natcorp.com.br"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="invite-role" className="text-sm font-medium">
          Papel
        </label>
        <select
          id="invite-role"
          name="roleKey"
          required
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {assignable.map((r) => (
            <option key={r.id} value={r.key}>
              {r.name} (nível {r.level})
            </option>
          ))}
        </select>
      </div>
      <InviteSubmit />
      {state?.error && (
        <p role="alert" className="w-full text-sm text-brand-pink-700 dark:text-brand-pink-300">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function UsersManager({
  users,
  roles,
  actorLevel,
  can,
}: {
  users: UserRow[];
  roles: Role[];
  actorLevel: number;
  can: Perms;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = query.toLowerCase();
      const matchesQuery =
        !q ||
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q);
      const matchesRole =
        !roleFilter || u.memberships.some((m) => m.role_key === roleFilter);
      const matchesStatus = !statusFilter || u.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [users, query, roleFilter, statusFilter]);

  function run(fn: () => Promise<ActionState>) {
    startTransition(async () => {
      const res = await fn();
      setMessage(res?.ok ?? res?.error ?? null);
    });
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por nome ou e-mail…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          aria-label="Filtrar por papel"
        >
          <option value="">Todos os papéis</option>
          {roles.map((r) => (
            <option key={r.id} value={r.key}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="invited">Convidado</option>
          <option value="suspended">Suspenso</option>
        </select>
        {can.invite && (
          <Button
            className="ml-auto"
            onClick={() => setShowInvite((v) => !v)}
          >
            <UserPlus /> Convidar
          </Button>
        )}
      </div>

      {showInvite && can.invite && (
        <InviteForm
          roles={roles}
          actorLevel={actorLevel}
          onDone={(msg) => {
            setMessage(msg);
            setShowInvite(false);
          }}
        />
      )}

      {message && (
        <p className="mt-4 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Papéis</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Escopo</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const targetLevel = maxLevel(u);
              const canActOn = actorLevel > targetLevel;
              const primary = u.memberships[0];
              return (
                <tr key={u.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.email ?? "—"}</div>
                    {u.full_name && (
                      <div className="text-text-muted">{u.full_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.memberships.length === 0 && (
                        <span className="text-text-muted">sem papel</span>
                      )}
                      {u.memberships.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center rounded-full bg-brand-purple-50 px-2 py-0.5 text-xs font-medium text-primary dark:bg-brand-purple-950/40"
                        >
                          {m.role_name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.status === "suspended"
                          ? "text-brand-pink-700 dark:text-brand-pink-300"
                          : "text-text"
                      }
                    >
                      {STATUS_LABEL[u.status] ?? u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {u.memberships.some((m) => m.space_id === null)
                      ? "Global"
                      : "Por espaço"}
                  </td>
                  <td className="px-4 py-3">
                    {!canActOn ? (
                      <span className="text-xs text-text-muted">
                        nível ≥ ao seu
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {can.manage && primary && (
                          <select
                            defaultValue={primary.role_key}
                            disabled={pending}
                            aria-label={`Papel de ${u.email}`}
                            onChange={(e) => {
                              const fd = new FormData();
                              fd.set("membershipId", primary.id);
                              fd.set("roleKey", e.target.value);
                              run(() => changeUserRole(undefined, fd));
                            }}
                            className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
                          >
                            {roles
                              .filter((r) => r.level < actorLevel)
                              .map((r) => (
                                <option key={r.id} value={r.key}>
                                  {r.name}
                                </option>
                              ))}
                          </select>
                        )}
                        {can.suspend && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              run(() =>
                                setUserSuspended(
                                  u.id,
                                  u.status !== "suspended",
                                ),
                              )
                            }
                          >
                            {u.status === "suspended" ? "Reativar" : "Suspender"}
                          </Button>
                        )}
                        {can.manage && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => run(() => revokeSessions(u.id))}
                            >
                              Revogar sessões
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => {
                                if (
                                  confirm(
                                    `Remover ${u.email}? Esta ação não pode ser desfeita.`,
                                  )
                                )
                                  run(() => removeUser(u.id));
                              }}
                            >
                              Remover
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
