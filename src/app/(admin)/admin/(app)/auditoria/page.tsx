import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { DataTable, DataHead, Th, Td, Tr, EmptyRow } from "@/components/ui/data-table";
import { AuditFilters } from "./audit-filters";

export const metadata: Metadata = { title: "Auditoria" };

const ACTION_LABEL: Record<string, string> = {
  "user.invite": "Convidou usuário",
  "user.role_change": "Alterou papel",
  "user.suspend": "Suspendeu usuário",
  "user.reactivate": "Reativou usuário",
  "user.remove": "Removeu usuário",
  "user.revoke_sessions": "Revogou sessões",
  "demo.publish": "Publicou (demo)",
  "content.create": "Criou conteúdo",
  "content.rename": "Renomeou",
  "content.slug_change": "Mudou URL (slug)",
  "content.move": "Moveu",
  "content.move_bulk": "Moveu (em massa)",
  "content.merge": "Unificou artigos",
  "content.delete": "Excluiu",
  "content.delete_bulk": "Excluiu (em massa)",
  "content.publish": "Publicou",
  "content.unpublish": "Despublicou",
  "content.publish_subtree": "Publicou pasta",
  "content.reindex": "Gerou embeddings",
  "content.reindex_subtree": "Gerou embeddings (pasta)",
  "content.version_create": "Salvou versão",
  "content.version_rename": "Renomeou versão",
  "content.restore_version": "Restaurou versão",
  "content.restore_subtree": "Restaurou da lixeira",
  "trash.hard_delete": "Excluiu definitivamente",
  "widget.create": "Criou chave de widget",
  "widget.update": "Editou chave de widget",
  "widget.regenerate": "Regenerou chave",
  "widget.delete": "Excluiu chave de widget",
  "review.submit": "Enviou para revisão",
  "review.approve": "Aprovou publicação",
  "review.reject": "Rejeitou publicação",
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; action?: string; from?: string; to?: string }>;
}) {
  if (!(await hasPermission("audit.read"))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
        <p className="mt-2 text-text-muted">Você não tem permissão para ver o log de auditoria.</p>
      </div>
    );
  }
  const { actor, action, from, to } = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from("audit_log")
    .select("id, actor_id, action, entity_type, entity_id, before, after, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (actor) q = q.eq("actor_id", actor);
  if (action) q = q.eq("action", action);
  if (from) q = q.gte("created_at", `${from}T00:00:00`);
  if (to) q = q.lte("created_at", `${to}T23:59:59`);
  const { data: entries } = await q;

  // Nomes dos atores (dropdown + exibição).
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email ?? "—"]));
  const actorOptions = (profiles ?? []).map((p) => ({ id: p.id, label: p.full_name ?? p.email ?? p.id }));
  const actionOptions = Object.entries(ACTION_LABEL).map(([key, label]) => ({ key, label }));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
      <p className="mt-1 text-sm text-text-muted">
        Ações sensíveis (append-only) — quem fez o quê e quando.
      </p>

      <div className="mt-4">
        <AuditFilters actors={actorOptions} actions={actionOptions} />
      </div>

      <div className="mt-4">
        <DataTable>
          <DataHead>
            <Th>Quando</Th>
            <Th>Ator</Th>
            <Th>Ação</Th>
            <Th>Entidade</Th>
          </DataHead>
          <tbody>
            {(entries ?? []).length === 0 && (
              <EmptyRow colSpan={4}>Nenhuma ação para os filtros selecionados.</EmptyRow>
            )}
            {(entries ?? []).map((e) => {
              const hasDiff = e.before || e.after;
              return (
                <Tr key={e.id}>
                  <Td className="whitespace-nowrap tabular-nums text-text-muted">
                    <time dateTime={new Date(e.created_at).toISOString()}>
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </time>
                  </Td>
                  <Td>{(e.actor_id && nameById.get(e.actor_id)) || "—"}</Td>
                  <Td>{ACTION_LABEL[e.action] ?? e.action}</Td>
                  <Td className="text-text-muted">
                    <div>
                      {e.entity_type ?? "—"}
                      {e.entity_id ? ` · ${e.entity_id.slice(0, 8)}…` : ""}
                    </div>
                    {hasDiff && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-primary">
                          antes/depois
                        </summary>
                        <pre className="mt-1 max-w-md overflow-x-auto rounded-sm bg-surface-2 p-2 text-[11px] leading-tight text-text">
                          {JSON.stringify({ before: e.before, after: e.after }, null, 2)}
                        </pre>
                      </details>
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
