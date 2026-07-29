"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { IntegrationsManager, type BaseRow } from "./integrations-manager";
import { ToolsManager, type ToolRow, type BaseToolRow } from "./tools-manager";
import { AgentsManager, type AgentRow, type ProviderOption } from "./agents-manager";

/** Abas do módulo de integrações. */
export function IntegrationsShell({
  bases,
  tools,
  baseTools,
  agents,
  providers,
  temChaveMestra,
}: {
  bases: BaseRow[];
  tools: ToolRow[];
  baseTools: BaseToolRow[];
  agents: AgentRow[];
  providers: ProviderOption[];
  temChaveMestra: boolean;
}) {
  const [tab, setTab] = useState<"bases" | "apis" | "agentes">("bases");
  const abas = [
    ["bases", "Bases / Clientes"],
    ["apis", "APIs / Tools"],
    ["agentes", "Agentes"],
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
        <IntegrationsManager bases={bases} tools={tools} baseTools={baseTools} temChaveMestra={temChaveMestra} />
      ) : tab === "apis" ? (
        <ToolsManager tools={tools} />
      ) : (
        <AgentsManager agents={agents} tools={tools} providers={providers} />
      )}
    </div>
  );
}
