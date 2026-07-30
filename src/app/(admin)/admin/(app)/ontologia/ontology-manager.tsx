"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Network, Pencil, Plus, ScanSearch, Sparkles, Target, Trash2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ACCEPT_ATTR } from "@/lib/importer/file-guard";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { Segmented } from "@/components/ui/segmented";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import {
  addAlias,
  deleteAlias,
  deleteTerm,
  enqueueOntologyImportJob,
  enqueueOntologyScanJob,
  saveTerm,
  type OntologyJobRow,
  type OntologyKind,
  type OntologySource,
  type OntologyTermRow,
} from "./actions";

const KIND_LABEL: Record<OntologyKind, string> = {
  conceito: "Conceito",
  entidade: "Entidade",
  acao: "Ação",
  sigla: "Sigla",
  outro: "Outro",
};
const KIND_TONE: Record<OntologyKind, BadgeTone> = {
  conceito: "primary",
  entidade: "info",
  acao: "accent",
  sigla: "warning",
  outro: "neutral",
};
const KINDS = Object.keys(KIND_LABEL) as OntologyKind[];
const VAZIO = { id: undefined as string | undefined, term: "", kind: "conceito" as OntologyKind, description: "", nodeId: null as string | null };

type NodeOpt = { id: string; title: string; type: string; depth: number };

