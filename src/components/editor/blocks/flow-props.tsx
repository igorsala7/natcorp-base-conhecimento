"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Sparkles, ArrowRight } from "lucide-react";
import type { Block, FlowData, FlowNodeType } from "@/lib/blocks/schema";
import { FLOW_NODE_LABEL, newId } from "@/lib/blocks/schema";
import { useToast } from "@/components/ui/toast";
import { generateFlowchart } from "@/app/(admin)/admin/(app)/conteudo/flow-actions";
import type { EditorActions } from "./edit-types";
import { Select } from "@/components/ui/select";

type FlowBlockT = Extract<Block, { type: "flow" }>;
const TIPOS: FlowNodeType[] = ["start", "process", "decision", "io", "subroutine", "end"];

/**
 * Propriedades do fluxograma: "Editar com IA" (instruções → nós+arestas) +
 * edição estrutural (lista de nós e de ligações). O LAYOUT é automático, então
 * não há posições para arrastar — só a estrutura.
 */
export function FlowProps({ block, actions }: { block: FlowBlockT; actions: EditorActions }) {
  const d = block.data;
  const toast = useToast();
  const [pending, start] = useTransition();
  const [inst, setInst] = useState("");

  const set = (patch: Partial<FlowData>) =>
    actions.patch(block.id, { data: { ...d, ...patch } } as Partial<Block>);

  const addNode = () =>
    set({ nodes: [...d.nodes, { id: newId(), type: "process", label: "Nova etapa" }] });
  const setNode = (id: string, patch: Partial<(typeof d.nodes)[number]>) =>
    set({ nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  const rmNode = (id: string) =>
    set({
      nodes: d.nodes.filter((n) => n.id !== id),
      edges: d.edges.filter((e) => e.from !== id && e.to !== id),
    });

  const addEdge = () => {
    const a = d.nodes[0]?.id;
    if (!a) return;
    set({ edges: [...d.edges, { id: newId(), from: a, to: d.nodes[1]?.id ?? a }] });
  };
  const setEdge = (id: string, patch: Partial<(typeof d.edges)[number]>) =>
    set({ edges: d.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const rmEdge = (id: string) => set({ edges: d.edges.filter((e) => e.id !== id) });

  function comIA() {
    if (!inst.trim() || pending) return;
    start(async () => {
      const res = await generateFlowchart(inst.trim(), d);
      if (res.ok) {
        actions.patch(block.id, { data: res.data } as Partial<Block>);
        setInst("");
        toast.success("Fluxograma gerado — ajuste o que quiser.");
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {/* Editar com IA */}
      <Grupo title="Editar com IA">
        <textarea
          value={inst}
          onChange={(e) => setInst(e.target.value)}
          placeholder="Descreva o fluxo (ex.: “Processo de abertura de chamado: usuário cria, triagem decide se é urgente…”). A IA monta e você ajusta."
          rows={3}
          className="w-full resize-none rounded-md border border-border bg-surface-2 p-2 text-xs outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={comIA}
          disabled={pending || !inst.trim()}
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-fg disabled:opacity-50"
        >
          <Sparkles className="size-3.5" /> {pending ? "Gerando…" : "Gerar / editar com IA"}
        </button>
      </Grupo>

      {/* Nós */}
      <Grupo title="Passos (nós)">
        <div className="space-y-1.5">
          {d.nodes.map((n) => (
            <div key={n.id} className="flex items-center gap-1.5">
              <Select
                value={n.type}
                onChange={(v) => setNode(n.id, { type: v as FlowNodeType })}
                className="shrink-0 rounded-md border border-border bg-surface px-1.5 py-1 text-xs outline-none"
                title="Tipo do nó"
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {FLOW_NODE_LABEL[t]}
                  </option>
                ))}
              </Select>
              <input
                value={n.label}
                onChange={(e) => setNode(n.id, { label: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => rmNode(n.id)}
                title="Remover"
                className="shrink-0 text-text-muted hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addNode}
          className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:border-primary hover:text-primary"
        >
          <Plus className="size-3.5" /> Passo
        </button>
      </Grupo>

      {/* Ligações */}
      <Grupo title="Ligações">
        <div className="space-y-1.5">
          {d.edges.map((e) => (
            <div key={e.id} className="flex items-center gap-1">
              <Select
                value={e.from}
                onChange={(v) => setEdge(e.id, { from: v })}
                className="min-w-0 flex-1 rounded-md border border-border bg-surface px-1 py-1 text-xs outline-none"
              >
                {d.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label || n.id}
                  </option>
                ))}
              </Select>
              <ArrowRight className="size-3.5 shrink-0 text-text-muted" />
              <Select
                value={e.to}
                onChange={(v) => setEdge(e.id, { to: v })}
                className="min-w-0 flex-1 rounded-md border border-border bg-surface px-1 py-1 text-xs outline-none"
              >
                {d.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label || n.id}
                  </option>
                ))}
              </Select>
              <input
                value={e.label ?? ""}
                onChange={(ev) => setEdge(e.id, { label: ev.target.value || undefined })}
                placeholder="rótulo"
                className="w-16 shrink-0 rounded-md border border-border bg-surface px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => rmEdge(e.id)}
                title="Remover"
                className="shrink-0 text-text-muted hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addEdge}
          disabled={d.nodes.length < 1}
          className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <Plus className="size-3.5" /> Ligação
        </button>
      </Grupo>
    </div>
  );
}

function Grupo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-text-muted">
        {title}
      </p>
      {children}
    </div>
  );
}
