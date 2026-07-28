"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, Plus, Save, Trash2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { SavedPrompt, SavePromptResult } from "@/app/(admin)/admin/(app)/prompt-library-actions";

export type PromptBackend = {
  list: () => Promise<SavedPrompt[]>;
  save: (input: { id?: string | null; label?: string | null; texto: string }) => Promise<SavePromptResult>;
  del: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

/** Botãozinho "salvar prompt" que aparece ao passar o mouse no balão da mensagem. */
export function SavePromptButton({ texto, backend, className }: { texto: string; backend: PromptBackend; className?: string }) {
  const toast = useToast();
  const [salvando, setSalvando] = useState(false);
  if (!texto.trim()) return null;
  return (
    <button
      type="button"
      title="Salvar como prompt para reusar"
      disabled={salvando}
      onClick={async () => {
        setSalvando(true);
        const r = await backend.save({ texto: texto.trim() });
        setSalvando(false);
        if (r.ok) toast.success("Prompt salvo. Abra “Prompts salvos” para reusar.");
        else toast.error(r.error);
      }}
      className={cn("rounded p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-primary", className)}
    >
      <Bookmark className="size-3.5" />
    </button>
  );
}

/** Painel de prompts salvos: abre na base do chat; usar/editar/excluir/novo. */
export function PromptLibrary({ backend, onInsert }: { backend: PromptBackend; onInsert: (texto: string) => void }) {
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [texto, setTexto] = useState("");
  const [form, setForm] = useState(false);

  const carregar = useCallback(() => {
    void backend.list().then(setPrompts);
  }, [backend]);
  useEffect(() => {
    if (aberto) carregar();
  }, [aberto, carregar]);

  function novo() {
    setEditId(null);
    setLabel("");
    setTexto("");
    setForm(true);
  }
  function editar(p: SavedPrompt) {
    setEditId(p.id);
    setLabel(p.label ?? "");
    setTexto(p.texto);
    setForm(true);
  }
  async function salvar() {
    if (!texto.trim()) return;
    const r = await backend.save({ id: editId, label: label.trim() || null, texto: texto.trim() });
    if (r.ok) {
      setForm(false);
      carregar();
    } else toast.error(r.error);
  }
  async function excluir(id: string) {
    await backend.del(id);
    carregar();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        <Bookmark className="size-3.5" /> Prompts salvos
      </button>

      {aberto && (
        <div className="absolute bottom-full left-0 z-20 mb-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-2 shadow-lg">
          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="text-xs font-semibold">Prompts salvos</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={novo} className="rounded p-1 text-text-muted hover:text-primary" title="Novo prompt">
                <Plus className="size-4" />
              </button>
              <button type="button" onClick={() => setAberto(false)} className="rounded p-1 text-text-muted hover:text-text" title="Fechar">
                <X className="size-4" />
              </button>
            </div>
          </div>

          {form && (
            <div className="mb-2 space-y-1.5 rounded-md border border-border bg-surface-2/50 p-2">
              <input className={cn(controlClass, "text-sm")} placeholder="Rótulo (opcional)" value={label} onChange={(e) => setLabel(e.target.value)} />
              <textarea className={cn(controlClass, "min-h-16 text-sm")} placeholder="Texto do prompt" value={texto} onChange={(e) => setTexto(e.target.value)} />
              <div className="flex justify-end gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setForm(false)}>Cancelar</Button>
                <Button size="sm" onClick={() => void salvar()} disabled={!texto.trim()}>
                  <Save className="size-3.5" /> {editId ? "Atualizar" : "Salvar"}
                </Button>
              </div>
            </div>
          )}

          <div className="max-h-64 space-y-1 overflow-auto">
            {prompts.length === 0 ? (
              <p className="px-1 py-2 text-xs text-text-muted">Nenhum prompt salvo ainda. Salve um pelo botão sobre uma mensagem, ou em “+”.</p>
            ) : (
              prompts.map((p) => (
                <div key={p.id} className="group flex items-start gap-1 rounded px-1.5 py-1 hover:bg-surface-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => { onInsert(p.texto); setAberto(false); }}
                    title="Usar este prompt"
                  >
                    {p.label && <span className="block truncate text-xs font-medium">{p.label}</span>}
                    <span className="block truncate text-xs text-text-muted">{p.texto}</span>
                  </button>
                  <button type="button" onClick={() => editar(p)} className="shrink-0 rounded p-1 text-text-muted opacity-0 hover:text-primary group-hover:opacity-100" title="Editar">
                    <Pencil className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => void excluir(p.id)} className="shrink-0 rounded p-1 text-text-muted opacity-0 hover:text-danger group-hover:opacity-100" title="Excluir">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
