"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import {
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Globe,
  Pencil,
  Plus,
  Server,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ToolDialog, type ToolRow, type BaseToolRow, type ModuleTag } from "./tools-manager";
import { BaseDialog, type BaseRow, type SpaceOption } from "./integrations-manager";
import { AgentDialog, type AgentRow, type ProviderOption } from "./agents-manager";
import type { RunRow } from "./runs-manager";
import { saveTool } from "./tool-actions";
import { createBase, updateBase, saveFlowLayout, type IntegResult } from "./actions";
import { saveAgent, linkAgentTool, unlinkAgentTool } from "./agent-actions";
import { Select } from "@/components/ui/select";

type NodeKind = "base" | "agent" | "tool" | "endpoint";
type FlowNodeData = {
  label: string;
  sub?: string;
  kind: NodeKind;
  refId: string;
  external?: boolean;
  inactive?: boolean;
};

const KIND: Record<NodeKind, { icon: typeof Bot; ring: string; badge: string }> = {
  base: { icon: Building2, ring: "border-brand-blue-500/60", badge: "text-brand-blue-500" },
  agent: { icon: Bot, ring: "border-[var(--color-primary)]/60", badge: "text-[var(--color-primary)]" },
  tool: { icon: Wrench, ring: "border-border", badge: "text-text-muted" },
  endpoint: { icon: Server, ring: "border-brand-pink-700/40", badge: "text-brand-pink-700" },
};

