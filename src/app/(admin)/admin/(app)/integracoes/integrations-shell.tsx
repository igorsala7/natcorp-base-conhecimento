"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { IntegrationsManager, type BaseRow, type SpaceOption } from "./integrations-manager";
import { ToolsManager, type ToolRow, type BaseToolRow } from "./tools-manager";
import { AgentsManager, type AgentRow, type ProviderOption } from "./agents-manager";
import { RunsManager, type RunRow } from "./runs-manager";
import { FlowManager } from "./flow-manager";
import { BuilderChat } from "./builder-chat";
import { WhatsappPanel, type WhatsappSettings } from "./whatsapp-panel";

export type WhatsappBundle = {
  settings: WhatsappSettings;
  secretsPresent: { app_secret: boolean; access_token: boolean; verify_token: boolean; identity: boolean };
  webhookUrl: string;
};

/** Abas do módulo de integrações. */
export function IntegrationsShell({
  bases,
  tools,
  baseTools,
  agents,
  providers,
  spaces,
  runs,
  whatsapp,
  temChaveMestra,
}: {
  bases: BaseRow[];
  tools: ToolRow[];
  baseTools: BaseToolRow[];
  agents: AgentRow[];
  providers: ProviderOption[];
  spaces: SpaceOption[];
  runs: RunRow[];
  whatsapp: WhatsappBundle;
  temChaveMestra: boolean;
}) {
  const [tab, setTab] = useState<"bases" | "apis" | "agentes" | "fluxo" | "construtor" | "execucoes" | "whatsapp">("bases");
  const abas = [
    ["bases", "Bases / Clientes"],
    ["apis", "APIs / Tools"],
    ["agentes", "Agentes"],
    ["fluxo", "Fluxo"],
    ["construtor", "Construtor IA"],
    ["execucoes", "Execuções"],
    ["whatsapp", "WhatsApp"],
  ] as const;

  return (
    <div className="mt-6">
      <div className="mb-4 flex gap-1 border-b border-border">
        {abas.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "bases" ? (
        <IntegrationsManager bases={bases} spaces={spaces} temChaveMestra={temChaveMestra} />
      ) : tab === "apis" ? (
        <ToolsManager tools={tools} bases={bases} baseTools={baseTools} />
      ) : tab === "agentes" ? (
        <AgentsManager agents={agents} tools={tools} providers={providers} />
      ) : tab === "fluxo" ? (
        <FlowManager
          bases={bases}
          tools={tools}
          agents={agents}
          baseTools={baseTools}
          spaces={spaces}
          providers={providers}
          runs={runs}
        />
      ) : tab === "construtor" ? (
        <BuilderChat />
      ) : tab === "execucoes" ? (
        <RunsManager runs={runs} />
      ) : (
        <WhatsappPanel
          settings={whatsapp.settings}
          secretsPresent={whatsapp.secretsPresent}
          webhookUrl={whatsapp.webhookUrl}
          temChaveMestra={temChaveMestra}
        />
      )}
    </div>
  );
}
