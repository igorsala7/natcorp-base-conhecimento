import type { ReactNode } from "react";
import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/topbar";

/**
 * Shell do Admin: sidebar fixa + topbar + área de conteúdo.
 * A proteção de rota (sessão + AAL2/TOTP) entra na Parte B via middleware.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-bg text-text">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
