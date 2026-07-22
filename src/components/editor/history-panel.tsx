"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Lock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm";
import { RenderBlocks } from "@/lib/blocks/render";
import { normalizeDoc } from "@/lib/blocks/convert";
import { wordDiff, type DiffOp } from "@/lib/content/word-diff";
import {
  listArticleVersions,
  getArticleVersion,
  snapshotArticleVersion,
  renameArticleVersion,
  restoreArticleVersion,
  type ArticleVersion,
} from "@/app/(admin)/admin/(app)/conteudo/version-actions";

type Detail =
  | { mode: "view"; content: object }
  | { mode: "diff"; ops: DiffOp[]; aLabel: string; bLabel: string }
  | null;

export function HistoryPanel({
  nodeId,
  canRestore,
  onClose,
}: {
  nodeId: string;
  canRestore: boolean;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<ArticleVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const { confirmar, pedirTexto } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail>(null);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");

  async function load() {
    setLoading(true);
    const v = await listArticleVersions(nodeId);
    setVersions(v);
    if (v.length >= 2) {
      setAId(v[1]!.id); // penúltima
      setBId(v[0]!.id); // última
    } else if (v.length === 1) {
      setAId(v[0]!.id);
      setBId(v[0]!.id);
    }
    setLoading(false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  async function view(id: string) {
    const r = await getArticleVersion(id);
    if (r.ok) setDetail({ mode: "view", content: r.content });
    else setMsg(r.error);
  }

  async function compare() {
    if (!aId || !bId) return;
    const [ra, rb] = await Promise.all([getArticleVersion(aId), getArticleVersion(bId)]);
    if (!ra.ok || !rb.ok) {
      setMsg("Não foi possível carregar as versões.");
      return;
    }
    const va = versions.find((v) => v.id === aId);
    const vb = versions.find((v) => v.id === bId);
    setDetail({
      mode: "diff",
      ops: wordDiff(ra.text, rb.text),
      aLabel: `v${va?.version} ${va?.label ?? ""}`.trim(),
      bLabel: `v${vb?.version} ${vb?.label ?? ""}`.trim(),
    });
  }

  async function saveNamed() {
    const label = await pedirTexto({
      title: "Salvar versão nomeada",
      label: "Rótulo da versão",
      placeholder: "Ex.: Revisão jurídica jul/2026",
    });
    if (label === null) return;
    const isProtected = await confirmar({
      title: "Proteger esta versão?",
      description: "Versão protegida fica imune à limpeza automática do histórico.",
      confirmLabel: "Proteger",
      cancelLabel: "Não proteger",
    });
    setBusy(true);
    const r = await snapshotArticleVersion(nodeId, label, isProtected);
    setBusy(false);
    setMsg(r.ok ? "Versão salva." : r.error);
    if (r.ok) load();
  }

  async function editLabel(v: ArticleVersion) {
    const label = await pedirTexto({
      title: "Renomear versão",
      label: "Rótulo",
      initial: v.label ?? "",
      required: false,
    });
    if (label === null) return;
    const isProtected = await confirmar({
      title: "Proteger esta versão?",
      description: "Versão protegida fica imune à limpeza automática do histórico.",
      confirmLabel: "Proteger",
      cancelLabel: "Não proteger",
    });
    setBusy(true);
    const r = await renameArticleVersion(v.id, label, isProtected);
    setBusy(false);
    setMsg(r.ok ? "Atualizada." : r.error);
    if (r.ok) load();
  }

  async function restore(v: ArticleVersion) {
    const ok = await confirmar({
      title: `Restaurar a v${v.version}`,
      description: "A restauração cria uma versão NOVA com esse conteúdo — nada do histórico é perdido.",
      confirmLabel: "Restaurar",
    });
    if (!ok) return;
    setBusy(true);
    const r = await restoreArticleVersion(nodeId, v.id);
    setBusy(false);
    if (r.ok) {
      setMsg("Restaurado — recarregando…");
      setTimeout(() => window.location.reload(), 700);
    } else {
      setMsg(r.error);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title="Histórico de versões"
      className="h-[85vh] max-w-5xl"
      bodyClassName="flex min-h-0 flex-1 flex-col"
      actions={
        <Button size="sm" variant="secondary" onClick={saveNamed} disabled={busy}>
          <Save className="size-4" /> Salvar versão
        </Button>
      }
    >
      <>
        {msg && (
          <p
            role="status"
            className="mx-5 mb-2 rounded-md bg-brand-purple-50 px-3 py-2 text-sm text-primary dark:bg-brand-purple-950/30"
          >
            {msg}
          </p>
        )}

        <div className="flex min-h-0 flex-1 border-t border-border">
          {/* Lista de versões */}
          <div className="w-80 shrink-0 overflow-auto border-r border-border p-3">
            <div className="mb-3 rounded-lg border border-border p-2">
              <p className="mb-1 text-xs font-medium text-text-muted">Comparar</p>
              <div className="flex items-center gap-1">
                <select className="h-7 min-w-0 flex-1 rounded border border-border bg-bg px-1 text-xs" value={aId} onChange={(e) => setAId(e.target.value)}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>v{v.version}{v.label ? ` · ${v.label}` : ""}</option>
                  ))}
                </select>
                <span className="text-xs text-text-muted">↔</span>
                <select className="h-7 min-w-0 flex-1 rounded border border-border bg-bg px-1 text-xs" value={bId} onChange={(e) => setBId(e.target.value)}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>v{v.version}{v.label ? ` · ${v.label}` : ""}</option>
                  ))}
                </select>
              </div>
              <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={compare} disabled={versions.length < 1}>
                Ver diferenças
              </Button>
            </div>

            {loading ? (
              <p className="p-3 text-sm text-text-muted">Carregando…</p>
            ) : versions.length === 0 ? (
              <p className="p-3 text-sm text-text-muted">
                Sem versões ainda. Publique o artigo ou clique em “Salvar versão”.
              </p>
            ) : (
              <ul className="space-y-1">
                {versions.map((v) => (
                  <li key={v.id} className="rounded-lg border border-border p-2 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">v{v.version}</span>
                      {v.protected && <Lock className="size-3 text-primary" aria-label="Protegida" />}
                      <span className="ml-auto text-[11px] text-text-muted">
                        {new Date(v.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {v.label && <p className="truncate text-xs text-text-muted">{v.label}</p>}
                    {v.author && <p className="truncate text-[11px] text-text-muted">por {v.author}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <button className="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-surface-2" onClick={() => view(v.id)}>Ver</button>
                      <button className="rounded px-1.5 py-0.5 text-xs text-text-muted hover:bg-surface-2" onClick={() => editLabel(v)}>Rótulo</button>
                      {canRestore && (
                        <button className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-text-muted hover:bg-surface-2 hover:text-primary" onClick={() => restore(v)}>
                          <RotateCcw className="size-3" /> Restaurar
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Detalhe: ver versão ou diff */}
          <div className="min-w-0 flex-1 overflow-auto p-5">
            {!detail && (
              <p className="mt-10 text-center text-sm text-text-muted">
                Selecione “Ver” em uma versão, ou compare duas versões.
              </p>
            )}
            {detail?.mode === "view" && (
              // Mesmo contexto tipográfico da leitura (escala + deslocamento
              // de títulos) — a versão antiga não pode parecer outro produto.
              <article
                className="leitura prose prose-neutral prose-portal max-w-none dark:prose-invert"
                data-size="normal"
              >
                <RenderBlocks
                  blocks={normalizeDoc(detail.content).blocks}
                  snippets={new Map()}
                  headingShift={2}
                />
              </article>
            )}
            {detail?.mode === "diff" && (
              <div>
                <div className="mb-3 grid grid-cols-2 gap-4 text-xs font-medium text-text-muted">
                  <span>{detail.aLabel} <span className="text-brand-pink-700">(removido)</span></span>
                  <span>{detail.bLabel} <span className="text-primary">(adicionado)</span></span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <DiffColumn ops={detail.ops} side="a" />
                  <DiffColumn ops={detail.ops} side="b" />
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    </Dialog>
  );
}

/** Coluna do diff: 'a' mostra iguais + removidos; 'b' mostra iguais + adicionados. */
function DiffColumn({ ops, side }: { ops: DiffOp[]; side: "a" | "b" }) {
  return (
    <div className="whitespace-pre-wrap rounded-lg border border-border bg-bg p-3 text-sm leading-relaxed">
      {ops.map((op, i) => {
        if (op.type === "eq") return <span key={i}>{op.text}</span>;
        if (op.type === "del" && side === "a")
          return <span key={i} className="rounded bg-brand-pink-100 text-brand-pink-800 line-through dark:bg-brand-pink-950/50 dark:text-brand-pink-300">{op.text}</span>;
        if (op.type === "ins" && side === "b")
          return <span key={i} className="rounded bg-brand-purple-100 text-primary dark:bg-brand-purple-950/50">{op.text}</span>;
        return null;
      })}
    </div>
  );
}
