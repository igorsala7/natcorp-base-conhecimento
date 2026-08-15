"use client";

import { Tabs, useAbaAtual, type Aba } from "@/components/ui/tabs";
import { IntegrationsManager, type BaseRow, type SpaceOption } from "./integrations-manager";
import { ToolsManager, type ToolRow, type BaseToolRow, type ModuleTag } from "./tools-manager";
import { BaseAccessManager } from "./base-access-manager";
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
  /**
   * A aba mora na URL, não em `useState`.
   *
   * Com estado local, F5 sempre voltava para "Bases / Clientes" — em uma tela de
   * NOVE abas, onde quem está depurando uma tool passa o dia em "Execuções". O
   * Voltar do navegador também não desfazia a troca, e não havia como mandar
   * "abre em Execuções" para um colega.
   */
  const abas: Aba[] = [
    { key: "bases", label: "Bases / Clientes" },
    { key: "apis", label: "APIs / Tools" },
    { key: "acesso", label: "Acesso por base" },
    { key: "agentes", label: "Agentes" },
    { key: "perfis", label: "Perfis de Análise" },
    { key: "fluxo", label: "Fluxo" },
    { key: "construtor", label: "Construtor IA" },
    { key: "execucoes", label: "Execuções" },
    { key: "whatsapp", label: "WhatsApp" },
  ];
  const tab = useAbaAtual(abas);

  return (
    <div className="mt-6">
      <Tabs tabs={abas} className="mb-4" aria-label="Áreas das integrações" />

      {tab === "bases" ? (
        <IntegrationsManager bases={bases} spaces={spaces} temChaveMestra={temChaveMestra} />
      ) : tab === "apis" ? (
        <ToolsManager tools={tools} bases={bases} baseTools={baseTools} moduleOptions={moduleOptions} />
      ) : tab === "acesso" ? (
        <BaseAccessManager bases={bases} tools={tools} baseTools={baseTools} />
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
