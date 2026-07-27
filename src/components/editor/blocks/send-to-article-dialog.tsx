"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronRight, ChevronDown, FileText, Folder, Home } from "lucide-react";
import type { Block } from "@/lib/blocks/schema";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  listDestinationSpaces,
  listDestinationNodes,
  sendSelectionToArticle,
} from "@/app/(admin)/admin/(app)/conteudo/send-to-actions";

type NodeRow = { id: string; parent_id: string | null; type: string; title: string };

/**
 * Copiar/Mover a seleção de blocos para um artigo. Navega documentação › pasta ›
 * sub-pasta › artigo. Modo "Existente" (destino = um artigo) ou "Novo" (destino =
 * uma pasta/raiz + título; pode criar novas pastas no caminho). "Mover" avisa o
 * editor (via onDone) para remover os blocos da origem.
 */
export function SendToArticleDialog({
  blocks,
  onClose,
  onDone,
}: {
  blocks: Block[];
  onClose: () => void;
  onDone: (mover: boolean) => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [acao, setAcao] = useState<"copiar" | "mover">("copiar");
  const [modo, setModo] = useState<"existing" | "new">("existing");
  const [spaces, setSpaces] = useState<{ id: string; name: string; type: string }[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [alvoArtigo, setAlvoArtigo] = useState<string | null>(null);
  const [paiNovo, setPaiNovo] = useState<string | null>(null); // null = raiz
  const [pastasNovas, setPastasNovas] = useState("");
  const [titulo, setTitulo] = useState("");

  useEffect(() => {
    listDestinationSpaces().then((s) => {
      setSpaces(s);
      if (s[0]) setSpaceId(s[0].id);
    });
  }, []);

  useEffect(() => {
    if (!spaceId) return;
    // Reset + carrega ao trocar a documentação (padrão fetch-on-change).
    /* eslint-disable react-hooks/set-state-in-effect */
    setCarregando(true);
    setNodes([]);
    setAlvoArtigo(null);
    setPaiNovo(null);
    setExpandido(new Set());
    /* eslint-enable react-hooks/set-state-in-effect */
    listDestinationNodes(spaceId)
      .then(setNodes)
      .finally(() => setCarregando(false));
  }, [spaceId]);

  const byParent = useMemo(() => {
    const m = new Map<string | null, NodeRow[]>();
    for (const n of nodes) {
      const l = m.get(n.parent_id) ?? [];
      l.push(n);
      m.set(n.parent_id, l);
    }
    return m;
  }, [nodes]);

  function toggle(id: string) {
    setExpandido((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const podeConfirmar = modo === "existing" ? !!alvoArtigo : !!titulo.trim();

  function confirmar() {
    if (!podeConfirmar || pending) return;
    start(async () => {
      const res = await sendSelectionToArticle(
        modo === "existing"
          ? { blocks, mode: "existing", targetNodeId: alvoArtigo! }
          : {
              blocks,
              mode: "new",
              spaceId,
              parentId: paiNovo,
              folderPath: pastasNovas.split("/").map((s) => s.trim()).filter(Boolean),
              title: titulo.trim(),
            },
      );
      if (res.ok) {
        toast.success(acao === "mover" ? "Conteúdo movido." : "Conteúdo copiado.");
        onDone(acao === "mover");
      } else toast.error(res.error);
    });
  }

  const renderTree = (parentId: string | null, depth: number) => {
    const filhos = byParent.get(parentId) ?? [];
    if (!filhos.length) return null;
    return (
      <ul>
        {filhos.map((n) => {
          const pasta = n.type === "folder";
          const aberto = expandido.has(n.id);
          const selecionavel = modo === "existing" ? n.type === "article" : pasta;
          const selecionado = modo === "existing" ? alvoArtigo === n.id : paiNovo === n.id;
          return (
            <li key={n.id}>
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded px-1.5 py-1 text-sm",
                  selecionavel && "cursor-pointer hover:bg-surface-2",
                  selecionado && "bg-brand-purple-50 font-medium text-primary dark:bg-brand-purple-950/30",
                  !selecionavel && "text-text-muted",
                )}
                style={{ paddingLeft: 6 + depth * 16 }}
                onClick={() =>
                  selecionavel && (modo === "existing" ? setAlvoArtigo(n.id) : setPaiNovo(n.id))
                }
              >
                {pasta ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(n.id);
                    }}
                    className="shrink-0 text-text-muted hover:text-text"
                  >
                    {aberto ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  </button>
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                {pasta ? (
                  <Folder className="size-4 shrink-0 text-text-muted" />
                ) : (
                  <FileText className="size-4 shrink-0 text-text-muted" />
                )}
                <span className="min-w-0 flex-1 truncate">{n.title}</span>
              </div>
              {pasta && aberto && renderTree(n.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Copiar ou mover conteúdo para um artigo"
      description={`${blocks.length} bloco(s) selecionado(s).`}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!podeConfirmar || pending}>
            {pending ? "Enviando…" : acao === "mover" ? "Mover para cá" : "Copiar para cá"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <Toggle
            label="Ação"
            value={acao}
            options={[["copiar", "Copiar"], ["mover", "Mover"]]}
            onChange={setAcao}
          />
          <Toggle
            label="Destino"
            value={modo}
            options={[["existing", "Existente"], ["new", "Novo"]]}
            onChange={setModo}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-muted">Documentação</label>
          <select
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.type === "client" ? " (cliente)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-text-muted">
            {modo === "existing"
              ? "Escolha o ARTIGO de destino (o conteúdo é acrescentado ao fim dele)"
              : "Escolha a PASTA onde criar (ou a raiz)"}
          </p>
          <div className="max-h-64 overflow-auto rounded-lg border border-border p-1">
            {modo === "new" && (
              <div
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-sm hover:bg-surface-2",
                  paiNovo === null && "bg-brand-purple-50 font-medium text-primary dark:bg-brand-purple-950/30",
                )}
                onClick={() => setPaiNovo(null)}
              >
                <span className="w-3.5" />
                <Home className="size-4 text-text-muted" /> Raiz da documentação
              </div>
            )}
            {carregando ? (
              <p className="px-2 py-6 text-center text-sm text-text-muted">Carregando…</p>
            ) : nodes.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-text-muted">
                Documentação vazia{modo === "existing" ? " — sem artigos para escolher." : "."}
              </p>
            ) : (
              renderTree(null, 0)
            )}
          </div>
        </div>

        {modo === "new" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Novas pastas (opcional)
              </label>
              <input
                value={pastasNovas}
                onChange={(e) => setPastasNovas(e.target.value)}
                placeholder="Ex.: Relatórios / 2026"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-[0.6875rem] text-text-muted">
                Separe por “/” para criar sub-pastas.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Título do novo artigo
              </label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-muted">{label}</label>
      <div className="flex overflow-hidden rounded-md border border-border">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "px-3 py-1.5 text-sm",
              value === v ? "bg-primary text-primary-fg" : "text-text-muted hover:bg-surface-2",
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
