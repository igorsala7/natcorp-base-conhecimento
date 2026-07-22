"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Folder, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";
import type { ProposedNode } from "@/lib/importer/structure";
import { materializeImport } from "../actions";
import { listSpaceFolders } from "../../conteudo/space-actions";

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
  spaces,
  defaultSpaceId,
}: {
  jobId: string;
  fileName: string;
  tree: ProposedNode[];
  images: string[];
  usedAi: boolean;
  spaces: { id: string; name: string; type: "global" | "client" }[];
  defaultSpaceId: string;
}) {
  const router = useRouter();
  const [tree, setTree] = useState<ProposedNode[]>(initialTree);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // Destino da importação (escolhido na confirmação).
  const [askTarget, setAskTarget] = useState(false);
  const [spaceId, setSpaceId] = useState(defaultSpaceId);
  const [parentId, setParentId] = useState<string>("__root__");
  // Pastas carregadas junto do espaço a que pertencem — assim o "carregando"
  // é derivado (nada de setState síncrono dentro do efeito).
  const [loaded, setLoaded] = useState<{
    spaceId: string;
    list: { id: string; title: string; depth: number }[];
  } | null>(null);
  const folders = loaded?.spaceId === spaceId ? loaded.list : [];
  const loadingFolders = askTarget && loaded?.spaceId !== spaceId;
  const [useNewFolder, setUseNewFolder] = useState(true);
  const [newFolderTitle, setNewFolderTitle] = useState(
    fileName.replace(/\.[^.]+$/, "").slice(0, 80),
  );
  // A pergunta da confirmação: a IA já reformata o layout de TODOS os
  // artigos? Nasce desligada — é um passe demorado e o autor pode preferir
  // revisar o texto cru primeiro (dá para melhorar depois, pelo editor).
  const [melhorarLayout, setMelhorarLayout] = useState(false);

  // Carrega as pastas da documentação escolhida (o nível onde vai pendurar).
  useEffect(() => {
    if (!askTarget) return;
    let alive = true;
    void listSpaceFolders(spaceId).then((list) => {
      if (alive) setLoaded({ spaceId, list });
    });
    return () => {
      alive = false;
    };
  }, [askTarget, spaceId]);

  function confirm() {
    startTransition(async () => {
      const res = await materializeImport(
        jobId,
        tree,
        {
          spaceId,
          parentId: parentId === "__root__" ? null : parentId,
          newFolderTitle: useNewFolder ? newFolderTitle : null,
        },
        { melhorarLayout },
      );
      if (!res.ok) setMsg(res.error);
      // Melhorando em segundo plano: permanece nesta página, que vira a tela
      // de progresso da fase de layout (e navega ao destino quando terminar).
      else if (res.improving) router.refresh();
      // Sem melhoria: direto para a PÁGINA DO DIRETÓRIO onde o conteúdo
      // entrou (a pasta criada/escolhida), não para a árvore genérica.
      else if (res.destino?.nodeId) router.push(`/admin/conteudo/${res.destino.nodeId}`);
      else router.push(`/admin/conteudo?space=${res.destino?.spaceId ?? spaceId}`);
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
        <Button onClick={() => setAskTarget(true)} disabled={pending}>
          {pending ? "Importando…" : "Confirmar importação"}
        </Button>
      </div>

      <Dialog
        open={askTarget}
        onClose={() => !pending && setAskTarget(false)}
        title="Onde importar?"
        description="Escolha a documentação e o ponto da árvore que vai receber o conteúdo."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAskTarget(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={pending || (useNewFolder && !newFolderTitle.trim())}>
              {pending ? "Importando…" : "Importar aqui"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Documentação" htmlFor="imp-space">
            <select
              id="imp-space"
              value={spaceId}
              onChange={(e) => {
                setSpaceId(e.target.value);
                setParentId("__root__"); // pasta do espaço antigo não vale mais
              }}
              className={`${controlClass} h-10`}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Nível na árvore"
            htmlFor="imp-parent"
            hint={loadingFolders ? "Carregando pastas…" : undefined}
          >
            <select
              id="imp-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              disabled={loadingFolders}
              className={`${controlClass} h-10`}
            >
              <option value="__root__">Raiz da documentação</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {"— ".repeat(f.depth)}
                  {f.title}
                </option>
              ))}
            </select>
          </Field>

          <div className="rounded-lg border border-border p-3">
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={useNewFolder}
                onChange={(e) => setUseNewFolder(e.target.checked)}
                className="mt-1 accent-[var(--color-primary)]"
              />
              <span>
                <span className="font-medium">Criar uma pasta para todo o conteúdo</span>
                <span className="block text-xs leading-relaxed text-text-muted">
                  Tudo o que foi importado fica pendurado nela, em vez de misturar com o que já
                  existe.
                </span>
              </span>
            </label>
            {useNewFolder && (
              <Input
                value={newFolderTitle}
                onChange={(e) => setNewFolderTitle(e.target.value)}
                placeholder="Nome da nova pasta"
                aria-label="Nome da nova pasta"
                className="mt-3"
              />
            )}
          </div>

          <div className="rounded-lg border border-border p-3">
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={melhorarLayout}
                onChange={(e) => setMelhorarLayout(e.target.checked)}
                className="mt-1 accent-[var(--color-primary)]"
              />
              <span>
                <span className="font-medium">Melhorar o layout com IA após importar</span>
                <span className="block text-xs leading-relaxed text-text-muted">
                  A IA reformata TODOS os artigos em blocos ricos (passos, avisos, tabelas) sem
                  reescrever o texto — as imagens permanecem em largura total. Roda em segundo
                  plano e pode levar alguns minutos; o progresso aparece nesta tela.
                </span>
              </span>
            </label>
          </div>
        </div>
      </Dialog>

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
