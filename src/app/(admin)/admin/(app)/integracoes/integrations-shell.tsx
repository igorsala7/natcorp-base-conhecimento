"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { IntegrationsManager, type BaseRow, type SpaceOption } from "./integrations-manager";
import { ToolsManager, type ToolRow, type BaseToolRow, type ModuleTag } from "./tools-manager";
import { AgentsManager, type AgentRow, type ProviderOption } from "./agents-manager";
import { ProfilesManager, type ProfileRow } from "./profiles-manager";
import { RunsManager, type RunRow } from "./runs-manager";
import { FlowManager } from "./flow-manager";
import { BuilderChat } from "./builder-chat";
import { WhatsappPanel, type WhatsappSettings } from "./whatsapp-panel";

type SecretsPresent = { app_secret: boolean; access_token: boolean; verify_token: boolean; identity: boolean };
export type WhatsappBundle = {
  channels: Record<string, WhatsappSettings>;
  secrets: Record<string, SecretsPresent>;
  bases: string[];
  webhookUrl: string;
};

/** Abas do módulo de integrações. */
export function IntegrationsShell({
  bases,
  tools,
  baseTools,
  agents,
  profiles,
  providers,
  spaces,
  runs,
  moduleOptions,
  whatsapp,
  temChaveMestra,
}: {
  bases: BaseRow[];
  tools: ToolRow[];
  baseTools: BaseToolRow[];
  agents: AgentRow[];
  profiles: ProfileRow[];
  providers: ProviderOption[];
  spaces: SpaceOption[];
  runs: RunRow[];
  moduleOptions: ModuleTag[];
  whatsapp: WhatsappBundle;
  temChaveMestra: boolean;
}) {
  const [tab, setTab] = useState<"bases" | "apis" | "agentes" | "perfis" | "fluxo" | "construtor" | "execucoes" | "whatsapp">("bases");
  const abas = [
    ["bases", "Bases / Clientes"],
    ["apis", "APIs / Tools"],
    ["agentes", "Agentes"],
    ["perfis", "Perfis de Análise"],
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
        <ToolsManager tools={tools} bases={bases} baseTools={baseTools} moduleOptions={moduleOptions} />
      ) : tab === "agentes" ? (
        <AgentsManager agents={agents} tools={tools} providers={providers} />
      ) : tab === "perfis" ? (
        <ProfilesManager
          profiles={profiles}
          bases={bases.map((b) => ({ base_code: b.base_code, name: b.name }))}
          moduleOptions={moduleOptions}
        />
      ) : tab === "fluxo" ? (
        <FlowManager
          bases={bases}
          tools={tools}
          agents={agents}
          baseTools={baseTools}
          spaces={spaces}
          providers={providers}
          runs={runs}
          moduleOptions={moduleOptions}
        />
      ) : tab === "construtor" ? (
        <BuilderChat />
      ) : tab === "execucoes" ? (
        <RunsManager runs={runs} />
      ) : (
        <WhatsappPanel
          channels={whatsapp.channels}
          secrets={whatsapp.secrets}
          bases={whatsapp.bases}
          webhookUrl={whatsapp.webhookUrl}
          temChaveMestra={temChaveMestra}
        />
      )}
    </div>
  );
}
