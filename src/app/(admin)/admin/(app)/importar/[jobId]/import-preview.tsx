"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Folder, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProposedNode } from "@/lib/importer/structure";
import { materializeImport } from "../actions";

/** Remove um nó pelo caminho de índices, retornando uma nova árvore. */
function removeAt(tree: ProposedNode[], path: number[]): ProposedNode[] {
  if (path.length === 1) return tree.filter((_, i) => i !== path[0]);
  const [head, ...rest] = path;
  return tree.map((n, i) =>
    i === head ? { ...n, children: removeAt(n.children, rest) } : n,
  );
}

/** Renomeia um nó pelo caminho de índices. */
function renameAt(tree: ProposedNode[], path: number[], title: string): ProposedNode[] {
  const [head, ...rest] = path;
  return tree.map((n, i) => {
    if (i !== head) return n;
    if (rest.length === 0) return { ...n, title };
    return { ...n, children: renameAt(n.children, rest, title) };
  });
}

function Outline({
  nodes,
  path,
  onRename,
  onRemove,
}: {
  nodes: ProposedNode[];
  path: number[];
  onRename: (p: number[], t: string) => void;
  onRemove: (p: number[]) => void;
}) {
  return (
    <ul className={path.length ? "ml-4 border-l border-border pl-3" : ""}>
      {nodes.map((n, i) => {
        const p = [...path, i];
        const isFolder = n.children.length > 0;
        return (
          <li key={p.join("-")} className="py-1">
            <div className="group flex items-center gap-2">
              {isFolder ? (
                <Folder className="size-4 shrink-0 text-text-muted" />
              ) : (
                <FileText className="size-4 shrink-0 text-text-muted" />
              )}
              <input
                value={n.title}
                onChange={(e) => onRename(p, e.target.value)}
                className="flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-border focus:border-ring focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onRemove(p)}
                className="text-text-muted opacity-0 group-hover:opacity-100 hover:text-brand-pink-700"
                title="Descartar seção"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            {n.children.length > 0 && (
              <Outline nodes={n.children} path={p} onRename={onRename} onRemove={onRemove} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RenderNode({ node, images, depth }: { node: ProposedNode; images: string[]; depth: number }) {
  const H = (["h2", "h3", "h4"][Math.min(depth, 2)] ?? "h4") as "h2" | "h3" | "h4";
  return (
    <div className="mb-4">
      <H className="font-semibold">{node.title}</H>
      {node.content.map((c, i) =>
        c.type === "p" ? (
          <p key={i} className="mt-1 text-sm text-text-muted">
            {c.text}
          </p>
        ) : images[c.image] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={images[c.image]} alt="" loading="lazy" decoding="async" className="my-2 max-h-48 rounded" />
        ) : null,
      )}
      {node.children.map((child, i) => (
        <RenderNode key={i} node={child} images={images} depth={depth + 1} />
      ))}
    </div>
  );
}

export function ImportPreview({
  jobId,
  fileName,
  tree: initialTree,
  images,
  usedAi,
}: {
  jobId: string;
  fileName: string;
  tree: ProposedNode[];
  images: string[];
  usedAi: boolean;
}) {
  const router = useRouter();
  const [tree, setTree] = useState<ProposedNode[]>(initialTree);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function confirm() {
    startTransition(async () => {
      const res = await materializeImport(jobId, tree);
      if (!res.ok) setMsg(res.error);
      else router.push("/admin/conteudo");
    });
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Revisar: {fileName}</h1>
          <p className="text-xs text-text-muted">
            {usedAi ? "Estrutura refinada por IA." : "Estrutura por heurística."}{" "}
            Renomeie ou descarte seções antes de confirmar.
          </p>
        </div>
        <Button onClick={confirm} disabled={pending}>
          {pending ? "Importando…" : "Confirmar importação"}
        </Button>
      </div>

      {msg && (
        <p className="mt-2 rounded-md bg-brand-pink-50 px-3 py-2 text-sm text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300">
          {msg}
        </p>
      )}

      <div className="mt-4 grid flex-1 grid-cols-2 gap-4 overflow-hidden">
        <section className="overflow-auto rounded-lg border border-border p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Conteúdo convertido
          </div>
          {tree.map((n, i) => (
            <RenderNode key={i} node={n} images={images} depth={0} />
          ))}
        </section>
        <section className="overflow-auto rounded-lg border border-border p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Estrutura proposta (editável)
          </div>
          <Outline
            nodes={tree}
            path={[]}
            onRename={(p, t) => setTree((prev) => renameAt(prev, p, t))}
            onRemove={(p) => setTree((prev) => removeAt(prev, p))}
          />
        </section>
      </div>
    </div>
  );
}
