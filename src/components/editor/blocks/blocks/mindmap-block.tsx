"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CornerDownRight, ListTree, Plus, Sparkles, Trash2 } from "lucide-react";
import type { Block, MindMapData, MindMapNode } from "@/lib/blocks/schema";
import { MindMapView } from "@/components/portal/mindmap-view";
import { outlineToMindMap, mindMapToOutline } from "@/lib/blocks/ai-data-blocks";
import { findNode, mapAddChild, mapAddSibling, mapMove, mapRemove, mapUpdateNode } from "@/lib/blocks/mindmap-edit";
import { generateMindMap } from "@/app/(admin)/admin/(app)/conteudo/mindmap-actions";
import { IconPicker } from "@/components/editor/blocks/icon-picker";
import { useToast } from "@/components/ui/toast";
import type { BlockEditProps } from "../edit-types";

/** Paletas curadas (acento e preenchimento claro) — casam com a marca. */
const CORES = ["#511C76", "#C95788", "#2C1A63", "#0369a1", "#15803d", "#b45309", "#dc2626", "#334155"];
const FUNDOS = ["#F3E8FF", "#FCE7F3", "#DBEAFE", "#DCFCE7", "#FEF9C3", "#FFE4E6", "#FFEDD5", "#F1F5F9"];

const ctrl =
  "w-full rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary";

function Swatches({
  value,
  cores,
  onPick,
}: {
  value?: string;
  cores: string[];
  onPick: (c: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onPick(undefined)}
        title="Nenhuma"
        className={`flex size-5 items-center justify-center rounded border bg-surface text-2xs text-text-muted ${!value ? "ring-2 ring-primary" : "border-border"}`}
      >
        ∅
      </button>
      {cores.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          title={c}
          style={{ backgroundColor: c }}
          className={`size-5 rounded border border-border ${value === c ? "ring-2 ring-primary ring-offset-1" : ""}`}
        />
      ))}
    </div>
  );
}

/**
 * Mapa mental no editor: prévia INTERATIVA + edição por NÓ (clique num nó para
 * estilizar: rótulo, nota, link, ícone, cor, fundo; e estruturar: filho/irmão/
 * mover/excluir). "Editar com IA" refaz do zero; "Reorganizar por texto" mexe
 * só na hierarquia (redefine ícones/cores).
 */
