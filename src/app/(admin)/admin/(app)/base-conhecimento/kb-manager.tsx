"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Trash2, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, DataHead, Th, Td, Tr, EmptyRow } from "@/components/ui/data-table";
import { ingestKnowledgeFile, deleteKnowledgeFile } from "./actions";
import { MAX_BYTES, MAX_MB, EXTENSOES } from "./constants";

export type KbRow = {
  id: string;
  original_name: string;
  mime: string | null;
  size_bytes: number | null;
  status: string;
  error: string | null;
  chunk_count: number;
  created_at: string;
};

const STATUS: Record<string, { rotulo: string; tom: BadgeTone }> = {
  queued: { rotulo: "Na fila", tom: "neutral" },
  extracting: { rotulo: "Processando", tom: "info" },
  ready: { rotulo: "Disponível", tom: "primary" },
  error: { rotulo: "Erro", tom: "danger" },
};

function tamanho(b: number | null): string {
  if (!b) return "—";
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`;
}

export function KbManager({ spaceId, initial }: { spaceId: string; initial: KbRow[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function enviar(file: File) {
    setMsg(null);
    if (file.size > MAX_BYTES) {
      setMsg(`Arquivo maior que ${MAX_MB} MB.`);
      return;
    }
    setEnviando(true);
    const path = `${spaceId}/kb-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("imports").upload(path, file);
    if (error) {
      setEnviando(false);
      setMsg(`Falha no upload: ${error.message}`);
      return;
    }
    const res = await ingestKnowledgeFile({
      spaceId,
      storagePath: path,
      originalName: file.name,
      mime: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });
    setEnviando(false);
    setMsg(res.ok ? "Arquivo processado — o chatbot já pode usá-lo." : res.error);
    router.refresh();
  }

  function excluir(row: KbRow) {
    if (!confirm(`Excluir "${row.original_name}"? O chatbot deixa de consultá-lo.`)) return;
    startTransition(async () => {
      const res = await deleteKnowledgeFile(row.id);
      if (!res.ok) setMsg(res.error);
      router.refresh();
    });
  }

  return (
    <div className="mt-6">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-10 text-center transition-colors hover:border-primary">
        <FileUp className="size-6 text-text-muted" />
        <span className="text-sm font-medium">
          {enviando ? "Processando…" : "Clique para escolher um arquivo"}
        </span>
        <span className="text-xs text-text-muted">
          PDF, Word, Excel, HTML, Markdown · até {MAX_MB} MB
        </span>
        <input
          type="file"
          accept={EXTENSOES.join(",")}
          className="hidden"
          disabled={enviando}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void enviar(f);
            e.target.value = "";
          }}
        />
      </label>

      {msg && (
        <p role="status" className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
          {msg}
        </p>
      )}

      <div className="mt-6">
        {initial.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum arquivo nesta base"
            description="Suba manuais, tabelas de preço ou procedimentos que o chatbot deve conhecer sem que virem artigos publicados."
          />
        ) : (
          <DataTable>
            <DataHead>
              <Th>Arquivo</Th>
              <Th>Situação</Th>
              <Th>Trechos</Th>
              <Th>Tamanho</Th>
              <Th>Enviado</Th>
              <Th>Ações</Th>
            </DataHead>
            <tbody>
              {initial.length === 0 && <EmptyRow colSpan={6}>Nada aqui.</EmptyRow>}
              {initial.map((r) => {
                const st = STATUS[r.status] ?? STATUS.queued!;
                return (
                  <Tr key={r.id}>
                    <Td>
                      <div className="font-medium">{r.original_name}</div>
                      {r.error && <div className="text-xs text-red-600">{r.error}</div>}
                    </Td>
                    <Td>
                      <Badge tone={st.tom}>{st.rotulo}</Badge>
                    </Td>
                    <Td className="tabular-nums">{r.chunk_count || "—"}</Td>
                    <Td className="tabular-nums text-text-muted">{tamanho(r.size_bytes)}</Td>
                    <Td className="whitespace-nowrap tabular-nums text-text-muted">
                      <time dateTime={new Date(r.created_at).toISOString()}>
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </time>
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => excluir(r)}
                        title="Excluir"
                      >
                        <Trash2 className="size-4 text-red-600 dark:text-red-400" />
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </div>
    </div>
  );
}
