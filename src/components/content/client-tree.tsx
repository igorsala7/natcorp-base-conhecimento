"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Folder, Link2, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EffectiveNode, Badge } from "@/lib/content/overlays";
import {
  customizeNode,
  hideNode,
  revertOverlay,
  createExclusiveNode,
} from "@/app/(admin)/admin/(app)/conteudo/space-actions";

const ICON = { folder: Folder, article: FileText, link: Link2, divider: Minus } as const;

const BADGE_STYLE: Record<Badge, string> = {
  proprio: "",
  herdado: "bg-brand-gray-100 text-text-muted dark:bg-brand-gray-800",
  customizado: "bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40",
  oculto: "bg-brand-gray-100 text-text-muted line-through dark:bg-brand-gray-800",
  exclusivo: "bg-brand-pink-50 text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300",
};
const BADGE_LABEL: Record<Badge, string> = {
  proprio: "",
  herdado: "Herdado",
  customizado: "Customizado",
  oculto: "Oculto",
  exclusivo: "Exclusivo",
};

export function ClientTree({
  clientSpaceId,
  nodes,
}: {
  clientSpaceId: string;
  nodes: EffectiveNode[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      setMsg(res.ok ? null : (res.error ?? "Falha."));
      router.refresh();
    });
  }

  function actions(n: EffectiveNode) {
    const open = () => router.push(`/admin/conteudo/${n.id}?space=${clientSpaceId}`);
    switch (n.badge) {
      case "herdado":
        return (
          <>
            {n.type === "article" && (
              <button className="text-xs text-primary hover:underline" disabled={pending}
                onClick={() => run(() => customizeNode(clientSpaceId, n.id))}>
                Customizar
              </button>
            )}
            <button className="text-xs text-text-muted hover:text-text" disabled={pending}
              onClick={() => run(() => hideNode(clientSpaceId, n.id, true))}>
              Ocultar
            </button>
          </>
        );
      case "oculto":
        return (
          <button className="text-xs text-primary hover:underline" disabled={pending}
            onClick={() => run(() => hideNode(clientSpaceId, n.id, false))}>
            Reexibir
          </button>
        );
      case "customizado":
        return (
          <>
            {n.type === "article" && (
              <button className="text-xs text-primary hover:underline" onClick={open}>
                Editar
              </button>
            )}
            <button className="text-xs text-text-muted hover:text-brand-pink-700" disabled={pending}
              onClick={() => {
                if (confirm("Reverter para o conteúdo global (descarta a customização)?"))
                  run(() => revertOverlay(clientSpaceId, n.sourceId ?? ""));
              }}>
              Reverter
            </button>
          </>
        );
      case "exclusivo":
        return (
          n.type === "article" && (
            <button className="text-xs text-primary hover:underline" onClick={open}>
              Editar
            </button>
          )
        );
      default:
        return null;
    }
  }

  const render = (list: EffectiveNode[], depth: number) => (
    <ul className={depth > 0 ? "ml-3 border-l border-border pl-2" : ""}>
      {list.map((n) => {
        const Icon = ICON[n.type];
        return (
          <li key={n.id} className="py-0.5">
            <div className={cn("group flex items-center gap-2 rounded px-1 py-1 hover:bg-surface-2", n.hidden && "opacity-60")}>
              <Icon className="size-4 shrink-0 text-text-muted" />
              <span className="flex-1 truncate text-sm">{n.title}</span>
              {n.badge !== "proprio" && (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", BADGE_STYLE[n.badge])}>
                  {BADGE_LABEL[n.badge]}
                </span>
              )}
              <span className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                {actions(n)}
              </span>
            </div>
            {n.children.length > 0 && render(n.children, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <Button size="sm" variant="secondary" disabled={pending}
          onClick={() => {
            const title = prompt("Nome da pasta exclusiva:");
            if (title) run(() => createExclusiveNode({ clientSpaceId, parentId: null, type: "folder", title }));
          }}>
          + Pasta
        </Button>
        <Button size="sm" variant="secondary" disabled={pending}
          onClick={() => {
            const title = prompt("Título do artigo exclusivo:");
            if (title) run(() => createExclusiveNode({ clientSpaceId, parentId: null, type: "article", title }));
          }}>
          + Artigo
        </Button>
      </div>
      {msg && (
        <p className="mb-2 rounded-md bg-brand-pink-50 px-2 py-1 text-xs text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300">
          {msg}
        </p>
      )}
      {nodes.length === 0 ? (
        <p className="px-2 py-6 text-sm text-text-muted">Espaço vazio.</p>
      ) : (
        render(nodes, 0)
      )}
    </div>
  );
}
