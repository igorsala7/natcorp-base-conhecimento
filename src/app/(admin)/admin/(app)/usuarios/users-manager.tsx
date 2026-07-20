"use client";

import { useMemo, useState, useTransition } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, controlClass } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataHead, Th, Td, Tr, EmptyRow } from "@/components/ui/data-table";
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
      <Field
        label="E-mail"
        htmlFor="invite-email"
        required
        className="flex-1"
        error={state?.error ?? null}
      >
        <Input
          id="invite-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="pessoa@natcorp.com.br"
        />
      </Field>
      <Field
        label="Papel"
        htmlFor="invite-role"
        required
        hint="Só papéis abaixo do seu nível aparecem aqui."
      >
        <select
          id="invite-role"
          name="roleKey"
          required
          className={`${controlClass} h-10 w-auto`}
        >
          {assignable.map((r) => (
            <option key={r.id} value={r.key}>
              {r.name} (nível {r.level})
            </option>
          ))}
        </select>
      </Field>
      <InviteSubmit />
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
          className={`${controlClass} h-10 w-auto`}
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
          className={`${controlClass} h-10 w-auto`}
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

      <div className="mt-4">
        <DataTable>
          <DataHead>
            <Th>Usuário</Th>
            <Th>Papéis</Th>
            <Th>Status</Th>
            <Th>Escopo</Th>
            <Th>Ações</Th>
          </DataHead>
          <tbody>
            {filtered.length === 0 && (
              <EmptyRow colSpan={5}>Nenhum usuário corresponde aos filtros.</EmptyRow>
            )}
            {filtered.map((u) => {
              const targetLevel = maxLevel(u);
              const canActOn = actorLevel > targetLevel;
              const primary = u.memberships[0];
              return (
                <Tr key={u.id}>
                  <Td>
                    <div className="font-medium">{u.email ?? "—"}</div>
                    {u.full_name && <div className="text-text-muted">{u.full_name}</div>}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {u.memberships.length === 0 && (
                        <span className="text-text-muted">sem papel</span>
                      )}
                      {u.memberships.map((m) => (
                        <Badge key={m.id} tone="primary">
                          {m.role_name}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={u.status === "suspended" ? "danger" : "neutral"}>
                      {STATUS_LABEL[u.status] ?? u.status}
                    </Badge>
                  </Td>
                  <Td className="text-text-muted">
                    {u.memberships.some((m) => m.space_id === null) ? "Global" : "Por espaço"}
                  </Td>
                  <Td>
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
                            className={`${controlClass} h-8 w-auto px-2 text-xs`}
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
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </DataTable>
      </div>
    </div>
  );
}
