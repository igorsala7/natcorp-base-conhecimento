"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/segmented";
import { ImportManager, type ImportJobRow } from "./import-manager";
import { EmbeddingsManager, type EmbJobRow } from "./embeddings-manager";
import type { EmbeddingReportRow } from "./embeddings-actions";

type Aba = "importar" | "embeddings";

/**
 * Abas da Importar: "Importar documentos" (fluxo atual) e "Embeddings" (gestão
 * dos vetores do chatbot). Deep-link por `?tab=embeddings`. Cada aba só aparece
 * se o usuário tiver a permissão correspondente.
 */
export function ImportarTabs({
  canImport,
  canEmbed,
  spaceId,
  spaces,
  initialJobs,
  report,
  embJobs,
  initialTab,
  initialSpaceId,
  initialNodeId,
}: {
  canImport: boolean;
  canEmbed: boolean;
  spaceId: string;
  spaces: { id: string; name: string }[];
  initialJobs: ImportJobRow[];
  report: EmbeddingReportRow[];
  embJobs: EmbJobRow[];
  initialTab?: string;
  initialSpaceId?: string;
  initialNodeId?: string;
}) {
  const inicial: Aba =
    initialTab === "embeddings" && canEmbed ? "embeddings" : canImport ? "importar" : "embeddings";
  const [aba, setAba] = useState<Aba>(inicial);
  const ambas = canImport && canEmbed;

  return (
    <div className={cn("mx-auto", aba === "embeddings" ? "max-w-6xl" : "max-w-3xl")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Importar</h1>
          <p className="mt-1 text-sm text-text-muted">
            {aba === "importar"
              ? "PDF, DOCX, HTML ou Markdown viram uma árvore de artigos após sua revisão."
              : "Gestão dos embeddings que alimentam o chatbot — o que está indexado, por quem e com qual provedor."}
          </p>
        </div>
        {ambas && (
          <Segmented<Aba>
            value={aba}
            onChange={setAba}
            options={[
              { value: "importar", label: "Importar documentos" },
              { value: "embeddings", label: "Embeddings" },
            ]}
          />
        )}
      </div>

      {aba === "importar" && canImport && <ImportManager spaceId={spaceId} initialJobs={initialJobs} />}
      {aba === "embeddings" && canEmbed && (
        <EmbeddingsManager
          initial={report}
          spaces={spaces}
          initialJobs={embJobs}
          initialSpaceId={initialSpaceId}
          initialNodeId={initialNodeId}
        />
      )}
    </div>
  );
}
