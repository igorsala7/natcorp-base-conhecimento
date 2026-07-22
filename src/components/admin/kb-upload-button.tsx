"use client";

import { useState } from "react";
import { FilePlus2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ingestKnowledgeFile } from "@/app/(admin)/admin/(app)/base-conhecimento/actions";
import { MAX_BYTES, MAX_MB, EXTENSOES } from "@/app/(admin)/admin/(app)/base-conhecimento/constants";

/**
 * "Adicionar documentos" à base de conhecimento do CHATBOT, de qualquer tela.
 *
 * Mesmo ciclo da tela de arquivos (upload no bucket `imports` → ingestão com
 * extração + chunks + EMBEDDINGS na hora), com seleção múltipla e progresso
 * incremental. O chamador dá `router.refresh()` no `onDone` para as
 * contagens acompanharem.
 */
export function KbUploadButton({
  spaceId,
  size = "sm",
  onDone,
}: {
  spaceId: string;
  size?: "sm" | "md";
  onDone?: (resumo: string) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);

  function abrir() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = EXTENSOES.join(",");
    input.onchange = async () => {
      const files = [...(input.files ?? [])];
      if (!files.length) return;
      setEnviando(true);
      const supabase = createClient();
      let ok = 0;
      const erros: string[] = [];

      // Sequencial de propósito: a ingestão gera embeddings — paralelizar
      // estoura o rate limit do provedor no primeiro lote grande.
      for (const [i, file] of files.entries()) {
        setProgresso(`${i + 1}/${files.length} — ${file.name}`);
        if (file.size > MAX_BYTES) {
          erros.push(`${file.name}: maior que ${MAX_MB} MB`);
          continue;
        }
        const path = `${spaceId}/kb-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("imports").upload(path, file);
        if (error) {
          erros.push(`${file.name}: falha no upload`);
          continue;
        }
        const res = await ingestKnowledgeFile({
          spaceId,
          storagePath: path,
          originalName: file.name,
          mime: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });
        if (res.ok) ok++;
        else erros.push(`${file.name}: ${res.error}`);
      }

      setEnviando(false);
      setProgresso(null);
      const resumo =
        `${ok} documento(s) processado(s) — o chatbot já pode usá-los.` +
        (erros.length ? ` Falharam: ${erros.join("; ")}` : "");
      onDone?.(resumo);
    };
    input.click();
  }

  return (
    <Button
      variant="secondary"
      size={size}
      onClick={abrir}
      disabled={enviando}
      title={`Enviar documentos para a base do chatbot (PDF, Word, Excel, HTML, Markdown — até ${MAX_MB} MB cada). Os embeddings são gerados na hora.`}
    >
      {enviando ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}
      {enviando ? (progresso ?? "Processando…") : "Adicionar documentos"}
    </Button>
  );
}
