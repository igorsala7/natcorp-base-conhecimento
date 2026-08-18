import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar, MenuMobileProvider } from "@/components/admin/sidebar";
import { permissoesDo } from "@/lib/auth/permissions";
import { SeletorDocumentacao } from "@/components/admin/seletor-documentacao";
import { pickSpace } from "@/lib/content/current-space";
import { listSpaces } from "@/lib/content/spaces";
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

  // UMA consulta para os nove itens do menu. `permissoesDo` é memoizado por

  // request, então qualquer outra parte deste render pode chamar de novo sem

  // custo. Item que a pessoa nunca usa não aparece — a tela de recusa é que

  // cobre o link colado em conversa.

  const permissoes = await permissoesDo();

  /**
   * A MESMA LISTA QUE AS TELAS USAM — e por isso o mesmo padrão.
   *
   * Aqui havia uma segunda consulta, `select("id, name").order("name")`,
   * enquanto toda tela usa `listSpaces()`, que ordena por `type` e depois
   * `created_at`. Duas listas com ordenações diferentes, cada uma caindo no
   * PRÓPRIO `[0]` quando não há cookie — e as duas exibindo com confiança.
   *
   * O resultado aparecia na tela: a barra lateral dizia "Documentação Natcorp"
   * enquanto o cabeçalho da Importar dizia "Painel do Gestor", com
   * "Destino: Painel do Gestor" logo abaixo. Numa tela de importação, isso é
   * subir arquivo para a documentação errada acreditando na barra.
   *
   * O comentário do seletor já advertia contra exatamente isto ("a shell
   * mentindo sobre o editor") e cuidava do caso do `?space=`. O que ninguém
   * viu é que o PADRÃO — o caso sem parâmetro, que é o do dia a dia — tinha
   * duas respostas diferentes.
   *
   * Agora a resolução é uma só (`pickSpace`, a mesma função das telas) e o
   * menu recebe um id CONCRETO, então o `?? espacos[0]` do seletor deixa de
   * ser alcançável. A ordem alfabética continua, mas só para EXIBIR.
   */
  const espacos = await listSpaces();
  const espacoDoCookie = (await pickSpace(espacos))?.id;
  const espacosParaOMenu = [...espacos]
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <ToastProvider>
      <ConfirmProvider>
        <LoaderProvider>
          <NavProvider>
            {/* O estado da gaveta do celular é compartilhado entre a barra (que
                a RENDERIZA) e a topbar (que tem o BOTÃO). Ver `MenuMobileProvider`. */}
            <MenuMobileProvider>
            <div className="flex h-dvh overflow-hidden bg-bg text-text">
              <Sidebar
                permissoes={[...permissoes]}
                seletor={
                  <SeletorDocumentacao
                    espacos={espacosParaOMenu}
                    atualDoServidor={espacoDoCookie}
                    podeCriar={permissoes.has("space.create")}
                  />
                }
              />
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
              <CommandPalette permissoes={[...permissoes]} />
            </div>
            </MenuMobileProvider>
          </NavProvider>
        </LoaderProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
