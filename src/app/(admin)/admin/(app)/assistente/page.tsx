import type { Metadata } from "next";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { hasAiKey } from "@/lib/ai/config";
import { ChatPanel } from "@/components/admin/chat-panel";

export const metadata: Metadata = { title: "Assistente" };

export default async function AssistentePage() {
  if (!(await hasPermission("content.view"))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Assistente</h1>
        <p className="mt-2 text-text-muted">Sem permissão.</p>
      </div>
    );
  }
  const spaces = await listSpaces();

  return (
    <div className="mx-auto flex h-[calc(100dvh-6.5rem)] max-w-3xl flex-col">
      <div className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight">Assistente</h1>
        <p className="text-sm text-text-muted">
          Responde com base na documentação do espaço selecionado, com citações.
          {!hasAiKey() && " (Configure AI_API_KEY para ativar.)"}
        </p>
      </div>
      <ChatPanel spaces={spaces} aiReady={hasAiKey()} />
    </div>
  );
}
