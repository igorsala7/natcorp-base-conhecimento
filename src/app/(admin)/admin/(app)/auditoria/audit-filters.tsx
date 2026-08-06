"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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

  const cls = cn(controlClass, "h-8 w-auto px-2 py-1");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select className={cls} value={sp.get("actor") ?? ""} onChange={(v) => set("actor", v)} aria-label="Ator">
        <option value="">Todos os atores</option>
        {actors.map((a) => (
          <option key={a.id} value={a.id}>{a.label}</option>
        ))}
      </Select>
      <Select className={cls} value={sp.get("action") ?? ""} onChange={(v) => set("action", v)} aria-label="Ação">
        <option value="">Todas as ações</option>
        {actions.map((a) => (
          <option key={a.key} value={a.key}>{a.label}</option>
        ))}
      </Select>
      <input type="date" className={cls} value={sp.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} aria-label="De" />
      <input type="date" className={cls} value={sp.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} aria-label="Até" />
      {[...sp.keys()].length > 0 && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => router.push("/admin/auditoria")}
        >
          Limpar
        </Button>
      )}
    </div>
  );
}
