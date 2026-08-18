"use client";

import { Tabs, useAbaAtual, type Aba } from "@/components/ui/tabs";
import { abasDaRota } from "@/lib/admin/mapa-rotas";

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
/**
 * Nenhuma aba desta tela declara permissão própria: a página inteira já exige
 * `integrations.manage`, e quem chegou até aqui pode ver as nove. O conjunto
 * vazio é honesto — filtrar por permissão que ninguém declarou não filtra nada.
 */
const PERMISSOES_DA_TELA = new Set<string>();

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
   *
   * ── E a lista vem do mapa ───────────────────────────────────────────────────
   * Esta era a única tela do admin cujas abas tinham URL — e a única sem
   * NENHUMA declarada no `mapa-rotas`. O Cmd+K não alcançava nenhuma das nove,
   * justamente onde ele mais ajudaria. Ler daqui resolve os dois lados: a barra
   * e a paleta passam a enxergar a mesma lista.
   */
  const abas: Aba[] = abasDaRota("/admin/integracoes", PERMISSOES_DA_TELA).map((a) => ({
    key: a.key,
    label: a.rotulo,
    grupo: a.grupo,
  }));
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
