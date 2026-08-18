"use client";

import { Tabs, TabPanel, useAbaAtual, type Aba as AbaUI } from "@/components/ui/tabs";
import { WidgetManager, type WidgetKeyRow } from "../widget/widget-manager";
import { ApiKeyManager, type ApiKeyRow } from "../widget/api-key-manager";

/**
 * Abas do Chatbot: "Widget" (embutir o chat num site) e "API" (acesso REST +
 * documentação). Cada aba lista só as chaves do seu tipo (`widget_keys.kind`).
 *
 * TROCA a região de conteúdo, então é navegação e mora na URL — a distinção que
 * `ui/tabs` documenta entre `Tabs` e `Segmented`. Com `useState`, "abre na aba
 * da API" não era um link que dava para mandar para um colega, e o F5 voltava
 * sempre para Widget.
 *
 * Estas abas não vêm do `mapa-rotas`: elas são um recorte DENTRO de uma aba
 * dele ("Canais e chaves"), não um destino do menu. Declará-las lá as faria
 * aparecer no Cmd+K no mesmo nível de Persona e Ontologia, que é mais fundo do
 * que a paleta deve ir.
 */
const ABAS: AbaUI[] = [
  { key: "widget", label: "Widget" },
  { key: "api", label: "API" },
];
export function ChatbotTabs({
  widgetKeys,
  apiKeys,
  spaces,
  siteUrl,
  fixedSpaceId,
}: {
  widgetKeys: WidgetKeyRow[];
  apiKeys: ApiKeyRow[];
  spaces: { id: string; name: string; slug: string }[];
  siteUrl: string;
  /** Documentação fixa (aba do Chatbot). Sem ela, é a gestão GLOBAL (/admin/widget). */
  fixedSpaceId?: string;
}) {
  const aba = useAbaAtual(ABAS);

  return (
    <div className="mt-6">
      <Tabs tabs={ABAS} aria-label="Tipo de chave" />
      <div className="mt-6">
        <TabPanel aba="widget" atual={aba}>
          <WidgetManager
            spaces={spaces}
            initialKeys={widgetKeys}
            siteUrl={siteUrl}
            fixedSpaceId={fixedSpaceId}
          />
        </TabPanel>
        <TabPanel aba="api" atual={aba}>
          <ApiKeyManager keys={apiKeys} spaces={spaces} fixedSpaceId={fixedSpaceId} siteUrl={siteUrl} />
        </TabPanel>
      </div>
    </div>
  );
}