/** Nó do canvas (visual n8n): card com ícone, título e sub. */
function FlowNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const cfg = KIND[data.kind];
  const Icon = data.external ? Globe : cfg.icon;
  return (
    <div
      className={cn(
        "flex w-56 items-center gap-2 rounded-xl border bg-surface px-3 py-2 shadow-sm transition-shadow",
        cfg.ring,
        selected && "ring-2 ring-[var(--color-primary)]",
        data.inactive && "opacity-50",
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-none !bg-border" />
      <Icon className={cn("size-4 shrink-0", cfg.badge)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-text">{data.label}</span>
        {data.sub && <span className="block truncate font-mono text-2xs text-text-muted">{data.sub}</span>}
      </span>
      <Handle type="source" position={Position.Right} className="!size-2 !border-none !bg-border" />
    </div>
  );
}

const nodeTypes = { flow: FlowNode };

// Layout em bandas: cada AGENTE ganha uma faixa vertical, e suas ferramentas
// ficam numa GRADE (PER_ROW por linha) à direita — em vez de uma coluna única
// gigante. Base à esquerda, centralizada.
const BASE_X = 0;
const AGENT_X = 260;
const TOOL_X0 = 540;
const TOOL_W = 250;
const TOOL_H = 78;
const PER_ROW = 4;
const BAND_GAP = 56;
const TOP = 20;

export function FlowManager({
  bases,
  tools,
  agents,
  baseTools,
  spaces,
  providers,
  runs,
  moduleOptions,
}: {
  bases: BaseRow[];
  tools: ToolRow[];
  agents: AgentRow[];
  baseTools: BaseToolRow[];
  spaces: SpaceOption[];
  providers: ProviderOption[];
  runs: RunRow[];
  moduleOptions: ModuleTag[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [baseId, setBaseId] = useState(bases[0]?.id ?? "");
  const [editMode, setEditMode] = useState(false);
  const [sel, setSel] = useState<{ kind: NodeKind; refId: string } | null>(null);
  const [tab, setTab] = useState<"props" | "log">("props");
  const [editing, setEditing] = useState<{ kind: "base" | "agent" | "tool"; id: string } | null>(null);

  const base = bases.find((b) => b.id === baseId) ?? bases[0];

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // (Re)constrói o grafo quando a base ou os dados mudam, aplicando o layout
  // salvo (posições dos nós arrastados) por cima do layout automático.
  useEffect(() => {
    if (!base) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const saved = base.flow_layout ?? {};
    const at = (key: string, x: number, y: number) => saved[key] ?? { x, y };
    const enabled = new Set(baseTools.filter((bt) => bt.base_id === base.id && bt.enabled).map((bt) => bt.tool_id));
    const toolsBase = tools.filter((t) => t.active && enabled.has(t.id));
    const toolById = new Map(toolsBase.map((t) => [t.id, t]));
    const agentesAtivos = agents.filter((a) => a.active && a.toolIds.some((tid) => toolById.has(tid)));

    const N: Node<FlowNodeData>[] = [];
    const E: Edge[] = [];

    // Cada ferramenta é agrupada sob o PRIMEIRO agente que a contém (grade por agente).
    const grupo = new Map<string, ToolRow[]>();
    const agrupada = new Set<string>();
    for (const a of agentesAtivos) {
      const lista: ToolRow[] = [];
      for (const tid of a.toolIds) {
        const t = toolById.get(tid);
        if (t && !agrupada.has(t.id)) {
          agrupada.add(t.id);
          lista.push(t);
        }
      }
      grupo.set(a.id, lista);
    }

    // Agentes empilhados; cada um com uma banda do tamanho da sua grade de tools.
    let bandTop = TOP;
    for (const a of agentesAtivos) {
      const lista = grupo.get(a.id) ?? [];
      const linhas = Math.max(1, Math.ceil(lista.length / PER_ROW));
      const bandH = linhas * TOOL_H;
      const centro = bandTop + bandH / 2 - TOOL_H / 2;
      const aId = `agent:${a.id}`;
      const nTools = a.toolIds.filter((tid) => toolById.has(tid)).length;
      N.push({ id: aId, type: "flow", position: at(aId, AGENT_X, centro), data: { label: a.name, sub: `${a.key} · ${nTools} tools`, kind: "agent", refId: a.id } });
      lista.forEach((t, i) => {
        const id = `tool:${t.id}`;
        const x = TOOL_X0 + (i % PER_ROW) * TOOL_W;
        const y = bandTop + Math.floor(i / PER_ROW) * TOOL_H;
        N.push({ id, type: "flow", position: at(id, x, y), data: { label: t.name, sub: t.key, kind: "tool", refId: t.id, external: t.endpoint_kind === "external" } });
      });
      bandTop += bandH + BAND_GAP;
    }

    // Base à esquerda, centralizada verticalmente entre as bandas.
    const centroBase = (TOP + Math.max(TOP, bandTop - BAND_GAP)) / 2 - TOOL_H / 2;
    N.push({ id: `base:${base.id}`, type: "flow", position: at(`base:${base.id}`, BASE_X, centroBase), data: { label: base.name, sub: base.base_code, kind: "base", refId: base.id } });

    // Arestas: base→agente (não-editável) e agente→tool (editável = pode desvincular).
    for (const a of agentesAtivos) {
      E.push({ id: `e:base-${a.id}`, source: `base:${base.id}`, target: `agent:${a.id}`, deletable: false });
      for (const tid of a.toolIds) {
        if (toolById.has(tid)) E.push({ id: `e:${a.id}-${tid}`, source: `agent:${a.id}`, target: `tool:${tid}` });
      }
    }

    setNodes(N);
    setEdges(E);
  }, [base, tools, agents, baseTools, setNodes, setEdges]);

  function run(fn: () => Promise<IntegResult>, okMsg: string) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return toast.error(r.error);
      toast.success(okMsg);
      setEditing(null);
      router.refresh();
    });
  }

  const onNodeClick = useCallback((_: unknown, node: Node<FlowNodeData>) => {
    setSel({ kind: node.data.kind, refId: node.data.refId });
    setTab("props");
  }, []);

  // Arrastar → persiste as posições (cosmético, sem refresh).
  const persistLayout = (nds: Node<FlowNodeData>[]) => {
    if (!base) return;
    const layout = Object.fromEntries(nds.map((n) => [n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) }]));
    void saveFlowLayout({ baseId: base.id, layout }).then((r) => {
      if (!r.ok) toast.error(r.error);
    });
  };

  // Só ligamos AGENTE ↔ TOOL (as demais arestas são derivadas e não-editáveis).
  const isValid = (c: Connection | Edge) => {
    const ends = [c.source, c.target];
    return ends.some((id) => id?.startsWith("agent:")) && ends.some((id) => id?.startsWith("tool:")) && c.source !== c.target;
  };
  const onConnect = (c: Connection) => {
    const ends = [c.source, c.target].filter(Boolean) as string[];
    const ag = ends.find((id) => id.startsWith("agent:"));
    const to = ends.find((id) => id.startsWith("tool:"));
    if (!ag || !to) return toast.error("Só dá para ligar um agente a uma ferramenta.");
    run(() => linkAgentTool(ag.replace(/^agent:/, ""), to.replace(/^tool:/, "")), "Ferramenta vinculada ao agente.");
  };
  const onEdgesDelete = (deleted: Edge[]) => {
    for (const e of deleted) {
      if (e.source.startsWith("agent:") && e.target.startsWith("tool:")) {
        run(() => unlinkAgentTool(e.source.replace(/^agent:/, ""), e.target.replace(/^tool:/, "")), "Vínculo removido.");
      }
    }
  };

  if (bases.length === 0) {
    return (
      <EmptyState
        icon={Server}
        title="Nenhuma base para exibir"
        description="Cadastre uma base (aba Bases / Clientes) para ver o fluxo de agentes e ferramentas."
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text">Fluxo de agentes e ferramentas</h2>
        <div className="flex items-center gap-2">
          {editMode && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "tool", id: "__new__" })}>
                <Plus /> Tool
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "agent", id: "__new__" })}>
                <Plus /> Agente
              </Button>
            </>
          )}
          <Button size="sm" variant={editMode ? "primary" : "secondary"} onClick={() => setEditMode((v) => !v)}>
            <Pencil /> {editMode ? "Editando" : "Editar"}
          </Button>
          <label className="flex items-center gap-2 text-sm text-text-muted">
            Base:
            <Select
              value={baseId}
              onChange={(v) => {
                setBaseId(v);
                setSel(null);
              }}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text"
            >
              {bases.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </label>
        </div>
      </div>
      <p className="mb-3 text-xs text-text-muted">
        {editMode ? (
          <>
            Modo edição: <strong>arraste</strong> os nós para reposicionar (salvo automaticamente);
            puxe uma aresta de um <strong>agente</strong> até uma <strong>ferramenta</strong> para vinculá-las;
            selecione uma aresta agente→ferramenta e tecle <strong>Delete/Backspace</strong> para desvincular.
          </>
        ) : (
          <>
            O que está configurado para esta base: agentes ativos → suas ferramentas → o endpoint de cada uma.
            Clique num nó para ver detalhes e o log. Use <strong>Editar</strong> para reorganizar e vincular.
          </>
        )}
      </p>

      <div className="relative h-[72vh] overflow-hidden rounded-xl border border-border bg-surface-2/30">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeDragStop={() => persistLayout(nodes)}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          isValidConnection={isValid}
          nodesDraggable={editMode}
          nodesConnectable={editMode}
          edgesReconnectable={false}
          deleteKeyCode={editMode ? "Backspace" : null}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} className="!bg-transparent" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-surface" />
        </ReactFlow>

        {sel && (
          <Inspector
            sel={sel}
            bases={bases}
            tools={tools}
            agents={agents}
            runs={runs}
            tab={tab}
            setTab={setTab}
            onClose={() => setSel(null)}
            onEdit={(kind, id) => setEditing({ kind, id })}
          />
        )}
      </div>

      {/* Editores reutilizados (mesmos das abas). id "__new__" = criar. */}
      {editing?.kind === "tool" && (
        <ToolDialog
          tool={tools.find((t) => t.id === editing.id)}
          initialBaseIds={
            tools.some((t) => t.id === editing.id)
              ? baseTools.filter((bt) => bt.tool_id === editing.id && bt.enabled).map((bt) => bt.base_id)
              : bases.map((b) => b.id)
          }
          initialAcesso={Object.fromEntries(
            baseTools
              .filter((bt) => bt.tool_id === editing.id && bt.enabled)
              .map((bt) => [bt.base_id, { portais: bt.portais ?? [], empresas: bt.empresas ?? [], perfis: bt.perfis ?? [] }]),
          )}
          baseItems={bases.map((b) => ({ id: b.id, label: b.name, sub: b.base_code }))}
          bases={bases}
          moduleOptions={moduleOptions}
          credentialOptions={bases.flatMap((b) => b.credentials.map((c) => ({ id: c.id, name: c.name, base: b.name })))}
          todasTools={tools}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(payload) => run(() => saveTool(payload), "Tool salva.")}
        />
      )}
      {editing?.kind === "base" && (
        <BaseDialog
          base={bases.find((b) => b.id === editing.id)}
          spaces={spaces}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(payload) =>
            run(() => (bases.some((b) => b.id === editing.id) ? updateBase(payload) : createBase(payload)), "Base salva.")
          }
        />
      )}
      {editing?.kind === "agent" && (
        <AgentDialog
          agent={agents.find((a) => a.id === editing.id)}
          agents={agents}
          tools={tools}
          providers={providers}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(payload) => run(() => saveAgent(payload), "Agente salvo.")}
        />
      )}
    </div>
  );
}

