"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Eye, EyeOff, FileText, FoldVertical, Folder, Link2, Minus, Trash2, UnfoldVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import type { EffectiveNode, Badge as BadgeKind } from "@/lib/content/overlays";
import {
  customizeNode,
  hideNodes,
  revertOverlay,
  createExclusiveNode,
} from "@/app/(admin)/admin/(app)/conteudo/space-actions";
import { deleteNode } from "@/app/(admin)/admin/(app)/conteudo/actions";

const ICON = { folder: Folder, article: FileText, link: Link2, divider: Minus } as const;

const BADGE_TONE: Record<BadgeKind, BadgeTone> = {
  proprio: "neutral",
  herdado: "neutral",
  customizado: "primary",
  oculto: "warning",
  exclusivo: "info",
};
const BADGE_LABEL: Record<BadgeKind, string> = {
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
  const { confirmar, pedirTexto } = useConfirm();
  const toast = useToast();
  // Diretórios recolhidos (por id). A árvore herdada também precisa expandir/recolher.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function idsComFilhos(list: EffectiveNode[], acc: string[] = []): string[] {
    for (const n of list) {
      if (n.children.length > 0) {
        acc.push(n.id);
        idsComFilhos(n.children, acc);
      }
    }
    return acc;
  }

  // ── Seleção múltipla (ocultar/reexibir em lote) ──────────────────────────
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  function alternarSel(id: string) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // ── Ocultar/reexibir OTIMISTA ────────────────────────────────────────────
  // Reflete o clique na hora (o `router.refresh()` do servidor pode demorar ou
  // não repintar). Chave = id do nó global de origem (o mesmo enviado à ação);
  // valor = hidden desejado. É reconciliado quando o servidor devolve a verdade
  // (bloco abaixo) e revertido se a ação falhar.
  const [otimista, setOtimista] = useState<Map<string, boolean>>(new Map());
  function aplicarOtimista(ids: string[], hidden: boolean) {
    setOtimista((prev) => {
      const n = new Map(prev);
      for (const id of ids) n.set(id, hidden);
      return n;
    });
  }
  function reverterOtimista(ids: string[]) {
    setOtimista((prev) => {
      const n = new Map(prev);
      for (const id of ids) n.delete(id);
      return n;
    });
  }
  /** Só itens VINDOS do global (herdado/customizado/oculto) podem ser ocultados/reexibidos. */
  const selecionavel = (n: EffectiveNode) =>
    n.badge === "herdado" || n.badge === "customizado" || n.badge === "oculto";

  const todos = useMemo(() => {
    const out: EffectiveNode[] = [];
    const walk = (list: EffectiveNode[]) => {
      for (const n of list) {
        out.push(n);
        walk(n.children);
      }
    };
    walk(nodes);
    return out;
  }, [nodes]);

  // Nó global de origem para o overlay: herdado/oculto = o próprio id; customizado = sourceId.
  const idOverlay = (n: EffectiveNode): string | null =>
    n.badge === "oculto" || n.badge === "herdado" ? n.id : n.badge === "customizado" ? n.sourceId : null;

  // Ids de overlay do nó E de TODA a sua subárvore — para cascatear ocultar/
  // reexibir de um diretório a tudo pendurado nele. Cada nó vindo do global tem
  // overlay PRÓPRIO; sem cascatear, reexibir a pasta não reexibe os filhos.
  // Exclusivos do cliente não têm overlay (id nulo) e ficam de fora — a poda do
  // portal já os remove junto com a pasta-pai.
  const idsSubarvore = (n: EffectiveNode): string[] => {
    const out: string[] = [];
    const walk = (x: EffectiveNode) => {
      const id = idOverlay(x);
      if (id) out.push(id);
      x.children.forEach(walk);
    };
    walk(n);
    return [...new Set(out)];
  };

  // Reconciliação: quando o servidor devolve novos nós (verdade), descarta as
  // entradas otimistas que ele já refletiu. Se o servidor ainda não refletiu,
  // a entrada permanece — a UI segue mostrando o estado desejado, sem piscar.
  const [nodesRef, setNodesRef] = useState(nodes);
  if (nodes !== nodesRef) {
    setNodesRef(nodes);
    setOtimista((prev) => {
      if (!prev.size) return prev;
      const servidor = new Map<string, boolean>();
      const walk = (list: EffectiveNode[]) => {
        for (const n of list) {
          const k = idOverlay(n);
          if (k) servidor.set(k, n.hidden);
          walk(n.children);
        }
      };
      walk(nodes);
      let mudou = false;
      const proximo = new Map(prev);
      for (const [id, querido] of prev) {
        if (servidor.get(id) === querido) {
          proximo.delete(id);
          mudou = true;
        }
      }
      return mudou ? proximo : prev;
    });
  }

  // Estado OCULTO efetivo de um nó (aplica o otimista sobre o valor do servidor).
  const ocultoDe = (n: EffectiveNode): boolean => {
    const idOv = idOverlay(n);
    const ot = idOv ? otimista.get(idOv) : undefined;
    return ot === undefined ? n.hidden : ot;
  };

  // Ocultar/reexibir um DIRETÓRIO reflete em TUDO pendurado nele: um nó cujo
  // diretório-ancestral está (efetivamente) oculto entra neste conjunto e é
  // tratado como oculto na árvore. Portal e RAG já podam a subárvore inteira
  // quando a pasta é ocultada — isto torna o mesmo comportamento VISÍVEL no
  // admin. Considera o estado otimista dos ancestrais (reflexo imediato).
  const ocultosPorHeranca = new Set<string>();
  {
    const walk = (list: EffectiveNode[], ancestralOculto: boolean) => {
      for (const n of list) {
        if (ancestralOculto) ocultosPorHeranca.add(n.id);
        walk(n.children, ancestralOculto || ocultoDe(n));
      }
    };
    walk(nodes, false);
  }

  // Só é selecionável para lote o que NÃO está oculto por herança (agir num
  // filho enquanto a pasta o esconde seria inócuo e confuso).
  const selecionaveis = todos.filter((n) => selecionavel(n) && !ocultosPorHeranca.has(n.id));
  const escolhidos = todos.filter(
    (n) => selecionados.has(n.id) && !ocultosPorHeranca.has(n.id),
  );
  // Cada escolhido expande para a SUBÁRVORE inteira — selecionar uma pasta
  // oculta/reexibe tudo que está dentro dela.
  const paraOcultar = [
    ...new Set(
      escolhidos
        .filter((n) => n.badge === "herdado" || n.badge === "customizado")
        .flatMap(idsSubarvore),
    ),
  ];
  const paraReexibir = [
    ...new Set(escolhidos.filter((n) => n.badge === "oculto").flatMap(idsSubarvore)),
  ];

  // "Selecionar tudo": marca/desmarca TODOS os selecionáveis; indeterminado no meio.
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every((n) => selecionados.has(n.id));
  const algunsMarcados = selecionados.size > 0 && !todosMarcados;
  const masterRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (masterRef.current) masterRef.current.indeterminate = algunsMarcados;
  }, [algunsMarcados]);
  function alternarTodos() {
    setSelecionados(todosMarcados ? new Set() : new Set(selecionaveis.map((n) => n.id)));
  }

  function ocultarSel() {
    if (!paraOcultar.length) return;
    runHide(paraOcultar, true, () => hideNodes(clientSpaceId, paraOcultar, true));
    setSelecionados(new Set());
  }
  function reexibirSel() {
    if (!paraReexibir.length) return;
    runHide(paraReexibir, false, () => hideNodes(clientSpaceId, paraReexibir, false));
    setSelecionados(new Set());
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Falha.");
      router.refresh();
    });
  }

  /** Ocultar/reexibir com pintura otimista imediata + reversão se falhar. */
  function runHide(
    ids: string[],
    hidden: boolean,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    if (!ids.length) return;
    aplicarOtimista(ids, hidden);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Falha.");
        reverterOtimista(ids);
        return;
      }
      router.refresh();
    });
  }

  /** Ocultar/reexibir um nó e TODA a sua subárvore (diretório reflete nos filhos). */
  function ocultarNo(n: EffectiveNode, hidden: boolean) {
    const ids = idsSubarvore(n);
    runHide(ids, hidden, () => hideNodes(clientSpaceId, ids, hidden));
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
            <button className="text-xs text-text-muted hover:text-text hover:underline" disabled={pending}
              onClick={() => ocultarNo(n, true)}>
              Ocultar
            </button>
          </>
        );
      case "oculto":
        return (
          <button className="text-xs text-primary hover:underline" disabled={pending}
            onClick={() => ocultarNo(n, false)}>
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
            <button className="text-xs text-text-muted hover:text-brand-pink-700 hover:underline" disabled={pending}
              onClick={async () => {
                if (
                  await confirmar({
                    title: "Reverter customização",
                    description:
                      "Reverter para o conteúdo global? A customização deste cliente é descartada.",
                    tone: "danger",
                    confirmLabel: "Reverter",
                  })
                )
                  run(() => revertOverlay(clientSpaceId, n.sourceId ?? ""));
              }}>
              Reverter
            </button>
          </>
        );
      case "exclusivo":
        // Conteúdo PRÓPRIO do cliente (não herdado) — pode ser editado e
        // excluído. Diferente de herdado/customizado, que só ocultam/revertem.
        return (
          <>
            {n.type === "article" && (
              <button className="text-xs text-primary hover:underline" onClick={open}>
                Editar
              </button>
            )}
            <button
              className="flex items-center gap-1 text-xs text-text-muted hover:text-brand-pink-700 hover:underline"
              disabled={pending}
              title="Excluir (vai para a lixeira, restaurável em 30 dias)"
              onClick={async () => {
                if (
                  await confirmar({
                    title: "Excluir",
                    description: `Excluir "${n.title}"${
                      n.type === "folder" ? " e tudo dentro" : ""
                    }? Vai para a lixeira e pode ser restaurado em 30 dias.`,
                    tone: "danger",
                    confirmLabel: "Excluir",
                  })
                )
                  run(() => deleteNode(n.id));
              }}
            >
              <Trash2 className="size-3.5" /> Excluir
            </button>
          </>
        );
      default:
        return null;
    }
  }

  const render = (list: EffectiveNode[], depth: number) => (
    <ul className={depth > 0 ? "ml-3 border-l border-border pl-2" : ""}>
      {list.map((n) => {
        const Icon = ICON[n.type];
        const temFilhos = n.children.length > 0;
        const recolhido = collapsed.has(n.id);
        // Aplica o estado otimista (se houver) sobre o nó vindo do servidor.
        const idOv = idOverlay(n);
        const ot = idOv ? otimista.get(idOv) : undefined;
        const nEff: EffectiveNode =
          ot === undefined
            ? n
            : {
                ...n,
                hidden: ot,
                badge:
                  n.badge === "herdado" || n.badge === "oculto"
                    ? ot
                      ? "oculto"
                      : "herdado"
                    : n.badge,
              };
        // Oculto por um diretório-pai: reflete o estado da pasta em cada filho.
        const heranca = ocultosPorHeranca.has(n.id);
        const ocultoEfetivo = heranca || nEff.hidden;
        return (
          <li key={n.id} className="py-0.5">
            <div
              className={cn(
                "group flex items-start gap-1 rounded px-1 py-1 hover:bg-surface-2",
                ocultoEfetivo && "opacity-60",
                selecionados.has(n.id) && "bg-brand-purple-50 dark:bg-brand-purple-950/30",
              )}
            >
              {!heranca && selecionavel(nEff) ? (
                <input
                  type="checkbox"
                  checked={selecionados.has(n.id)}
                  onChange={() => alternarSel(n.id)}
                  aria-label="Selecionar"
                  title="Selecionar para ocultar/reexibir em lote"
                  className={cn(
                    "mt-0.5 size-3.5 shrink-0 accent-[var(--color-primary)]",
                    selecionados.size > 0 ? "" : "opacity-0 group-hover:opacity-100",
                  )}
                />
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              {temFilhos ? (
                <button
                  type="button"
                  onClick={() => toggle(n.id)}
                  aria-label={recolhido ? "Expandir" : "Recolher"}
                  title={recolhido ? "Expandir" : "Recolher"}
                  className="mt-0.5 shrink-0 text-text-muted hover:text-text"
                >
                  {recolhido ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </button>
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              <Icon className="mt-0.5 size-4 shrink-0 text-text-muted" />
              {/* Clicar no título ABRE o item: herdado/oculto = ver (só leitura);
                  customizado/exclusivo = editar. A página decide pelo ?space. */}
              <button
                type="button"
                onClick={() => router.push(`/admin/conteudo/${n.id}?space=${clientSpaceId}`)}
                className="min-w-0 flex-1 cursor-pointer text-left text-ui leading-[1.45] [overflow-wrap:anywhere] hover:text-primary"
              >
                {n.title}
              </button>
              {ocultoEfetivo ? (
                <Badge tone={BADGE_TONE.oculto}>{BADGE_LABEL.oculto}</Badge>
              ) : nEff.badge !== "proprio" ? (
                <Badge tone={BADGE_TONE[nEff.badge]}>{BADGE_LABEL[nEff.badge]}</Badge>
              ) : null}
              {!heranca && (
                <span className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                  {actions(nEff)}
                </span>
              )}
            </div>
            {temFilhos && !recolhido && render(n.children, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <Button size="sm" variant="secondary" disabled={pending}
          onClick={async () => {
            const title = await pedirTexto({
              title: "Nova pasta exclusiva",
              label: "Nome da pasta",
              description: "Existe só nesta documentação de cliente.",
            });
            if (title) run(() => createExclusiveNode({ clientSpaceId, parentId: null, type: "folder", title }));
          }}>
          + Pasta
        </Button>
        <Button size="sm" variant="secondary" disabled={pending}
          onClick={async () => {
            const title = await pedirTexto({
              title: "Novo artigo exclusivo",
              label: "Título do artigo",
              description: "Existe só nesta documentação de cliente.",
            });
            if (title) run(() => createExclusiveNode({ clientSpaceId, parentId: null, type: "article", title }));
          }}>
          + Artigo
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" title="Expandir todos os diretórios" onClick={() => setCollapsed(new Set())}>
            <UnfoldVertical className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Recolher todos os diretórios"
            onClick={() => setCollapsed(new Set(idsComFilhos(nodes)))}
          >
            <FoldVertical className="size-4" />
          </Button>
        </div>
      </div>

      {selecionados.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-brand-purple-50 px-3 py-1.5 text-sm dark:bg-brand-purple-950/30">
          <span className="font-medium text-primary">{selecionados.size} selecionado(s)</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || paraOcultar.length === 0}
              onClick={ocultarSel}
            >
              <EyeOff className="size-4" /> Ocultar ({paraOcultar.length})
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || paraReexibir.length === 0}
              onClick={reexibirSel}
            >
              <Eye className="size-4" /> Reexibir ({paraReexibir.length})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())} title="Limpar seleção">
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {nodes.length === 0 ? (
        <EmptyState
          className="mt-2"
          icon={Folder}
          title="Espaço vazio"
          description="Crie uma pasta ou artigo exclusivo para começar."
        />
      ) : (
        <>
          {selecionaveis.length > 0 && (
            <label className="mb-1 flex w-fit cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-text-muted hover:text-text">
              <input
                ref={masterRef}
                type="checkbox"
                checked={todosMarcados}
                onChange={alternarTodos}
                className="size-3.5 accent-[var(--color-primary)]"
              />
              Selecionar tudo ({selecionaveis.length})
            </label>
          )}
          {render(nodes, 0)}
        </>
      )}
    </div>
  );
}
