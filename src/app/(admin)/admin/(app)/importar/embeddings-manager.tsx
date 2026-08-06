"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileUp, Trash2, Database, Sparkles, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Surface } from "@/components/ui/surface";
import { Field } from "@/components/ui/field";
import { controlClass } from "@/components/ui/input";
import { DataTable, DataHead, Th, Td, Tr, EmptyRow } from "@/components/ui/data-table";
import {
  deleteEmbeddingsOrigin,
  enqueueEmbeddingsJob,
  listSpaceNodes,
  type EmbeddingReportRow,
} from "./embeddings-actions";
import { ingestKnowledgeFile } from "../base-conhecimento/actions";
import { MAX_BYTES, MAX_MB, ACCEPT } from "../base-conhecimento/constants";
import { Select } from "@/components/ui/select";

export type EmbJobRow = {
  id: string;
  space_id: string;
  scope: string;
  status: string;
  total: number;
  done: number;
  progress: number;
  error: string | null;
  created_at: string;
};

const SCOPE_LABEL: Record<string, string> = {
  space: "documentação inteira",
  subtree: "subárvore",
  article: "artigo",
};

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  google: "Gemini",
  anthropic: "Anthropic",
};

function data(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

type NodeOpt = { id: string; title: string; type: string; depth: number };

export function EmbeddingsManager({
  initial,
  spaces,
  initialJobs,
  initialSpaceId,
  initialNodeId,
}: {
  initial: EmbeddingReportRow[];
  spaces: { id: string; name: string }[];
  initialJobs: EmbJobRow[];
  initialSpaceId?: string;
  initialNodeId?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { confirmar } = useConfirm();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const nomeEspaco = (id: string) => spaces.find((s) => s.id === id)?.name ?? "documentação";

  // Jobs de geração em andamento (barra de progresso via Realtime).
  const [jobs, setJobs] = useState<EmbJobRow[]>(initialJobs);
  const ativos = jobs.filter((j) => j.status === "queued" || j.status === "running");

  useEffect(() => {
    const channel = supabase
      .channel("embedding-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "embedding_jobs" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setJobs((prev) => prev.filter((j) => j.id !== (payload.old as { id: string }).id));
            return;
          }
          const row = payload.new as EmbJobRow;
          setJobs((prev) =>
            prev.some((j) => j.id === row.id)
              ? prev.map((j) => (j.id === row.id ? { ...j, ...row } : j))
              : [row, ...prev],
          );
          if (row.status === "done" || row.status === "error") router.refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  // Rede de segurança: se o Realtime não entregar, recarrega os ativos por
  // polling e atualiza o relatório quando tudo termina.
  useEffect(() => {
    if (ativos.length === 0) return;
    let alive = true;
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("embedding_jobs")
        .select("id, space_id, scope, status, total, done, progress, error, created_at")
        .in("status", ["queued", "running"]);
      if (!alive) return;
      setJobs((data ?? []) as EmbJobRow[]);
      if ((data ?? []).length === 0) router.refresh();
    }, 2500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [ativos.length, supabase, router]);

  // ── Geração ──────────────────────────────────────────────────────────────
  // Pré-seleção via `?space=&node=` (os botões "Gerar embeddings" espalhados
  // pelo admin abrem esta aba já apontando para o alvo).
  const [spaceId, setSpaceId] = useState(
    spaces.some((s) => s.id === initialSpaceId) ? initialSpaceId! : (spaces[0]?.id ?? ""),
  );
  const [nodeSel, setNodeSel] = useState(initialNodeId ?? "__all__");
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Nós carregados junto do espaço a que pertencem — o "carregando" é DERIVADO
  // (sem setState síncrono no efeito, que dispara re-render em cascata).
  const [loaded, setLoaded] = useState<{ spaceId: string; list: NodeOpt[] } | null>(null);
  const nodes = loaded?.spaceId === spaceId ? loaded.list : [];
  const nodesLoading = !!spaceId && loaded?.spaceId !== spaceId;

  useEffect(() => {
    if (!spaceId) return;
    let alive = true;
    void listSpaceNodes(spaceId).then((n) => {
      if (alive) setLoaded({ spaceId, list: n });
    });
    return () => {
      alive = false;
    };
  }, [spaceId]);

  /** IDs de artigo cobertos pela seleção atual (tudo / pasta+subárvore / artigo). */
  function idsDoAlvo(): string[] {
    if (nodeSel === "__all__") return nodes.filter((n) => n.type === "article").map((n) => n.id);
    const i = nodes.findIndex((n) => n.id === nodeSel);
    if (i < 0) return [nodeSel];
    const alvo = nodes[i]!;
    if (alvo.type === "article") return [alvo.id];
    // Pasta: descendentes na lista pré-ordenada (profundidade maior até cair).
    const ids: string[] = [];
    for (let j = i + 1; j < nodes.length; j++) {
      const n = nodes[j]!;
      if (n.depth <= alvo.depth) break;
      if (n.type === "article") ids.push(n.id);
    }
    return ids;
  }

  async function gerar() {
    // Já indexado antes? Confirma que é uma ATUALIZAÇÃO (regera os vetores).
    const alvos = new Set(idsDoAlvo());
    const jaIndexado = initial.some(
      (r) =>
        r.originKind === "article" &&
        r.embeddedCount > 0 &&
        r.spaceId === spaceId &&
        alvos.has(r.originId),
    );
    if (jaIndexado) {
      const ok = await confirmar({
        title: "Atualizar embeddings?",
        description:
          "Este conteúdo já foi indexado antes. Gerar de novo REGERA os vetores (substitui os atuais). Deseja atualizar?",
        confirmLabel: "Atualizar",
      });
      if (!ok) return;
    }

    setGerando(true);
    const node = nodeSel === "__all__" ? undefined : nodes.find((n) => n.id === nodeSel);
    const res = await enqueueEmbeddingsJob({
      spaceId,
      nodeId: nodeSel === "__all__" ? undefined : nodeSel,
      nodeType: node?.type,
    });
    setGerando(false);
    if (res.ok) toast.success("Geração iniciada — acompanhe o progresso abaixo.");
    else toast.error(res.error);
  }

  async function enviarArquivo(file: File) {
    if (!spaceId) {
      toast.warning("Escolha uma documentação de destino.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.warning(`Arquivo maior que ${MAX_MB} MB.`);
      return;
    }
    setEnviando(true);
    const path = `${spaceId}/kb-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("imports").upload(path, file);
    if (error) {
      setEnviando(false);
      toast.error(`Falha no upload: ${error.message}`);
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
    if (res.ok) toast.success("Arquivo indexado — o chatbot já pode usá-lo.");
    else toast.error(res.error);
    router.refresh();
  }

  async function apagar(row: EmbeddingReportRow) {
    const ok = await confirmar({
      title: "Apagar embeddings",
      description:
        row.originKind === "file"
          ? `Excluir o arquivo "${row.title}" e seus embeddings? O chatbot deixa de consultá-lo.`
          : `Apagar os vetores do artigo "${row.title}"? A busca por texto continua; os vetores voltam na próxima publicação.`,
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteEmbeddingsOrigin({ kind: row.originKind, id: row.originId });
      router.refresh();
    });
  }

  return (
    <div className="mt-6 space-y-8">
      {/* ── Gerar ─────────────────────────────────────────────────────────── */}
      <Surface elevation={1} padding="lg" className="space-y-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Gerar embeddings
        </h2>

        <Field label="Documentação de destino" htmlFor="emb-space">
          <Select
            id="emb-space"
            value={spaceId}
            onChange={(v) => {
              setSpaceId(v);
              setNodeSel("__all__"); // pasta do espaço antigo não vale mais
            }}
            className={`${controlClass} h-10`}
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex flex-wrap items-end gap-2">
          <Field
            label="A partir do conteúdo existente"
            htmlFor="emb-node"
            hint={nodesLoading ? "Carregando…" : "Um diretório (subárvore), um artigo, ou tudo."}
          >
            <Select
              id="emb-node"
              value={nodeSel}
              onChange={(v) => setNodeSel(v)}
              disabled={nodesLoading}
              className={`${controlClass} h-10 min-w-[18rem]`}
            >
              <option value="__all__">Toda a documentação</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {"— ".repeat(n.depth)}
                  {n.type === "folder" ? "📁 " : ""}
                  {n.title}
                </option>
              ))}
            </Select>
          </Field>
          <Button onClick={gerar} disabled={gerando || !spaceId}>
            {gerando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {gerando ? "Gerando…" : "Gerar"}
          </Button>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-text-muted">Ou a partir de um arquivo</p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary">
            <FileUp className="size-6 text-text-muted" />
            <span className="text-sm font-medium">
              {enviando ? "Processando…" : "Clique para escolher um arquivo"}
            </span>
            <span className="text-xs text-text-muted">
              PDF, Word, Excel, CSV, HTML, Markdown · até {MAX_MB} MB — indexado só para o chatbot
            </span>
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              disabled={enviando}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void enviarArquivo(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

      </Surface>

      {/* ── Progresso dos jobs ────────────────────────────────────────────── */}
      {ativos.length > 0 && (
        <Surface elevation={1} padding="lg" className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Gerando embeddings…
          </h2>
          {ativos.map((j) => (
            <div key={j.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">
                  {nomeEspaco(j.space_id)} · {SCOPE_LABEL[j.scope] ?? j.scope}
                </span>
                <span className="tabular-nums text-text-muted">
                  {j.total ? `${j.done}/${j.total}` : "iniciando…"}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={j.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progresso da geração de embeddings"
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2"
              >
                <div
                  className="h-full bg-primary transition-[width] duration-base ease-out motion-reduce:transition-none"
                  style={{ width: `${j.progress}%` }}
                />
              </div>
            </div>
          ))}
        </Surface>
      )}

      {/* ── Relatório ─────────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Indexado
        </h2>
        {initial.length === 0 ? (
          <EmptyState
            icon={Database}
            title="Nenhum embedding gerado ainda"
            description="Gere acima (por arquivo ou selecionando um diretório/artigo) ou publique artigos para o chatbot indexar o conteúdo."
          />
        ) : (
          <DataTable>
            <DataHead>
              <Th>Origem</Th>
              <Th>Documentação</Th>
              <Th>Indexado</Th>
              <Th>Provedor</Th>
              <Th>Data</Th>
              <Th>Usuário</Th>
              <Th>Ações</Th>
            </DataHead>
            <tbody>
              {initial.length === 0 && <EmptyRow colSpan={7}>Nada aqui.</EmptyRow>}
              {initial.map((r) => (
                <Tr key={`${r.originKind}-${r.originId}`}>
                  <Td>
                    <div className="flex items-start gap-2">
                      {r.originKind === "file" ? (
                        <FileUp className="mt-0.5 size-4 shrink-0 text-text-muted" />
                      ) : (
                        <FileText className="mt-0.5 size-4 shrink-0 text-text-muted" />
                      )}
                      <div className="min-w-0">
                        <span className="font-medium">{r.title}</span>
                        {r.directory && (
                          <div className="truncate text-xs text-text-muted" title={r.directory}>
                            {r.directory}
                          </div>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td className="text-text-muted">{r.spaceName}</Td>
                  <Td className="tabular-nums">
                    {r.embeddedCount === 0 ? (
                      <Badge tone="warning">só texto</Badge>
                    ) : (
                      <span>
                        {r.embeddedCount}
                        {r.embeddedCount !== r.chunkCount && (
                          <span className="text-text-muted">/{r.chunkCount}</span>
                        )}{" "}
                        <span className="text-text-muted">trechos</span>
                      </span>
                    )}
                  </Td>
                  <Td className="text-text-muted">
                    {r.provider ? (
                      <div>
                        <div>{PROVIDER_LABEL[r.provider] ?? r.provider}</div>
                        {r.model && <div className="text-xs">{r.model}</div>}
                      </div>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-text-muted">{data(r.embeddedAt)}</Td>
                  <Td className="text-text-muted">{r.userName ?? "Sistema"}</Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => apagar(r)}
                      title="Apagar embeddings"
                    >
                      <Trash2 className="size-4 text-red-600 dark:text-red-400" />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>
    </div>
  );
}
