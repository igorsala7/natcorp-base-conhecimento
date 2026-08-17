"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Link2,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/lib/content/tree";

const ICONS = {
  folder: Folder,
  article: FileText,
  link: Link2,
  divider: Minus,
} as const;

export function TreeItem({
  id,
  node,
  depth,
  collapsed,
  hasChildren,
  hasEmbedding,
  hasOntology,
  hasPendingDraft,
  dropBefore,
  dropAfter,
  dropInside,
  selected,
  checked,
  anyChecked,
  indentationWidth,
  onToggle,
  onSelect,
  onCheck,
  children: actions,
}: {
  id: string;
  node: TreeNode;
  depth: number;
  collapsed: boolean;
  hasChildren: boolean;
  /** Artigo indexado (ou pasta com descendente indexado) → bolinha azul-clara. */
  hasEmbedding?: boolean;
  /** Artigo varrido pela ontologia (ou pasta com descendente varrido) → bolinha cinza escura. */
  hasOntology?: boolean;
  /** Artigo com edições salvas mas NÃO publicadas (article_drafts) → bolinha de rascunho. */
  hasPendingDraft?: boolean;
  /** Drop vira IRMÃO antes deste item → linha no TOPO da linha. */
  dropBefore?: boolean;
  /** Drop vira IRMÃO depois deste item → linha na BASE da linha. */
  dropAfter?: boolean;
  /** Drop vira FILHO desta pasta → pasta inteira destacada. */
  dropInside?: boolean;
  selected: boolean;
  checked: boolean;
  /** Há itens marcados na árvore → mantém as caixas visíveis. */
  anyChecked: boolean;
  indentationWidth: number;
  onToggle: () => void;
  onSelect: (e: React.MouseEvent) => void;
  onCheck: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const Icon = ICONS[node.type];

  return (
    // Linha no padrão dos portais de referência (Microsoft Learn / Apple):
    // o título QUEBRA em várias linhas em vez de truncar, e as ações moram
    // num overlay que só existe no hover — antes elas ficavam no fluxo e
    // reservavam ~150px invisíveis em toda linha, o que cortava os títulos.
    <div
      ref={setNodeRef}
      data-node-id={id}
      style={{
        // Só o item ARRASTADO segue o cursor; os demais ficam PARADOS (sem o
        // "abre-espaço" do sortable) para a LINHA de inserção ser o único e
        // claro indicador de onde ele vai cair.
        transform: isDragging ? CSS.Translate.toString(transform) : undefined,
        transition: isDragging ? transition : undefined,
        paddingLeft: depth * indentationWidth + 4,
      }}
      className={cn(
        "group relative flex items-start gap-1 rounded-md py-[3px] pr-1 text-[0.8125rem] leading-[1.45] transition-[background-color,box-shadow,padding] duration-150",
        selected
          ? "bg-brand-purple-50 font-semibold text-primary dark:bg-brand-purple-950/40"
          : "hover:bg-surface-2",
        checked && "bg-brand-purple-50 dark:bg-brand-purple-950/30",
        // Item sendo arrastado: translúcido seguindo o cursor — é o que você
        // SEGURA; os indicadores mostram ONDE ele cai.
        isDragging && "z-10 cursor-grabbing opacity-60 !bg-surface shadow-1 ring-1 ring-primary/50",
        // Drop DENTRO desta pasta: a pasta inteira destaca.
        dropInside &&
          "bg-brand-purple-50 ring-2 ring-inset ring-primary dark:bg-brand-purple-950/50",
      )}
    >
      {/* LINHA de irmão: antes (topo) ou depois (base) deste item, no nível dele. */}
      {(dropBefore || dropAfter) && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-1 z-20 flex items-center gap-1",
            dropBefore ? "-top-px" : "-bottom-px",
          )}
        >
          <span className="size-2 shrink-0 rounded-full bg-primary ring-2 ring-surface" />
          <span className="h-[3px] flex-1 rounded-full bg-primary" />
        </span>
      )}
      {/* Rail da referência: barra vertical no item selecionado. */}
      {selected && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-primary"
        />
      )}
      <input
        type="checkbox"
        checked={checked}
        onChange={() => {}}
        onClick={(e) => onCheck(e)}
        aria-label="Selecionar"
        title="Selecionar (Shift para intervalo)"
        className={cn(
          "mt-[3px] size-3.5 shrink-0 accent-[var(--color-primary)]",
          checked || anyChecked ? "" : "opacity-0 group-hover:opacity-100",
        )}
      />

      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir" : "Colapsar"}
          title={collapsed ? "Expandir" : "Recolher"}
          className="mt-0.5 shrink-0 text-text-muted"
        >
          {collapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
      ) : (
        <span className="w-3.5 shrink-0" />
      )}

      {/* O ícone do tipo É a alça de arrastar — o grip dedicado saiu, era
          mais uma coluna roubando espaço do título. */}
      <span
        aria-label="Arrastar para mover"
        title="Arrastar para mover"
        className="mt-0.5 shrink-0 cursor-grab touch-none text-text-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <Icon className="size-4" />
      </span>

      <button
        type="button"
        onClick={onSelect}
        title="Clique para abrir · Shift+clique seleciona um intervalo · Ctrl/⌘+clique marca vários"
        className="min-w-0 flex-1 text-left [overflow-wrap:anywhere]"
      >
        {node.title}
        {node.status === "published" && (
          <span
            className="ml-1.5 inline-block size-1.5 rounded-full bg-success align-middle"
            title="Publicado"
          />
        )}
        {node.type === "article" && node.status === "review" && (
          <span
            className="ml-1.5 inline-block size-1.5 rounded-full bg-warning align-middle"
            title="Aguardando aprovação"
          />
        )}
        {node.type === "article" && (node.status === "draft" || hasPendingDraft) && (
          <span
            className="ml-1.5 inline-block size-1.5 rounded-full border border-brand-gray-400 align-middle"
            title={node.status === "draft" ? "Rascunho (nunca publicado)" : "Tem edições não publicadas"}
          />
        )}
        {hasEmbedding && (
          <span
            className="ml-1 inline-block size-1.5 rounded-full bg-info align-middle"
            title="Indexado para busca e IA (embeddings gerados)"
          />
        )}
        {hasOntology && (
          <span
            className="ml-1 inline-block size-1.5 rounded-full bg-text-muted align-middle"
            title="Incluído na varredura de ontologia"
          />
        )}
        {(node.publish_at || node.unpublish_at) && (
          <span
            className="ml-1.5 inline-block align-middle text-brand-pink-700"
            title={
              node.publish_at
                ? `Publica em ${new Date(node.publish_at).toLocaleString("pt-BR")}`
                : `Despublica em ${new Date(node.unpublish_at!).toLocaleString("pt-BR")}`
            }
          >
            <CalendarClock aria-label="Publicação agendada" className="size-3.5" />
          </span>
        )}
      </button>

      {/* Mini-barra de ações: overlay com fundo próprio, aparece no hover ou
          quando algum botão dela recebe foco pelo teclado. */}
      <div className="pointer-events-none absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md border border-border bg-surface px-0.5 py-0.5 opacity-0 shadow-1 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
      >
        {actions}
      </div>
    </div>
  );
}
