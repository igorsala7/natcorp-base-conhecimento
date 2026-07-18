"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function AuditFilters({
  actors,
  actions,
}: {
  actors: { id: string; label: string }[];
  actions: { key: string; label: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function set(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/admin/auditoria?${params.toString()}`);
  }

  const cls = "h-8 rounded-md border border-border bg-surface px-2 text-sm";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={cls} value={sp.get("actor") ?? ""} onChange={(e) => set("actor", e.target.value)} aria-label="Ator">
        <option value="">Todos os atores</option>
        {actors.map((a) => (
          <option key={a.id} value={a.id}>{a.label}</option>
        ))}
      </select>
      <select className={cls} value={sp.get("action") ?? ""} onChange={(e) => set("action", e.target.value)} aria-label="Ação">
        <option value="">Todas as ações</option>
        {actions.map((a) => (
          <option key={a.key} value={a.key}>{a.label}</option>
        ))}
      </select>
      <input type="date" className={cls} value={sp.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} aria-label="De" />
      <input type="date" className={cls} value={sp.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} aria-label="Até" />
      {[...sp.keys()].length > 0 && (
        <button
          type="button"
          onClick={() => router.push("/admin/auditoria")}
          className="rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:border-primary hover:text-primary"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
