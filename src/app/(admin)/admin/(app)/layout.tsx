import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/topbar";
import { CommandPalette } from "@/components/admin/command-palette";
import { ConfirmProvider } from "@/components/ui/confirm";
import { createClient } from "@/lib/supabase/server";
import { MFA_DISABLED, warnIfMfaDisabled } from "@/lib/auth/mfa-flag";

/**
 * Shell do Admin autenticado: sidebar + topbar + conteúdo.
 * Segunda linha de defesa além do middleware: se, por qualquer motivo, uma
 * request chegar aqui sem sessão em AAL2, redireciona. Servidor recusa.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  // MFA_DISABLED=true pula a exigência de AAL2 (interruptor temporário).
  if (!MFA_DISABLED) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") redirect("/admin/mfa");
  } else {
    warnIfMfaDisabled("layout do admin");
  }

  return (
    <ConfirmProvider>
      <div className="flex h-dvh overflow-hidden bg-bg text-text">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar email={user.email ?? ""} />
          <main className="flex-1 overflow-auto p-6 md:p-8">{children}</main>
        </div>
        <CommandPalette />
      </div>
    </ConfirmProvider>
  );
}
