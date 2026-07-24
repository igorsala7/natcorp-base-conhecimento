"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { WidgetManager, type WidgetKeyRow } from "../widget/widget-manager";
import { ApiKeyManager, type ApiKeyRow } from "../widget/api-key-manager";

type Aba = "widget" | "api";

/**
 * Abas do Chatbot: "Widget" (embutir o chat num site) e "API" (acesso REST +
 * documentação). Cada aba lista só as chaves do seu tipo (`widget_keys.kind`).
 */
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
  const [aba, setAba] = useState<Aba>("widget");

  return (
    <div className="mt-6">
      <Segmented<Aba>
        value={aba}
        onChange={setAba}
        options={[
          { value: "widget", label: "Widget" },
          { value: "api", label: "API" },
        ]}
      />
      <div className="mt-6">
        {aba === "widget" ? (
          <WidgetManager
            spaces={spaces}
            initialKeys={widgetKeys}
            siteUrl={siteUrl}
            fixedSpaceId={fixedSpaceId}
          />
        ) : (
          <ApiKeyManager keys={apiKeys} spaces={spaces} fixedSpaceId={fixedSpaceId} siteUrl={siteUrl} />
        )}
      </div>
    </div>
  );
}
