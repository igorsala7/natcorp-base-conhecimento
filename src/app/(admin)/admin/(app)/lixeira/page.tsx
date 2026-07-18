import type { Metadata } from "next";
import { hasPermission } from "@/lib/auth/permissions";
import { listTrash } from "./actions";
import { TrashManager } from "./trash-manager";

export const metadata: Metadata = { title: "Lixeira" };

export default async function LixeiraPage() {
  if (!(await hasPermission("content.restore"))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Lixeira</h1>
        <p className="mt-2 text-text-muted">
          Você não tem permissão para ver ou restaurar itens da lixeira.
        </p>
      </div>
    );
  }
  const [items, canEmpty] = await Promise.all([listTrash(), hasPermission("trash.empty")]);
  return <TrashManager initialItems={items} canEmpty={canEmpty} />;
}
