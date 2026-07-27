import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/topbar";
import { CommandPalette } from "@/components/admin/command-palette";
import { ConfirmProvider } from "@/components/ui/confirm";
import { ToastProvider } from "@/components/ui/toast";
import { LoaderProvider } from "@/components/ui/loader";
import { NavProvider } from "@/components/admin/nav-progress";
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
    <ToastProvider>
      <ConfirmProvider>
        <LoaderProvider>
          <NavProvider>
            <div className="flex h-dvh overflow-hidden bg-bg text-text">
              <Sidebar />
              <div className="flex flex-1 flex-col overflow-hidden">
                <Topbar email={user.email ?? ""} />
                {/* Páginas "de tela cheia" (editor/árvore) marcam o próprio raiz
                    com data-fullbleed: aí o main perde o respiro e a rolagem, e a
                    região lateral encosta no topo e no bottom (fixa), como o
                    assistente de IA — mas dentro do layout, não como overlay. As
                    demais telas seguem com o respiro e a rolagem normais. */}
                <main className="flex-1 overflow-auto p-6 md:p-8 [&:has([data-fullbleed])]:overflow-hidden [&:has([data-fullbleed])]:p-0">
                  {children}
                </main>
              </div>
              <CommandPalette />
            </div>
          </NavProvider>
        </LoaderProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
