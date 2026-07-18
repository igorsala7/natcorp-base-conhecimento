import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Auditoria" };

const ACTION_LABEL: Record<string, string> = {
  "user.invite": "Convidou usuário",
  "user.role_change": "Alterou papel",
  "user.suspend": "Suspendeu usuário",
  "user.reactivate": "Reativou usuário",
  "user.remove": "Removeu usuário",
  "user.revoke_sessions": "Revogou sessões",
  "demo.publish": "Publicou (demo)",
};

/**
 * Tela de Auditoria (Fase 0.5). Log append-only de ações sensíveis.
 * Protegida por audit.read (via RLS e via checagem aqui).
 */
export default async function AuditoriaPage() {
  const canRead = await hasPermission("audit.read");
  if (!canRead) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
        <p className="mt-2 text-text-muted">
          Você não tem permissão para ver o log de auditoria.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("audit_log")
    .select("id, actor_id, action, entity_type, entity_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  // Resolve e-mails dos atores para exibição.
  const actorIds = [
    ...new Set((entries ?? []).map((e) => e.actor_id).filter(Boolean)),
  ] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, email").in("id", actorIds)
    : { data: [] };
  const emailById = new Map((actors ?? []).map((a) => [a.id, a.email]));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
      <p className="mt-1 text-sm text-text-muted">
        Últimas {entries?.length ?? 0} ações sensíveis (append-only).
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Quando</th>
              <th className="px-4 py-3 font-medium">Ator</th>
              <th className="px-4 py-3 font-medium">Ação</th>
              <th className="px-4 py-3 font-medium">Entidade</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  Nenhuma ação registrada ainda.
                </td>
              </tr>
            )}
            {(entries ?? []).map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                  {new Date(e.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3">
                  {(e.actor_id && emailById.get(e.actor_id)) || "—"}
                </td>
                <td className="px-4 py-3">
                  {ACTION_LABEL[e.action] ?? e.action}
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {e.entity_type ?? "—"}
                  {e.entity_id ? ` · ${e.entity_id.slice(0, 8)}…` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
