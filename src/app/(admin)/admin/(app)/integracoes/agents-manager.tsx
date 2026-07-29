"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Network, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { controlClass } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { saveAgent, deleteAgent } from "./agent-actions";
import type { IntegResult } from "./actions";
import type { ToolRow } from "./tools-manager";

export type AgentRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  provider_id: string | null;
  model: string | null;
  system_prompt: string;
  parent_agent_id: string | null;
  scope_permission: string | null;
  priority: number;
  active: boolean;
  toolIds: string[];
};
export type ProviderOption = { id: string; name: string };

export function AgentsManager({
  agents,
  tools,
  providers,
}: {
  agents: AgentRow[];
  tools: ToolRow[];
  providers: ProviderOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<{ agent?: AgentRow } | null>(null);

  const nomePorId = Object.fromEntries(agents.map((a) => [a.id, a.name]));
  const provPorId = Object.fromEntries(providers.map((p) => [p.id, p.name]));

  function run(fn: () => Promise<IntegResult>, okMsg?: string, onOk?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return toast.error(r.error);
      if (okMsg) toast.success(okMsg);
      onOk?.();
      router.refresh();
    });
  }

  async function excluir(a: AgentRow) {
    if (
      await confirmar({
        title: "Excluir agente",
        description: `Excluir "${a.name}"? Agentes-filhos ficam sem pai.`,
        tone: "danger",
        confirmLabel: "Excluir",
      })
    )
      run(() => deleteAgent(a.id), "Agente excluído.");
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Agentes</h2>
        <Button size="sm" onClick={() => setDialog({})}>
          <Plus /> Novo agente
        </Button>
      </div>
      <p className="mb-3 text-xs text-text-muted">
        Cada agente é especialista num módulo: tem seu modelo de IA, suas APIs/Tools e, opcionalmente,
        um agente-pai (hierarquia).
      </p>

      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="Nenhum agente cadastrado"
          description="Crie um agente especialista, vincule suas tools e escolha o modelo de IA."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {agents.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
              <Bot className="size-4 shrink-0 text-text-muted" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-text">{a.name}</span>
                  <Badge tone="neutral">
                    {a.provider_id ? `${provPorId[a.provider_id] ?? "?"}${a.model ? ` · ${a.model}` : ""}` : "IA padrão"}
                  </Badge>
                  {a.toolIds.length > 0 && <Badge tone="info">{a.toolIds.length} tool(s)</Badge>}
                  {a.parent_agent_id && (
                    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                      <Network className="size-3.5" /> {nomePorId[a.parent_agent_id] ?? "?"}
                    </span>
                  )}
                  {!a.active && <Badge tone="warning">Inativo</Badge>}
                </div>
                <div className="mt-0.5 truncate font-mono text-xs text-text-muted">{a.key}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setDialog({ agent: a })} title="Editar">
                <Pencil />
              </Button>
              <Button size="icon" variant="danger" onClick={() => excluir(a)} title="Excluir">
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {dialog && (
        <AgentDialog
          agent={dialog.agent}
          agents={agents}
          tools={tools}
          providers={providers}
          pending={pending}
          onClose={() => setDialog(null)}
          onSave={(payload) => run(() => saveAgent(payload), "Agente salvo.", () => setDialog(null))}
        />
      )}
    </div>
  );
}

// ──────────────────────────── Diálogo: Agente ───────────────────────────────
export function AgentDialog({
  agent,
  agents,
  tools,
  providers,
  pending,
  onClose,
  onSave,
}: {
  agent?: AgentRow;
  agents: AgentRow[];
  tools: ToolRow[];
  providers: ProviderOption[];
  pending: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [key, setKey] = useState(agent?.key ?? "");
  const [name, setName] = useState(agent?.name ?? "");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [providerId, setProviderId] = useState(agent?.provider_id ?? "");
  const [model, setModel] = useState(agent?.model ?? "");
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt ?? "");
  const [parentId, setParentId] = useState(agent?.parent_agent_id ?? "");
  const [scope, setScope] = useState(agent?.scope_permission ?? "");
  const [priority, setPriority] = useState(agent?.priority ?? 0);
  const [active, setActive] = useState(agent?.active ?? true);
  const [toolIds, setToolIds] = useState<Set<string>>(new Set(agent?.toolIds ?? []));

  function toggleTool(id: string) {
    setToolIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // Não pode ser pai de si mesmo.
  const paisPossiveis = agents.filter((a) => a.id !== agent?.id);

  return (
    <Dialog
      open
      onClose={onClose}
      title={agent ? "Editar agente" : "Novo agente"}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={pending}
            onClick={() =>
              onSave({
                ...(agent ? { id: agent.id } : {}),
                key,
                name,
                description,
                providerId: providerId || null,
                model,
                system_prompt: systemPrompt,
                parentAgentId: parentId || null,
                scope_permission: scope,
                priority: Number(priority) || 0,
                active,
                toolIds: [...toolIds],
              })
            }
          >
            Salvar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Chave" htmlFor="ag_key" hint="Só minúsculas, números e _.">
            <input id="ag_key" className={controlClass} value={key} onChange={(e) => setKey(e.target.value)} placeholder="agente_rh" />
          </Field>
          <Field label="Nome" htmlFor="ag_name">
            <input id="ag_name" className={controlClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Agente de RH" />
          </Field>
        </div>

        <Field label="Descrição (o roteador usa para escolher este agente)" htmlFor="ag_desc">
          <textarea id="ag_desc" rows={2} className={controlClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Colaboradores, férias, matrículas." />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Provedor de IA" htmlFor="ag_prov" hint="Vazio = usa a IA padrão de chat.">
            <select id="ag_prov" className={controlClass} value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              <option value="">— IA padrão de chat —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Modelo" htmlFor="ag_model" hint="Ex.: claude-sonnet-5, gpt-5…">
            <input id="ag_model" className={controlClass} value={model} onChange={(e) => setModel(e.target.value)} disabled={!providerId} />
          </Field>
        </div>

        <Field label="Prompt do sistema (opcional)" htmlFor="ag_prompt" hint="Instruções específicas deste agente.">
          <textarea id="ag_prompt" rows={3} className={controlClass} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
        </Field>

        {/* Tools vinculadas */}
        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">APIs / Tools deste agente</p>
          {tools.length === 0 ? (
            <p className="text-xs text-text-muted">Nenhuma API no catálogo ainda.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {tools.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm text-text">
                  <input type="checkbox" checked={toolIds.has(t.id)} onChange={() => toggleTool(t.id)} className="size-4 accent-[var(--color-primary)]" />
                  <span className="truncate">{t.name}</span>
                  <span className="truncate font-mono text-xs text-text-muted">{t.key}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Agente-pai (hierarquia)" htmlFor="ag_parent" hint="Opcional. Orquestrador → especialista.">
            <select id="ag_parent" className={controlClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— nenhum —</option>
              {paisPossiveis.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Prioridade" htmlFor="ag_prio" hint="Maior = considerado antes no roteamento.">
            <input id="ag_prio" type="number" className={controlClass} value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
          </Field>
        </div>

        <Field label="Permissão exigida (opcional)" htmlFor="ag_scope" hint="Chave de permissão para acionar o agente. Ex.: rh.read">
          <input id="ag_scope" className={controlClass} value={scope} onChange={(e) => setScope(e.target.value)} />
        </Field>

        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
          Agente ativo
        </label>
      </div>
    </Dialog>
  );
}