export function MindMapBlock({ block, onChange }: BlockEditProps) {
  const data = (block as Extract<Block, { type: "mindmap" }>).data;
  const toast = useToast();
  const [selId, setSelId] = useState<string | null>(null);
  const [modo, setModo] = useState<null | "outline" | "ia">(null);
  const [outline, setOutline] = useState(() => mindMapToOutline(data.root));
  const [inst, setInst] = useState("");
  const [busy, setBusy] = useState(false);

  const aplicarRaiz = (root: MindMapNode) => onChange({ data: { ...data, root } } as Partial<Block>);
  const aplicarData = (d: MindMapData) => onChange({ data: d } as Partial<Block>);

  const sel = selId ? findNode(data.root, selId) : undefined;
  const patchSel = (patch: Partial<MindMapNode>) => selId && aplicarRaiz(mapUpdateNode(data.root, selId, patch));

  function addFilho() {
    if (!selId) return;
    const r = mapAddChild(data.root, selId);
    aplicarRaiz(r.root);
    setSelId(r.id);
  }
  function addIrmao() {
    if (!selId) return;
    const r = mapAddSibling(data.root, selId);
    if (r) {
      aplicarRaiz(r.root);
      setSelId(r.id);
    } else toast.info("O tema central não tem irmão — adicione um filho.");
  }
  function excluir() {
    if (!selId || selId === data.root.id) return toast.info("O tema central não pode ser excluído.");
    aplicarRaiz(mapRemove(data.root, selId));
    setSelId(null);
  }

  function editarOutline(txt: string) {
    setOutline(txt);
    const d = outlineToMindMap(txt);
    if (d) aplicarData(d);
    setSelId(null);
  }

  async function editarIA() {
    if (!inst.trim() || busy) return;
    setBusy(true);
    const r = await generateMindMap(inst.trim(), mindMapToOutline(data.root));
    setBusy(false);
    if (r.ok) {
      aplicarData(r.data);
      setOutline(mindMapToOutline(r.data.root));
      setSelId(null);
      setInst("");
      setModo(null);
      toast.success("Mapa mental atualizado.");
    } else toast.error(r.error);
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-primary hover:text-primary";

  // O painel de personalização é PASSADO ao MindMapView: fica abaixo do mapa e,
  // em TELA CHEIA, vira barra lateral — assim dá para editar sem sair do modo
  // maximizado (útil quando o mapa tem muita informação).
  const painel = sel ? (
    <div className="space-y-2 rounded-lg border border-border bg-surface-1 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text">Nó selecionado</span>
            <div className="flex items-center gap-1">
              <button type="button" className={btn} onClick={addFilho} title="Adicionar filho">
                <CornerDownRight className="size-3.5" /> Filho
              </button>
              <button type="button" className={btn} onClick={addIrmao} title="Adicionar irmão">
                <Plus className="size-3.5" /> Irmão
              </button>
              <button type="button" className={btn} onClick={() => selId && aplicarRaiz(mapMove(data.root, selId, -1))} title="Subir">
                <ChevronUp className="size-3.5" />
              </button>
              <button type="button" className={btn} onClick={() => selId && aplicarRaiz(mapMove(data.root, selId, 1))} title="Descer">
                <ChevronDown className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={excluir}
                title="Excluir"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-brand-pink-700 hover:bg-brand-pink-50 dark:hover:bg-brand-pink-950/40"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="block">
              <span className="mb-0.5 block text-2xs text-text-muted">Rótulo</span>
              <input className={ctrl} value={sel.label} onChange={(e) => patchSel({ label: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-2xs text-text-muted">Link (URL)</span>
              <input
                className={ctrl}
                value={sel.link ?? ""}
                onChange={(e) => patchSel({ link: e.target.value.trim() || undefined })}
                placeholder="https://…"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-0.5 block text-2xs text-text-muted">Nota / detalhe (aparece ao passar o mouse)</span>
            <textarea
              className={`${ctrl} resize-y`}
              rows={2}
              value={sel.note ?? ""}
              onChange={(e) => patchSel({ note: e.target.value || undefined })}
              placeholder="Descrição, contexto, referência…"
            />
          </label>

          <div className="grid gap-2">
            <div>
              <span className="mb-0.5 block text-2xs text-text-muted">Ícone</span>
              <IconPicker value={sel.icon} onChange={(k) => patchSel({ icon: k })} />
            </div>
            <div className="space-y-1.5">
              <div>
                <span className="mb-0.5 block text-2xs text-text-muted">Cor (borda/ícone)</span>
                <Swatches value={sel.color} cores={CORES} onPick={(c) => patchSel({ color: c })} />
              </div>
              <div>
                <span className="mb-0.5 block text-2xs text-text-muted">Fundo</span>
                <Swatches value={sel.bg} cores={FUNDOS} onPick={(c) => patchSel({ bg: c })} />
              </div>
            </div>
          </div>
    </div>
  ) : (
    <p className="text-2xs text-text-muted">Clique num nó para estilizar e detalhar.</p>
  );

  return (
    <div className="my-3 space-y-2">
      <MindMapView data={data} edit={{ selectedId: selId, onSelect: setSelId }} panel={painel} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btn}
          onClick={() => {
            setOutline(mindMapToOutline(data.root));
            setModo(modo === "outline" ? null : "outline");
          }}
        >
          <ListTree className="size-3.5" /> Reorganizar por texto
        </button>
        <button type="button" className={btn} onClick={() => setModo(modo === "ia" ? null : "ia")}>
          <Sparkles className="size-3.5" /> Editar com IA
        </button>
      </div>

      {modo === "outline" && (
        <div>
          <textarea
            value={outline}
            onChange={(e) => editarOutline(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full resize-y rounded-md border border-border bg-surface-2 p-2 font-mono text-xs outline-none focus:ring-1 focus:ring-primary"
            placeholder={"Tema central\n  Ramo A\n    Sub-ramo\n  Ramo B"}
          />
          <p className="mt-1 text-2xs text-text-muted">
            1ª linha = tema central; cada indentação (2 espaços) = sub-ramo. <b>Atenção:</b> reorganizar
            por texto redefine ícones, cores e notas.
          </p>
        </div>
      )}

      {modo === "ia" && (
        <div className="flex flex-wrap gap-2">
          <input
            value={inst}
            onChange={(e) => setInst(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void editarIA()}
            placeholder="Ex.: mapa mental do processo de solicitação de férias"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => void editarIA()}
            disabled={busy || !inst.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg disabled:opacity-50"
          >
            <Sparkles className="size-3.5" /> {busy ? "Gerando…" : "Gerar"}
          </button>
        </div>
      )}
    </div>
  );
}