export function OntologyManager({
  spaceId,
  initialTerms,
  initialJobs,
  nodes,
  canManage,
}: {
  spaceId: string;
  initialTerms: OntologyTermRow[];
  initialJobs: OntologyJobRow[];
  nodes: NodeOpt[];
  canManage: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { confirmar } = useConfirm();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [jobs, setJobs] = useState<OntologyJobRow[]>(initialJobs);
  const ativos = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [nodeSel, setNodeSel] = useState("__all__");

  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<OntologyKind | "">("");
  const [sourceFilter, setSourceFilter] = useState<"" | OntologySource>("");
  const [editando, setEditando] = useState<typeof VAZIO | null>(null);
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, string>>({});

  // Progresso da varredura via Realtime (mesmo padrão dos embeddings).
  useEffect(() => {
    const channel = supabase
      .channel("ontology-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ontology_jobs", filter: `space_id=eq.${spaceId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setJobs((prev) => prev.filter((j) => j.id !== (payload.old as { id: string }).id));
            return;
          }
          const row = payload.new as OntologyJobRow;
          setJobs((prev) =>
            prev.some((j) => j.id === row.id) ? prev.map((j) => (j.id === row.id ? { ...j, ...row } : j)) : [row, ...prev],
          );
          if (row.status === "done") {
            toast.success(`Varredura concluída — ${row.found} novo(s) item(ns) na ontologia.`);
            router.refresh();
          } else if (row.status === "error") {
            toast.error(row.error ?? "A varredura falhou.");
            router.refresh();
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, router, spaceId, toast]);

  // Rede de segurança: se o Realtime não entregar, recarrega os jobos ativos por
  // polling e atualiza o relatório quando tudo termina.
  useEffect(() => {
    if (ativos.length === 0) return;
    let alive = true;
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("ontology_jobs")
        .select("id, space_id, scope, target_id, status, total, done, progress, found, error, created_at")
        .eq("space_id", spaceId)
        .in("status", ["queued", "running"]);
      if (!alive) return;
      setJobs((data ?? []) as OntologyJobRow[]);
      if ((data ?? []).length === 0) router.refresh();
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [ativos.length, supabase, router, spaceId]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, aoOk?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) aoOk?.();
      else toast.error(r.error ?? "Falha.");
      router.refresh();
    });
  }

  async function varrer() {
    setGerando(true);
    const node = nodeSel === "__all__" ? undefined : nodes.find((n) => n.id === nodeSel);
    const r = await enqueueOntologyScanJob({
      spaceId,
      nodeId: nodeSel === "__all__" ? undefined : nodeSel,
      nodeType: node?.type,
    });
    setGerando(false);
    if (r.ok) toast.success("Varredura iniciada — acompanhe o progresso abaixo.");
    else toast.error(r.error);
  }

  async function subirArquivo(file: File) {
    setEnviando(true);
    try {
      // 1º segmento = spaceId (a policy do bucket `imports` extrai o espaço do
      // path via storage_space_id e exige content.edit). Nome sanitizado no path;
      // o nome real vai à action para a IA detectar a extensão.
      const path = `${spaceId}/${Date.now()}-ontologia-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("imports").upload(path, file);
      if (error) return toast.error(`Falha no upload: ${error.message}`);
      const r = await enqueueOntologyImportJob({ spaceId, sourceFile: path, originalName: file.name, sizeBytes: file.size });
      if (!r.ok) return toast.error(r.error);
      toast.success("Arquivo enviado — gerando termos e sinônimos por IA. Acompanhe o progresso.");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  const filtrados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return initialTerms.filter((t) => {
      if (kindFilter && t.kind !== kindFilter) return false;
      if (sourceFilter && t.source !== sourceFilter) return false;
      if (!termo) return true;
      return (
        t.term.toLowerCase().includes(termo) ||
        (t.description ?? "").toLowerCase().includes(termo) ||
        t.aliases.some((a) => a.alias.toLowerCase().includes(termo))
      );
    });
  }, [initialTerms, q, kindFilter, sourceFilter]);

  const totalAliases = initialTerms.reduce((n, t) => n + t.aliases.length, 0);

  return (
    <div className="space-y-8">
      {/* ── Varredura por IA ──────────────────────────────────────────────── */}
      <Surface elevation={1} padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <ScanSearch className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Varredura por IA</h2>
            <p className="mt-0.5 text-sm text-text-muted">
              A IA configurada no Chat lê todos os artigos desta documentação e sugere termos +
              sinônimos, já cadastrados como origem “IA”. Termos que você editou à mão são preservados.
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-end gap-2">
            <Field
              label="Escopo da varredura"
              htmlFor="onto-escopo"
              hint="Tudo, um diretório (com todo o conteúdo abaixo) ou um artigo."
            >
              <select
                id="onto-escopo"
                value={nodeSel}
                onChange={(e) => setNodeSel(e.target.value)}
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
              </select>
            </Field>
            <Button onClick={varrer} disabled={gerando || ativos.length > 0}>
              {gerando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {ativos.length > 0 ? "Em andamento…" : "Nova varredura"}
            </Button>
          </div>
        )}

        {ativos.map((j) => (
          <div key={j.id}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">
                {j.status === "queued"
                  ? "Na fila — aguardando o worker (npm run worker)…"
                  : j.scope === "import"
                    ? "Importando termos do arquivo e gerando sinônimos…"
                    : "Lendo os artigos e extraindo termos…"}
              </span>
              <span className="tabular-nums text-text-muted">
                {j.status === "queued" ? "na fila" : j.total ? `${j.done}/${j.total}` : "iniciando…"}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={j.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2"
            >
              <div className="h-full bg-primary transition-[width] duration-base ease-out" style={{ width: `${j.progress}%` }} />
            </div>
          </div>
        ))}
      </Surface>

      {/* ── Importar termos de arquivo ────────────────────────────────────── */}
      {canManage && (
        <Surface elevation={1} padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-start gap-3">
            <Upload className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Importar termos de arquivo</h2>
              <p className="mt-0.5 text-sm text-text-muted">
                Suba um arquivo com uma lista de palavras (txt, csv, planilha, Word, PDF…). O sistema
                cria cada termo e <strong>gera os sinônimos por IA</strong>, sem duplicar o que já existe.
                Um termo por linha; se a linha tiver vírgula/ponto-e-vírgula, o 1º campo é o termo e o
                restante são sinônimos que você já quer incluir.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void subirArquivo(f);
              }}
            />
            <Button
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              disabled={enviando || ativos.length > 0}
            >
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              {ativos.length > 0 ? "Aguarde o job atual…" : "Escolher arquivo…"}
            </Button>
          </div>
        </Surface>
      )}

      {/* ── Toolbar do CRUD ───────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">
              Termos <span className="tabular-nums text-text-muted">({initialTerms.length})</span>{" "}
              <span className="font-normal text-text-muted">· {totalAliases} sinônimo(s)</span>
            </h2>
          </div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar termo ou sinônimo…"
            className="h-9 w-56"
          />
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as OntologyKind | "")}
            aria-label="Filtrar por tipo"
            className={`${controlClass} h-9 w-auto`}
          >
            <option value="">Todos os tipos</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <Segmented<"" | OntologySource>
            value={sourceFilter}
            onChange={setSourceFilter}
            options={[
              { value: "", label: "Todos" },
              { value: "ia", label: "IA" },
              { value: "upload", label: "Arquivo" },
              { value: "manual", label: "Manual" },
            ]}
          />
          {canManage && (
            <Button size="sm" variant="secondary" onClick={() => setEditando({ ...VAZIO })}>
              <Plus className="size-4" /> Novo termo
            </Button>
          )}
        </div>

        {initialTerms.length === 0 ? (
          <EmptyState
            icon={Network}
            title="Nenhum termo ainda"
            description="Rode a varredura por IA para preencher automaticamente, ou crie termos à mão."
          />
        ) : filtrados.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
            Nada encontrado com esse filtro.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {filtrados.map((t) => (
              <li key={t.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.term}</span>
                      <Badge tone={KIND_TONE[t.kind]}>{KIND_LABEL[t.kind]}</Badge>
                      {t.source === "ia" && (
                        <Badge tone="neutral" className="inline-flex items-center gap-1">
                          <Sparkles className="size-3" /> IA
                        </Badge>
                      )}
                      {t.source === "upload" && (
                        <Badge tone="neutral" className="inline-flex items-center gap-1">
                          <FileText className="size-3" /> Arquivo
                        </Badge>
                      )}
                      {t.nodeId && (
                        <Badge
                          tone="primary"
                          className="inline-flex items-center gap-1"
                          title="Nó responsável — forçado no chat quando o termo é perguntado"
                        >
                          <Target className="size-3" /> {t.nodeTitle ?? "responsável"}
                        </Badge>
                      )}
                    </div>
                    {t.description && <p className="mt-0.5 text-sm text-text-muted">{t.description}</p>}

                    {/* Sinônimos como chips */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {t.aliases.map((a) => (
                        <span
                          key={a.id}
                          className="group inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs"
                        >
                          {a.alias}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => run(() => deleteAlias(a.id))}
                              disabled={pending}
                              aria-label={`Remover sinônimo ${a.alias}`}
                              className="text-text-muted opacity-60 hover:text-brand-pink-700 hover:opacity-100"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </span>
                      ))}
                      {t.aliases.length === 0 && (
                        <span className="text-xs text-text-muted">sem sinônimos</span>
                      )}
                      {canManage && (
                        <input
                          value={aliasDrafts[t.id] ?? ""}
                          onChange={(e) => setAliasDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            const v = (aliasDrafts[t.id] ?? "").trim();
                            if (!v) return;
                            run(
                              () => addAlias(t.id, v),
                              () => setAliasDrafts((d) => ({ ...d, [t.id]: "" })),
                            );
                          }}
                          placeholder="+ sinônimo"
                          aria-label={`Adicionar sinônimo a ${t.term}`}
                          className="h-6 w-28 rounded-full border border-dashed border-border bg-transparent px-2 text-xs focus:border-primary focus:outline-none"
                        />
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditando({ id: t.id, term: t.term, kind: t.kind, description: t.description ?? "", nodeId: t.nodeId })}
                        title="Editar termo"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-brand-pink-700"
                        disabled={pending}
                        onClick={async () => {
                          if (
                            await confirmar({
                              title: "Excluir termo",
                              description: `Excluir "${t.term}" e seus ${t.aliases.length} sinônimo(s)?`,
                              tone: "danger",
                            })
                          )
                            run(() => deleteTerm(t.id));
                        }}
                        title="Excluir termo"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Criar/editar termo */}
      <Dialog
        open={!!editando}
        onClose={() => !pending && setEditando(null)}
        title={editando?.id ? "Editar termo" : "Novo termo"}
        description="O termo canônico e o tipo. Adicione sinônimos na lista depois de salvar."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditando(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              disabled={pending || !editando?.term.trim()}
              onClick={() =>
                editando &&
                run(
                  () =>
                    saveTerm({
                      id: editando.id,
                      spaceId,
                      term: editando.term,
                      kind: editando.kind,
                      description: editando.description.trim() || null,
                      nodeId: editando.nodeId,
                    }),
                  () => setEditando(null),
                )
              }
            >
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </>
        }
      >
        {editando && (
          <div className="space-y-4">
            <Field label="Termo" htmlFor="onto-term">
              <Input
                id="onto-term"
                value={editando.term}
                onChange={(e) => setEditando({ ...editando, term: e.target.value })}
                placeholder="Ex.: Nota Fiscal"
                autoFocus
              />
            </Field>
            <Field label="Tipo" htmlFor="onto-kind">
              <select
                id="onto-kind"
                value={editando.kind}
                onChange={(e) => setEditando({ ...editando, kind: e.target.value as OntologyKind })}
                className={`${controlClass} h-10`}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Descrição (opcional)" htmlFor="onto-desc">
              <textarea
                id="onto-desc"
                rows={2}
                maxLength={300}
                value={editando.description}
                onChange={(e) => setEditando({ ...editando, description: e.target.value })}
                className={controlClass}
                placeholder="Uma frase sobre o que é."
              />
            </Field>
            <Field
              label="Responsável (artigo/diretório)"
              htmlFor="onto-node"
              hint="Quando este termo é perguntado no chat, o conteúdo escolhido é FORÇADO no contexto (um diretório inclui a subárvore)."
            >
              <select
                id="onto-node"
                value={editando.nodeId ?? ""}
                onChange={(e) => setEditando({ ...editando, nodeId: e.target.value || null })}
                className={`${controlClass} h-10`}
              >
                <option value="">— nenhum —</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {"  ".repeat(n.depth)}
                    {n.type === "folder" ? "📁 " : "📄 "}
                    {n.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