// ─────────────────────────────── Inspetor ───────────────────────────────────
function Inspector({
  sel,
  bases,
  tools,
  agents,
  runs,
  tab,
  setTab,
  onClose,
  onEdit,
}: {
  sel: { kind: NodeKind; refId: string };
  bases: BaseRow[];
  tools: ToolRow[];
  agents: AgentRow[];
  runs: RunRow[];
  tab: "props" | "log";
  setTab: (t: "props" | "log") => void;
  onClose: () => void;
  onEdit: (kind: "base" | "agent" | "tool", id: string) => void;
}) {
  const tool = sel.kind === "tool" ? tools.find((t) => t.id === sel.refId) : undefined;
  const agent = sel.kind === "agent" ? agents.find((a) => a.id === sel.refId) : undefined;
  const baseSel = sel.kind === "base" ? bases.find((b) => b.id === sel.refId) : undefined;
  const toolRuns = tool ? runs.filter((r) => r.tool_key === tool.key).slice(0, 25) : [];

  const editable = sel.kind === "tool" || sel.kind === "agent" || sel.kind === "base";

  return (
    <aside className="absolute right-0 top-0 flex h-full w-80 flex-col border-l border-border bg-surface shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-sm font-semibold text-text">
          {sel.kind === "tool" ? "Ferramenta" : sel.kind === "agent" ? "Agente" : sel.kind === "base" ? "Base" : "Endpoint"}
        </span>
        <button onClick={onClose} className="text-text-muted hover:text-text" title="Fechar">
          <X className="size-4" />
        </button>
      </div>

      {tool && (
        <div className="flex gap-1 border-b border-border px-2 pt-2">
          {(["props", "log"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px border-b-2 px-2.5 py-1.5 text-xs font-medium",
                tab === t ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-transparent text-text-muted hover:text-text",
              )}
            >
              {t === "props" ? "Propriedades" : `Log (${toolRuns.length})`}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tool && tab === "log" ? (
          toolRuns.length === 0 ? (
            <p className="text-sm text-text-muted">Sem execuções recentes desta ferramenta.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {toolRuns.map((r) => (
                <li key={r.id} className="rounded-lg border border-border bg-surface-2/40 p-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    {r.ok ? (
                      <CheckCircle2 className="size-3.5 text-success" />
                    ) : (
                      <XCircle className="size-3.5 text-brand-pink-700" />
                    )}
                    <span className="font-medium text-text">{r.base_code}</span>
                    {r.status != null && <span className="text-text-muted">HTTP {r.status}</span>}
                    <span className="ml-auto inline-flex items-center gap-1 text-text-muted">
                      <Clock className="size-3.5" /> {new Date(r.created_at).toLocaleTimeString("pt-BR")}
                    </span>
                  </div>
                  {r.error && <p className="mt-1 text-brand-pink-700">{r.error}</p>}
                  <details className="mt-1">
                    <summary className="cursor-pointer text-text-muted">entrada / saída</summary>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-2xs text-text">
                      {JSON.stringify({ input: r.input, output: r.output }, null, 2)}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="flex flex-col gap-2.5 text-sm">
            {tool && (
              <>
                <Prop label="Chave" value={tool.key} mono />
                <Prop label="Método" value={tool.method} />
                <Prop label="Endpoint" value={tool.endpoint_kind === "external" ? "Externo" : "Interno (base)"} />
                <Prop label={tool.endpoint_kind === "external" ? "URL externa" : "Caminho"} value={tool.endpoint_kind === "external" ? tool.external_url ?? "—" : tool.path_template || "—"} mono />
                <Prop label="Parâmetros" value={String(tool.params.length)} />
                {tool.cache_ttl != null && <Prop label="Cache" value={`${tool.cache_ttl}s`} />}
                {tool.guard && <Prop label="Guard" value={tool.guard} mono />}
                {tool.loop && <Prop label="Loop" value="período mês a mês" />}
                {tool.system_prompt && <Prop label="Prompt próprio" value={tool.system_prompt} />}
                {!tool.active && <Badge tone="warning">Inativa no catálogo</Badge>}
              </>
            )}
            {agent && (
              <>
                <Prop label="Chave" value={agent.key} mono />
                <Prop label="Modelo" value={agent.model ? agent.model : "IA padrão de chat"} />
                <Prop label="Prioridade" value={String(agent.priority)} />
                <Prop label="Ferramentas" value={String(agent.toolIds.length)} />
                {agent.description && <Prop label="Descrição" value={agent.description} />}
                {!agent.active && <Badge tone="warning">Inativo</Badge>}
              </>
            )}
            {baseSel && (
              <>
                <Prop label="base_code" value={baseSel.base_code} mono />
                <Prop label="URL base" value={baseSel.base_url ?? "—"} mono />
                <Prop label="Credencial padrão" value={baseSel.credentials.find((c) => c.id === baseSel.credential_id)?.name ?? "— sem auth —"} />
                <Prop label="Documentações (RAG)" value={String(baseSel.spaceIds.length)} />
                {!baseSel.active && <Badge tone="warning">Inativa</Badge>}
              </>
            )}
            {sel.kind === "endpoint" && (
              <p className="text-sm text-text-muted">
                Destino das ferramentas que apontam para cá. Um endpoint interno usa a URL da base;
                um externo, a URL própria da tool.
              </p>
            )}
          </div>
        )}
      </div>

      {editable && (
        <div className="border-t border-border p-3">
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={() =>
              onEdit(sel.kind as "base" | "agent" | "tool", sel.refId)
            }
          >
            <Pencil /> Editar
          </Button>
        </div>
      )}
    </aside>
  );
}

function Prop({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className={cn("break-words text-sm text-text", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}
