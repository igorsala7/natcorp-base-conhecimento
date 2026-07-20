"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { controlClass } from "@/components/ui/input";
import type { SpaceInfo } from "@/lib/content/spaces";
import {
  listSpaceFolders,
  copyNodesToSpace,
  moveNodesToSpace,
} from "@/app/(admin)/admin/(app)/conteudo/space-actions";

/**
 * Copia ou move os itens selecionados (com toda a subárvore) para outra
 * documentação. "Mover" = copiar no destino e mandar o original para a lixeira
 * (recuperável), porque a troca de documentação exige recriar os nós.
 */
export function CopyToSpaceDialog({
  nodeIds,
  currentSpaceId,
  spaces,
  onClose,
  onDone,
}: {
  nodeIds: string[];
  currentSpaceId: string;
  spaces: SpaceInfo[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const outros = spaces.filter((s) => s.id !== currentSpaceId);
  const [destId, setDestId] = useState(outros[0]?.id ?? "");
  const [parentId, setParentId] = useState("__root__");
  const [modo, setModo] = useState<"copy" | "move">("copy");
  const [loaded, setLoaded] = useState<{
    spaceId: string;
    list: { id: string; title: string; depth: number }[];
  } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const folders = loaded?.spaceId === destId ? loaded.list : [];
  const carregando = !!destId && loaded?.spaceId !== destId;

  useEffect(() => {
    if (!destId) return;
    let alive = true;
    void listSpaceFolders(destId).then((list) => {
      if (alive) setLoaded({ spaceId: destId, list });
    });
    return () => {
      alive = false;
    };
  }, [destId]);

  function submit() {
    setMsg(null);
    startTransition(async () => {
      const parent = parentId === "__root__" ? null : parentId;
      const res =
        modo === "copy"
          ? await copyNodesToSpace(nodeIds, destId, parent)
          : await moveNodesToSpace(nodeIds, destId, parent);
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      onDone(
        `${modo === "copy" ? "Copiado" : "Movido"}: ${res.count} item(ns) para a documentação escolhida.`,
      );
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title="Enviar para outra documentação"
      description={`${nodeIds.length} item(ns) selecionado(s), incluindo tudo abaixo na hierarquia.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || !destId}>
            {pending ? "Enviando…" : modo === "copy" ? "Copiar" : "Mover"}
          </Button>
        </>
      }
    >
      {outros.length === 0 ? (
        <p className="text-sm text-text-muted">
          Não há outra documentação. Crie uma primeiro pelo botão “+” ao lado do seletor.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Segmentado: as duas ações são mutuamente exclusivas e de mesmo peso. */}
          <div
            role="radiogroup"
            aria-label="Ação"
            className="flex gap-1 rounded-lg bg-surface-2 p-1"
          >
            {(["copy", "move"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={modo === m}
                onClick={() => setModo(m)}
                className={`flex-1 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  modo === m
                    ? "bg-surface font-medium text-text shadow-1"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {m === "copy" ? "Copiar" : "Mover"}
              </button>
            ))}
          </div>
          {modo === "move" && (
            <p className="-mt-2 text-xs leading-relaxed text-text-muted">
              Mover recria os itens no destino e manda os originais para a lixeira (recuperáveis).
            </p>
          )}

          <Field label="Documentação de destino" htmlFor="dest-space">
            <select
              id="dest-space"
              value={destId}
              onChange={(e) => {
                setDestId(e.target.value);
                setParentId("__root__");
              }}
              className={`${controlClass} h-10`}
            >
              {outros.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Onde pendurar"
            htmlFor="dest-parent"
            hint={carregando ? "Carregando pastas…" : undefined}
          >
            <select
              id="dest-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              disabled={carregando}
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

          {msg && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {msg}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
