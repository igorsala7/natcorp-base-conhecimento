import type { Metadata } from "next";
import { hasPermission } from "@/lib/auth/permissions";
import { listTrash } from "./actions";
import { TrashManager } from "./trash-manager";
import { SemPermissao } from "@/components/ui/sem-permissao";

export const metadata: Metadata = { title: "Lixeira" };

export default async function LixeiraPage() {
  if (!(await hasPermission("content.restore"))) {
    return (
      <SemPermissao
        titulo="Lixeira"
        oQue="ver ou restaurar itens da lixeira"
        permissao="content.restore"
        papel="Gestor de conteúdo"
      />
    );
  }
  const [items, canEmpty] = await Promise.all([listTrash(), hasPermission("trash.empty")]);
  return <TrashManager initialItems={items} canEmpty={canEmpty} />;
}
