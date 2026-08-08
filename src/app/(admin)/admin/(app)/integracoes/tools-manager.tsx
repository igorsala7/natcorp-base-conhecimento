"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Braces, Copy, Globe, List, Pencil, Plus, Table as TableIcon, Trash2, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { controlClass } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Shuttle, type ShuttleItem } from "@/components/ui/shuttle";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { AUTH_TYPES, type AuthType } from "@/lib/integrations/credentials";
import {
  HTTP_METHODS,
  IDENTITY_FIELDS,
  PARAM_LOCAIS,
  PARAM_ORIGENS,
  PARAM_TIPOS,
  paramVazio,
  type HttpMethod,
  type LoopConfig,
  type ToolParam,
} from "@/lib/integrations/tools";
import { type EscopoPainel, type PanelScopeMap } from "@/lib/integrations/panel-scope";
import { GUARD_CATALOG, guardInfo } from "@/lib/integrations/guard-catalog";
import { saveTool, deleteTool, duplicateTool, listarPerfisDaBase, setToolFlags, bulkSetToolModules, bulkSetToolAccess } from "./tool-actions";
import { PORTAIS } from "@/lib/integrations/gating";
import type { IntegResult } from "./actions";
import type { BaseRow } from "./integrations-manager";
import { Select } from "@/components/ui/select";

/** Teto da descrição de usuário. Medido no widget: o sublabel comporta ~52 chars por
 *  linha no desktop e ~44 no celular, e o gate de fonte chega a listar 10 opções —
 *  acima disto a lista deixa de caber numa tela e o botão de confirmar sai de vista. */
const MAX_DESC_USUARIO = 220;

export type EndpointKind = "base" | "external";
/** Tag de roteamento por assunto: módulo + submódulo (null = módulo inteiro). */
export type ModuleTag = { modulo: string; submodulo: string | null };
export type ToolRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  /** Como a ferramenta é apresentada AO USUÁRIO nos botões do chat (1-2 frases). */
  descricao_usuario: string | null;
  /** false = uso interno do agente: some das listagens de fonte do chat. */
  selecionavel_no_chat: boolean;
  method: HttpMethod;
  path_template: string;
  auth_type: AuthType;
  params: ToolParam[];
  response_hint: string | null;
  search_terms: string | null;
  active: boolean;
  always_include: boolean;
  /** Desempate numérico — só compete entre tools do mesmo `grupo_ambiguidade`. */
  prioridade: number;
  grupo_ambiguidade: string | null;
  /** Desempate PAREADO: as ferramentas que ESTA vence quando disputam o mesmo turno. */
  vence_de: { tool_id: string; modo: "empate" | "sempre"; motivo: string | null }[];
  tags: ModuleTag[];
  endpoint_kind: EndpointKind;
  external_url: string | null;
  credential_id: string | null;
  system_prompt: string;
  body_mode: string | null;
  guard: string | null;
  cache_ttl: number | null;
  cache_scope: string;
  loop: LoopConfig | null;
  /** Escopo de dados por painel (PO/PG/PC). NULL = "todos" para todos os painéis. */
  panel_scope: PanelScopeMap | null;
  /** Nunca traz/mira os próprios dados do usuário (ex.: requisição de desligamento). */
  exclude_self: boolean;
};

/** Patch de flags de nível-tool (edição inline da tabela + edição em lote). */
type FlagPatch = {
  active?: boolean;
  always_include?: boolean;
  loop?: LoopConfig | null;
  cache_ttl?: number | null;
  panel_scope?: PanelScopeMap | null;
  exclude_self?: boolean;
};

/** Rótulos e ordem dos painéis (PO/PG/PC) para os seletores de escopo. */
const PORTAL_LABEL: Record<"PO" | "PG" | "PC", string> = {
  PO: PORTAIS.find((p) => p.code === "PO")?.label ?? "Operador",
  PG: PORTAIS.find((p) => p.code === "PG")?.label ?? "Gestor",
  PC: PORTAIS.find((p) => p.code === "PC")?.label ?? "Colaborador",
};
const ESCOPO_OPCOES: { v: EscopoPainel; label: string; hint: string }[] = [
  { v: "nenhum", label: "— (bloqueada)", hint: "A ferramenta não aparece para este painel." },
  { v: "proprios", label: "Próprios dados", hint: "Força a empresa/matrícula do próprio usuário." },
  { v: "equipe", label: "Dados da equipe", hint: "Só colaboradores da equipe do gestor." },
  { v: "todos", label: "Todos os dados", hint: "Respeita o acesso já parametrizado no sistema." },
];

type CredentialOption = { id: string; name: string; base: string };

const AUTH_LABEL = Object.fromEntries(AUTH_TYPES.map((a) => [a.value, a.label])) as Record<AuthType, string>;

/** Chave estável de uma tag para o Shuttle (módulo + submódulo). */
const tagKey = (m: ModuleTag): string => JSON.stringify([m.modulo, m.submodulo]);
const parseTagKey = (k: string): ModuleTag => {
  const [modulo, submodulo] = JSON.parse(k) as [string, string | null];
  return { modulo, submodulo: submodulo ?? null };
};
/** Rótulo legível: submódulo já é um caminho ("A > B > C"); módulo é a raiz. */
const tagLabel = (m: ModuleTag): string => (m.submodulo ? `${m.modulo} › ${m.submodulo}` : m.modulo);

/** Config de loop ao LIGAR pela tabela (mesmos defaults do editor). */
const LOOP_DEFAULT: LoopConfig = { unit: "month", param: "data_ref", from: "periodo_ini", to: "periodo_fim", max: 24 };

export function ToolsManager({
  tools,
  bases,
  baseTools,
  moduleOptions,
}: {
  tools: ToolRow[];
  bases: BaseRow[];
  baseTools: BaseToolRow[];
  moduleOptions: ModuleTag[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<"lista" | "tabela">("lista");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<null | "modulos" | "acesso">(null);
  const [dialog, setDialog] = useState<{
    tool?: ToolRow;
    baseIds: string[];
    acesso: Record<string, { portais: string[]; empresas: string[]; perfis: string[] }>;
  } | null>(null);

  // Bases onde CADA tool está ativa hoje (ai_base_tools.enabled). Nova tool =
  // ativa em TODAS por padrão.
  const enabledByTool = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const bt of baseTools) {
      if (!bt.enabled) continue;
      const arr = m.get(bt.tool_id) ?? [];
      arr.push(bt.base_id);
      m.set(bt.tool_id, arr);
    }
    return m;
  }, [baseTools]);
  // Allowlists (#4) por (tool, base): { baseId: { portais, perfis } }.
  const acessoByTool = useMemo(() => {
    const m = new Map<string, Record<string, { portais: string[]; empresas: string[]; perfis: string[] }>>();
    for (const bt of baseTools) {
      if (!bt.enabled) continue;
      const rec = m.get(bt.tool_id) ?? {};
      rec[bt.base_id] = { portais: bt.portais ?? [], empresas: bt.empresas ?? [], perfis: bt.perfis ?? [] };
      m.set(bt.tool_id, rec);
    }
    return m;
  }, [baseTools]);
  const credentialOptions = useMemo<CredentialOption[]>(
    () => bases.flatMap((b) => b.credentials.map((c) => ({ id: c.id, name: c.name, base: b.name }))),
    [bases],
  );
  const baseItems = useMemo<ShuttleItem[]>(() => bases.map((b) => ({ id: b.id, label: b.name, sub: b.base_code })), [bases]);

  function abrir(tool?: ToolRow) {
    const baseIds = tool ? (enabledByTool.get(tool.id) ?? []) : bases.map((b) => b.id);
    const acesso = tool ? (acessoByTool.get(tool.id) ?? {}) : {};
    setDialog({ tool, baseIds, acesso });
  }

  function run(fn: () => Promise<IntegResult>, okMsg?: string, onOk?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return toast.error(r.error);
      if (okMsg) toast.success(okMsg);
      onOk?.();
      router.refresh();
    });
  }

  // Edição inline (tabela) de flags tool-level. Silencioso (só refresh) para não
  // encher de toast a cada clique. Ligar Loop usa a config padrão (mês a mês) —
  // ajuste fino no editor.
  function toggleFlag(t: ToolRow, patch: FlagPatch) {
    run(() => setToolFlags({ toolIds: [t.id], ...patch }));
  }

  // ── Seleção múltipla + edição em lote (Fase C) ──
  const selArr = [...selectedIds];
  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(tools.map((t) => t.id)) : new Set());
  }
  function bulkFlag(patch: FlagPatch) {
    if (!selArr.length) return;
    run(() => setToolFlags({ toolIds: selArr, ...patch }), `${selArr.length} tool(s) atualizada(s).`);
  }
  function aplicarAcesso(payload: {
    baseId: string;
    op: "add" | "remove";
    portais: string[];
    empresas: string[];
    perfis: string[];
    ativar: boolean;
  }) {
    if (!selArr.length) return;
    startTransition(async () => {
      const r = await bulkSetToolAccess({ toolIds: selArr, ...payload });
      if (!r.ok) return toast.error(r.error);
      toast.success(
        `Acesso atualizado em ${r.count ?? 0} tool(s)` +
          (r.puladas ? `; ${r.puladas} pulada(s) (inativa(s) na base)` : "") +
          ".",
      );
      setBulk(null);
      router.refresh();
    });
  }

  async function excluir(t: ToolRow) {
    if (
      await confirmar({
        title: "Excluir API/Tool",
        description: `Excluir "${t.name}"? Ela será removida das bases e agentes que a usam.`,
        tone: "danger",
        confirmLabel: "Excluir",
      })
    )
      run(() => deleteTool(t.id), "Tool excluída.");
  }

  // Duplicar: cria uma cópia INATIVA (chave + campos + bases + módulos) para o admin
  // abrir e ajustar. Não auto-abre o editor (a cópia só aparece após o refresh, e abrir
  // antes disso mostraria bases vazias — salvar apagaria as bases copiadas).
  function duplicar(t: ToolRow) {
    run(() => duplicateTool(t.id), `Cópia de "${t.name}" criada (inativa) — abra para ajustar.`);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text">Catálogo de APIs / Tools</h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5">
            <ViewButton active={view === "lista"} onClick={() => setView("lista")} title="Lista">
              <List className="size-4" />
            </ViewButton>
            <ViewButton active={view === "tabela"} onClick={() => setView("tabela")} title="Tabela / Relatório">
              <TableIcon className="size-4" />
            </ViewButton>
          </div>
          <Button size="sm" onClick={() => abrir()}>
            <Plus /> Nova API/Tool
          </Button>
        </div>
      </div>
      <p className="mb-3 text-xs text-text-muted">
        O catálogo é global. Cada tool escolhe em quais bases fica ativa. A URL base e a credencial
        vêm da <strong>base</strong> (tools internas) ou da <strong>própria tool</strong> (tools externas).
      </p>

      {tools.length === 0 ? (
        <EmptyState
          icon={Webhook}
          title="Nenhuma API cadastrada"
          description="Cadastre uma API/Tool com seus parâmetros — a IA a usará quando fizer sentido."
        />
      ) : view === "tabela" ? (
        <div className="flex flex-col gap-2">
          {selectedIds.size > 0 && (
            <BulkBar
              count={selectedIds.size}
              pending={pending}
              onFlag={bulkFlag}
              onModulos={() => setBulk("modulos")}
              onAcesso={() => setBulk("acesso")}
              onClear={() => setSelectedIds(new Set())}
            />
          )}
          <ToolsTable
            tools={tools}
            basesCount={enabledByTool}
            pending={pending}
            selected={selectedIds}
            onToggleOne={toggleOne}
            onToggleAll={toggleAll}
            onEdit={abrir}
            onDelete={excluir}
            onDuplicate={duplicar}
            onFlag={toggleFlag}
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {tools.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
              <Webhook className="size-4 shrink-0 text-text-muted" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-text">{t.name}</span>
                  <Badge tone="neutral">{t.method}</Badge>
                  {t.endpoint_kind === "external" && (
                    <Badge tone="info">
                      <Globe className="size-3" /> Externa
                    </Badge>
                  )}
                  <Badge tone="neutral">{AUTH_LABEL[t.auth_type]}</Badge>
                  {t.params.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                      <Braces className="size-3.5" /> {t.params.length}
                    </span>
                  )}
                  {!t.active && <Badge tone="warning">Inativa</Badge>}
                </div>
                <div className="mt-0.5 truncate font-mono text-xs text-text-muted">
                  {t.key} · {t.path_template || "(sem caminho)"}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => abrir(t)} title="Editar">
                <Pencil />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => duplicar(t)} disabled={pending} title="Duplicar">
                <Copy />
              </Button>
              <Button size="icon" variant="danger" onClick={() => excluir(t)} title="Excluir">
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {dialog && (
        <ToolDialog
          tool={dialog.tool}
          initialBaseIds={dialog.baseIds}
          initialAcesso={dialog.acesso}
          baseItems={baseItems}
          bases={bases}
          moduleOptions={moduleOptions}
          credentialOptions={credentialOptions}
          todasTools={tools}
          pending={pending}
          onClose={() => setDialog(null)}
          onSave={(payload) => run(() => saveTool(payload), "Tool salva.", () => setDialog(null))}
        />
      )}

      {bulk === "modulos" && (
        <BulkModulesDialog
          count={selArr.length}
          moduleOptions={moduleOptions}
          pending={pending}
          onClose={() => setBulk(null)}
          onApply={(op, modulos) =>
            run(
              () => bulkSetToolModules({ toolIds: selArr, op, modulos }),
              `Módulos ${op === "add" ? "adicionados a" : "removidos de"} ${selArr.length} tool(s).`,
              () => setBulk(null),
            )
          }
        />
      )}

      {bulk === "acesso" && (
        <BulkAccessDialog count={selArr.length} bases={bases} pending={pending} onClose={() => setBulk(null)} onApply={aplicarAcesso} />
      )}
    </div>
  );
}

function ViewButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={
        active
          ? "inline-flex items-center rounded-md bg-[var(--color-primary)]/10 p-1.5 text-[var(--color-primary)]"
          : "inline-flex items-center rounded-md p-1.5 text-text-muted hover:text-text"
      }
    >
      {children}
    </button>
  );
}

// ─────────────────── Visão Tabela / Relatório (editável) ────────────────────
function ToolsTable({
  tools,
  basesCount,
  pending,
  selected,
  onToggleOne,
  onToggleAll,
  onEdit,
  onDelete,
  onDuplicate,
  onFlag,
}: {
  tools: ToolRow[];
  basesCount: Map<string, string[]>;
  pending: boolean;
  selected: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onEdit: (t: ToolRow) => void;
  onDelete: (t: ToolRow) => void;
  onDuplicate: (t: ToolRow) => void;
  onFlag: (t: ToolRow, patch: FlagPatch) => void;
}) {
  const th = "px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-muted";
  const td = "px-2.5 py-2 align-middle";
  const todosMarcados = tools.length > 0 && tools.every((t) => selected.has(t.id));
  const algunsMarcados = selected.size > 0 && !todosMarcados;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="border-b border-border bg-surface-2/40">
          <tr>
            <th className={`${th} w-8`}>
              <TriCheck checked={todosMarcados} indeterminate={algunsMarcados} title="Selecionar todas" onChange={onToggleAll} />
            </th>
            <th className={th}>Tool</th>
            <th className={th}>Método</th>
            <th className={`${th} text-center`}>Ativa</th>
            <th className={`${th} text-center`}>Essencial</th>
            <th className={`${th} text-center`}>Loop</th>
            <th className={`${th} text-center`} title="Tempo de cache do resultado, em segundos. 0 = sem cache. Escopo (usuário/empresa/global) no editor.">Cache (s)</th>
            <th className={`${th} text-center`}>Módulos</th>
            <th className={`${th} text-center`}>Bases</th>
            <th className={`${th} text-center`} title="Alcance da consulta por painel: Operador · Gestor · Colaborador">Escopo · PO/PG/PC</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {tools.map((t) => (
            <tr key={t.id} className={`border-b border-border/60 last:border-0 hover:bg-surface-2/30 ${selected.has(t.id) ? "bg-[var(--color-primary)]/5" : ""}`}>
              <td className={`${td} text-center`}>
                <input
                  type="checkbox"
                  checked={selected.has(t.id)}
                  onChange={() => onToggleOne(t.id)}
                  aria-label={`Selecionar ${t.name}`}
                  className="size-4 accent-[var(--color-primary)]"
                />
              </td>
              <td className={td}>
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-text">{t.name}</span>
                  {t.endpoint_kind === "external" && <Badge tone="info"><Globe className="size-3" /> Ext.</Badge>}
                </div>
                <div className="truncate font-mono text-xs text-text-muted">{t.key}</div>
              </td>
              <td className={td}>
                <Badge tone="neutral">{t.method}</Badge>
              </td>
              <td className={`${td} text-center`}>
                <CellCheck checked={t.active} disabled={pending} title="Ativa no catálogo" onChange={(v) => onFlag(t, { active: v })} />
              </td>
              <td className={`${td} text-center`}>
                <CellCheck checked={t.always_include} disabled={pending} title="Essencial (entra sempre no roteamento)" onChange={(v) => onFlag(t, { always_include: v })} />
              </td>
              <td className={`${td} text-center`}>
                <CellCheck
                  checked={Boolean(t.loop)}
                  disabled={pending}
                  title={t.loop ? `Loop: ${t.loop.unit}` : "Ligar loop (config padrão; ajuste no editor)"}
                  onChange={(v) => onFlag(t, { loop: v ? LOOP_DEFAULT : null })}
                />
              </td>
              <td className={`${td} text-center`}>
                <CacheCell tool={t} disabled={pending} onFlag={onFlag} />
              </td>
              <td className={`${td} text-center tabular-nums`}>
                {t.tags.length > 0 ? (
                  <button type="button" onClick={() => onEdit(t)} className="text-[var(--color-primary)] hover:underline" title="Editar tags de módulo">
                    {t.tags.length}
                  </button>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </td>
              <td className={`${td} text-center tabular-nums text-text-muted`}>{basesCount.get(t.id)?.length ?? 0}</td>
              <td className={`${td} text-center`}>
                <PanelScopeCell tool={t} disabled={pending} onFlag={onFlag} />
              </td>
              <td className={`${td} whitespace-nowrap text-right`}>
                <Button size="sm" variant="ghost" onClick={() => onEdit(t)} title="Editar">
                  <Pencil />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => onDuplicate(t)} disabled={pending} title="Duplicar">
                  <Copy />
                </Button>
                <Button size="icon" variant="danger" onClick={() => onDelete(t)} title="Excluir">
                  <Trash2 />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Célula de ESCOPO POR PAINEL (edição inline). Três seletores compactos (PO/PG/PC),
 * cada um: — (bloqueada) · Próprios · Equipe · Todos. Ausência de config = "Todos".
 * Um seletor "≠eu" indica quando a tool nunca pode trazer os próprios dados.
 */
function PanelScopeCell({ tool, disabled, onFlag }: { tool: ToolRow; disabled: boolean; onFlag: (t: ToolRow, patch: FlagPatch) => void }) {
  const cur = tool.panel_scope ?? {};
  const val = (p: "PO" | "PG" | "PC"): EscopoPainel => cur[p] ?? "todos";
  const set = (p: "PO" | "PG" | "PC", v: EscopoPainel) =>
    onFlag(tool, { panel_scope: { PO: val("PO"), PG: val("PG"), PC: val("PC"), [p]: v } });
  return (
    <div className="flex items-center justify-center gap-1.5">
      {(["PO", "PG", "PC"] as const).map((p) => {
        const v = val(p);
        return (
          <label key={p} className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-medium text-text-muted" title={PORTAL_LABEL[p]}>{p}</span>
            <Select
              aria-label={`Escopo ${PORTAL_LABEL[p]} de ${tool.name}`}
              title={ESCOPO_OPCOES.find((o) => o.v === v)?.hint}
              disabled={disabled}
              value={v}
              onChange={(v) => set(p, v as EscopoPainel)}
              className={`rounded border bg-surface px-1 py-0.5 text-xs ${
                v === "nenhum"
                  ? "border-border text-text-muted"
                  : v === "todos"
                    ? "border-border text-text"
                    : "border-[var(--color-primary)]/40 text-[var(--color-primary)]"
              }`}
            >
              {ESCOPO_OPCOES.map((o) => (
                <option key={o.v} value={o.v}>{o.v === "nenhum" ? "—" : o.v === "proprios" ? "Próprio" : o.v === "equipe" ? "Equipe" : "Todos"}</option>
              ))}
            </Select>
          </label>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onFlag(tool, { exclude_self: !tool.exclude_self })}
        title={tool.exclude_self ? "Nunca os próprios dados — ligado (clique p/ desligar)" : "Permitir os próprios dados (clique p/ nunca mostrar os próprios)"}
        className={`ml-0.5 self-end rounded border px-1 py-0.5 text-[10px] font-medium ${
          tool.exclude_self ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-border text-text-muted"
        }`}
      >
        ≠eu
      </button>
    </div>
  );
}

/**
 * Edição INLINE do tempo de cache (segundos) na tabela. 0/vazio = sem cache (null).
 * Confirma no blur ou Enter; só chama o servidor se mudou. O `key` reinicia o valor
 * exibido quando o dado muda por fora (após salvar/atualizar).
 */
function CacheCell({ tool, disabled, onFlag }: { tool: ToolRow; disabled: boolean; onFlag: (t: ToolRow, patch: FlagPatch) => void }) {
  const atual = tool.cache_ttl ?? 0;
  const commit = (v: string) => {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    const novo = n > 0 ? n : null;
    if (novo !== (tool.cache_ttl ?? null)) onFlag(tool, { cache_ttl: novo });
  };
  return (
    <input
      key={atual}
      type="number"
      min={0}
      step={60}
      disabled={disabled}
      defaultValue={atual}
      aria-label={`Cache em segundos de ${tool.name}`}
      title={tool.cache_ttl ? `Cache ${tool.cache_ttl}s · escopo ${tool.cache_scope}` : "Sem cache (0 = desligado)"}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="w-16 rounded border border-border bg-surface px-1 py-0.5 text-center text-xs tabular-nums"
    />
  );
}

/** Checkbox de célula (edição inline). */
function CellCheck({ checked, disabled, title, onChange }: { checked: boolean; disabled: boolean; title: string; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      title={title}
      aria-label={title}
      onChange={(e) => onChange(e.target.checked)}
      className="size-4 accent-[var(--color-primary)] disabled:opacity-50"
    />
  );
}

/** Checkbox "selecionar todas" com estado indeterminado (alguns marcados). */
function TriCheck({ checked, indeterminate, title, onChange }: { checked: boolean; indeterminate: boolean; title: string; onChange: (v: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      title={title}
      aria-label={title}
      onChange={(e) => onChange(e.target.checked)}
      className="size-4 accent-[var(--color-primary)]"
    />
  );
}

// ─────────────────────── Barra de edição em LOTE (Fase C) ────────────────────
function BulkBar({
  count,
  pending,
  onFlag,
  onModulos,
  onAcesso,
  onClear,
}: {
  count: number;
  pending: boolean;
  onFlag: (patch: FlagPatch) => void;
  onModulos: () => void;
  onAcesso: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-3 py-2">
      <span className="text-sm font-medium text-text">{count} selecionada(s)</span>
      <BulkGroup label="Ativa">
        <MiniBtn onClick={() => onFlag({ active: true })} disabled={pending}>Ativar</MiniBtn>
        <MiniBtn onClick={() => onFlag({ active: false })} disabled={pending}>Desativar</MiniBtn>
      </BulkGroup>
      <BulkGroup label="Essencial">
        <MiniBtn onClick={() => onFlag({ always_include: true })} disabled={pending}>Marcar</MiniBtn>
        <MiniBtn onClick={() => onFlag({ always_include: false })} disabled={pending}>Desmarcar</MiniBtn>
      </BulkGroup>
      <BulkGroup label="Loop">
        <MiniBtn onClick={() => onFlag({ loop: LOOP_DEFAULT })} disabled={pending}>Ligar</MiniBtn>
        <MiniBtn onClick={() => onFlag({ loop: null })} disabled={pending}>Desligar</MiniBtn>
      </BulkGroup>
      <Button size="sm" variant="secondary" onClick={onModulos} disabled={pending}>Módulos…</Button>
      <Button size="sm" variant="secondary" onClick={onAcesso} disabled={pending}>Acesso por base…</Button>
      <button type="button" onClick={onClear} className="ml-auto text-xs text-text-muted hover:text-text">Limpar seleção</button>
    </div>
  );
}

function BulkGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs text-text-muted">{label}:</span>
      <span className="inline-flex overflow-hidden rounded-md border border-border">{children}</span>
    </span>
  );
}

function MiniBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border-border bg-surface px-2 py-1 text-xs text-text hover:bg-surface-2 disabled:opacity-50 [&:not(:first-child)]:border-l"
    >
      {children}
    </button>
  );
}

// ───────────── Diálogo de lote: tags de módulo (adicionar/remover) ───────────
function BulkModulesDialog({
  count,
  moduleOptions,
  pending,
  onClose,
  onApply,
}: {
  count: number;
  moduleOptions: ModuleTag[];
  pending: boolean;
  onClose: () => void;
  onApply: (op: "add" | "remove", modulos: ModuleTag[]) => void;
}) {
  const [op, setOp] = useState<"add" | "remove">("add");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const items = useMemo<ShuttleItem[]>(
    () => moduleOptions.map((m) => ({ id: tagKey(m), label: tagLabel(m) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [moduleOptions],
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Módulos — ${count} tool(s)`}
      resizable
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={pending || sel.size === 0} onClick={() => onApply(op, [...sel].map(parseTagKey))}>
            {op === "add" ? "Adicionar" : "Remover"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <OpToggle op={op} onChange={setOp} addLabel="Adicionar tags" removeLabel="Remover tags" />
        {items.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum módulo sincronizado. Sincronize os módulos da base primeiro (aba Bases / Clientes).</p>
        ) : (
          <Shuttle items={items} selected={sel} onChange={setSel} leftTitle="Disponíveis" rightTitle="Escolhidos" />
        )}
      </div>
    </Dialog>
  );
}

// ─── Diálogo de lote: acesso por base (portal/empresa/perfil, add/remover) ───
function BulkAccessDialog({
  count,
  bases,
  pending,
  onClose,
  onApply,
}: {
  count: number;
  bases: BaseRow[];
  pending: boolean;
  onClose: () => void;
  onApply: (p: { baseId: string; op: "add" | "remove"; portais: string[]; empresas: string[]; perfis: string[]; ativar: boolean }) => void;
}) {
  const toast = useToast();
  const [baseId, setBaseId] = useState(bases[0]?.id ?? "");
  const [op, setOp] = useState<"add" | "remove">("add");
  const [portais, setPortais] = useState<string[]>([]);
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [perfis, setPerfis] = useState<string[]>([]);
  const [novaEmpresa, setNovaEmpresa] = useState("");
  const [novoPerfil, setNovoPerfil] = useState("");
  const [sugestoes, setSugestoes] = useState<string[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [ativar, setAtivar] = useState(false);
  const base = bases.find((b) => b.id === baseId);

  const togglePortal = (c: string) => setPortais((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const addChip = (list: string[], set: (v: string[]) => void, raw: string) => {
    const v = raw.trim();
    if (v && !list.some((x) => x.toLowerCase() === v.toLowerCase())) set([...list, v]);
  };
  const nada = portais.length + empresas.length + perfis.length === 0;

  async function buscarPerfis() {
    if (!baseId) return;
    setBuscando(true);
    const r = await listarPerfisDaBase(baseId);
    setBuscando(false);
    if (!r.ok) return toast.error(r.error ?? "Falha ao buscar perfis.");
    setSugestoes(r.perfis ?? []);
    if (!r.perfis?.length) toast.info(base?.perfis_endpoint ? "A API não retornou perfis." : "Configure a API de perfis nesta base (editar base).");
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Acesso por base — ${count} tool(s)`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={pending || !baseId || nada} onClick={() => onApply({ baseId, op, portais, empresas, perfis, ativar })}>
            {op === "add" ? "Liberar/Adicionar" : "Restringir/Remover"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Base" htmlFor="bulk_base" hint="Portais/empresas/perfis são por base. Só as tools ativas nesta base são alteradas.">
          <Select id="bulk_base" value={baseId} onChange={(v) => { setBaseId(v); setSugestoes(null); }}>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>{b.name} · {b.base_code}</option>
            ))}
          </Select>
        </Field>

        <OpToggle op={op} onChange={setOp} addLabel="Adicionar à allowlist" removeLabel="Remover da allowlist" />

        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">Portais</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {PORTAIS.map((p) => (
              <label key={p.code} className="inline-flex items-center gap-1.5 text-sm text-text">
                <input type="checkbox" checked={portais.includes(p.code)} onChange={() => togglePortal(p.code)} className="size-4 accent-[var(--color-primary)]" />
                {p.code} <span className="text-text-muted">({p.label})</span>
              </label>
            ))}
          </div>
        </div>

        <ChipField
          label="Empresas (cod_empresa)"
          chips={empresas}
          value={novaEmpresa}
          onValue={setNovaEmpresa}
          onAdd={() => { addChip(empresas, setEmpresas, novaEmpresa); setNovaEmpresa(""); }}
          onRemove={(e) => setEmpresas(empresas.filter((x) => x !== e))}
          placeholder="código da empresa e Enter (ex.: 1001)"
        />

        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs text-text-muted">Perfis:</span>
            <Button size="sm" variant="ghost" onClick={buscarPerfis} disabled={buscando}>{buscando ? "Buscando…" : "Buscar da API"}</Button>
          </div>
          <ChipRow
            chips={perfis}
            value={novoPerfil}
            onValue={setNovoPerfil}
            onAdd={() => { addChip(perfis, setPerfis, novoPerfil); setNovoPerfil(""); }}
            onRemove={(p) => setPerfis(perfis.filter((x) => x !== p))}
            placeholder="digite um perfil e Enter (ex.: MASTER)"
          />
          {sugestoes && sugestoes.filter((s) => !perfis.some((p) => p.toLowerCase() === s.toLowerCase())).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {sugestoes
                .filter((s) => !perfis.some((p) => p.toLowerCase() === s.toLowerCase()))
                .map((s) => (
                  <button key={s} type="button" onClick={() => addChip(perfis, setPerfis, s)} className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted hover:text-text">
                    + {s}
                  </button>
                ))}
            </div>
          )}
        </div>

        {op === "add" && (
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={ativar} onChange={(e) => setAtivar(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
            Ativar nesta base as tools que ainda não estão ativas (senão, elas são puladas)
          </label>
        )}
      </div>
    </Dialog>
  );
}

/** Alternância Adicionar × Remover (usada nos dois diálogos de lote). */
function OpToggle({ op, onChange, addLabel, removeLabel }: { op: "add" | "remove"; onChange: (v: "add" | "remove") => void; addLabel: string; removeLabel: string }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-border">
      {(["add", "remove"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={
            op === v
              ? "bg-[var(--color-primary)]/10 px-3 py-1.5 text-sm font-medium text-[var(--color-primary)]"
              : "px-3 py-1.5 text-sm text-text-muted hover:text-text"
          }
        >
          {v === "add" ? addLabel : removeLabel}
        </button>
      ))}
    </div>
  );
}

/** Campo de chips (com rótulo) — empresas. */
function ChipField(props: { label: string; chips: string[]; value: string; onValue: (v: string) => void; onAdd: () => void; onRemove: (c: string) => void; placeholder: string }) {
  return (
    <div>
      <div className="mb-1 text-xs text-text-muted">{props.label} — vazio = todas:</div>
      <ChipRow chips={props.chips} value={props.value} onValue={props.onValue} onAdd={props.onAdd} onRemove={props.onRemove} placeholder={props.placeholder} />
    </div>
  );
}

/** Linha de chips + input (Enter adiciona). */
function ChipRow({ chips, value, onValue, onAdd, onRemove, placeholder }: { chips: string[]; value: string; onValue: (v: string) => void; onAdd: () => void; onRemove: (c: string) => void; placeholder: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span key={c} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
          {c}
          <button type="button" onClick={() => onRemove(c)} aria-label={`Remover ${c}`} className="text-primary/70 hover:text-primary">×</button>
        </span>
      ))}
      <input
        className="min-w-[140px] flex-1 rounded border border-border bg-surface px-2 py-1 text-xs"
        value={value}
        onChange={(e) => onValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
        placeholder={placeholder}
      />
    </div>
  );
}

// ──────────────────────────── Diálogo: Tool ─────────────────────────────────
export function ToolDialog({
  tool,
  initialBaseIds,
  initialAcesso,
  baseItems,
  bases,
  moduleOptions,
  credentialOptions,
  todasTools,
  pending,
  onClose,
  onSave,
}: {
  tool?: ToolRow;
  initialBaseIds: string[];
  initialAcesso: Record<string, { portais: string[]; empresas: string[]; perfis: string[] }>;
  baseItems: ShuttleItem[];
  bases: BaseRow[];
  moduleOptions: ModuleTag[];
  credentialOptions: CredentialOption[];
  /** Catálogo inteiro — origem das opções de "vence de" e dos grupos já usados. */
  todasTools: ToolRow[];
  pending: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [key, setKey] = useState(tool?.key ?? "");
  const [name, setName] = useState(tool?.name ?? "");
  const [description, setDescription] = useState(tool?.description ?? "");
  const [descricaoUsuario, setDescricaoUsuario] = useState(tool?.descricao_usuario ?? "");
  const [selecionavelNoChat, setSelecionavelNoChat] = useState(tool?.selecionavel_no_chat ?? true);
  const [method, setMethod] = useState<HttpMethod>(tool?.method ?? "GET");
  const [pathTemplate, setPathTemplate] = useState(tool?.path_template ?? "");
  const [authType, setAuthType] = useState<AuthType>(tool?.auth_type ?? "oauth2");
  const [responseHint, setResponseHint] = useState(tool?.response_hint ?? "");
  const [searchTerms, setSearchTerms] = useState(tool?.search_terms ?? "");
  const [active, setActive] = useState(tool?.active ?? true);
  const [params, setParams] = useState<ToolParam[]>(tool?.params ?? []);
  // Endpoint (interno × externo) + prompt próprio.
  const [endpointKind, setEndpointKind] = useState<EndpointKind>(tool?.endpoint_kind ?? "base");
  const [externalUrl, setExternalUrl] = useState(tool?.external_url ?? "");
  const [credentialId, setCredentialId] = useState(tool?.credential_id ?? "");
  const [systemPrompt, setSystemPrompt] = useState(tool?.system_prompt ?? "");
  // Roteamento por assunto: tags de módulo (Shuttle) + essencial (entra sempre).
  const [tags, setTags] = useState<Set<string>>(new Set((tool?.tags ?? []).map(tagKey)));
  const [alwaysInclude, setAlwaysInclude] = useState(tool?.always_include ?? false);
  // Opções = cache sincronizado ∪ tags atuais da tool (para não sumir uma tag
  // que já existe mas não está mais no cache). Ordenado por rótulo.
  const moduleItems = useMemo<ShuttleItem[]>(() => {
    const map = new Map<string, ShuttleItem>();
    for (const m of [...moduleOptions, ...(tool?.tags ?? [])]) {
      const id = tagKey(m);
      if (!map.has(id)) map.set(id, { id, label: tagLabel(m) });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [moduleOptions, tool]);
  // Desempate de ambiguidade: prioridade (dentro do grupo) + regras pareadas.
  const [prioridade, setPrioridade] = useState(String(tool?.prioridade ?? 0));
  const [grupoAmbiguidade, setGrupoAmbiguidade] = useState(tool?.grupo_ambiguidade ?? "");
  const [venceDe, setVenceDe] = useState<{ tool_id: string; modo: "empate" | "sempre" }[]>(
    (tool?.vence_de ?? []).map((r) => ({ tool_id: r.tool_id, modo: r.modo })),
  );
  /** Grupos já usados no catálogo — reaproveitar em vez de inventar um rótulo novo. */
  const gruposExistentes = useMemo(
    () => [...new Set(todasTools.map((t) => t.grupo_ambiguidade?.trim()).filter((g): g is string => !!g))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [todasTools],
  );
  /** Candidatas a perder: todas menos a própria, ordenadas por nome. */
  const opcoesVenceDe = useMemo(
    () => todasTools.filter((t) => t.id !== tool?.id).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [todasTools, tool?.id],
  );
  // Avançado.
  const [advOpen, setAdvOpen] = useState(false);
  const [bodyMode, setBodyMode] = useState(tool?.body_mode ?? "");
  const [guard, setGuard] = useState(tool?.guard ?? "");
  const [cacheTtl, setCacheTtl] = useState(tool?.cache_ttl != null ? String(tool.cache_ttl) : "");
  const [cacheScope, setCacheScope] = useState(tool?.cache_scope ?? "user");
  const [loopOn, setLoopOn] = useState(Boolean(tool?.loop));
  const [loopUnit, setLoopUnit] = useState<"month" | "values" | "batch">(tool?.loop?.unit ?? "month");
  const [loopParam, setLoopParam] = useState(tool?.loop?.param ?? "data_ref");
  const [loopFrom, setLoopFrom] = useState(tool?.loop?.from ?? "periodo_ini");
  const [loopTo, setLoopTo] = useState(tool?.loop?.to ?? "periodo_fim");
  const [loopMax, setLoopMax] = useState(tool?.loop?.max != null ? String(tool.loop.max) : "24");
  // Escopo por painel (PO/PG/PC) + "nunca os próprios dados".
  const [panelScope, setPanelScope] = useState<PanelScopeMap>(() => ({
    PO: tool?.panel_scope?.PO ?? "todos",
    PG: tool?.panel_scope?.PG ?? "todos",
    PC: tool?.panel_scope?.PC ?? "todos",
  }));
  const [excludeSelf, setExcludeSelf] = useState(tool?.exclude_self ?? false);
  // Acesso por base (shuttle) + allowlists de portal/perfil por base (#4).
  const [baseIds, setBaseIds] = useState<Set<string>>(new Set(initialBaseIds));
  const [acesso, setAcesso] = useState<Record<string, { portais: string[]; empresas: string[]; perfis: string[] }>>(initialAcesso);
  const setAcessoBase = (id: string, v: { portais: string[]; empresas: string[]; perfis: string[] }) =>
    setAcesso((prev) => ({ ...prev, [id]: v }));

  const externa = endpointKind === "external";

  function updateParam(i: number, patch: Partial<ToolParam>) {
    setParams((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function payload() {
    const cache = cacheTtl.trim() ? Number(cacheTtl.trim()) : null;
    const loop = loopOn
      ? loopUnit === "month"
        ? { unit: "month" as const, param: loopParam.trim(), from: loopFrom.trim(), to: loopTo.trim(), max: loopMax.trim() ? Number(loopMax.trim()) : 24 }
        : loopUnit === "batch"
          ? { unit: "batch" as const, param: loopParam.trim(), max: loopMax.trim() ? Number(loopMax.trim()) : 20 }
          : { unit: "values" as const, param: loopParam.trim(), max: loopMax.trim() ? Number(loopMax.trim()) : 20 }
      : null;
    return {
      ...(tool ? { id: tool.id } : {}),
      key,
      name,
      description,
      descricao_usuario: descricaoUsuario,
      selecionavel_no_chat: selecionavelNoChat,
      method,
      path_template: pathTemplate,
      auth_type: authType,
      response_hint: responseHint,
      search_terms: searchTerms,
      active,
      always_include: alwaysInclude,
      prioridade: Number(prioridade.trim() || 0) || 0,
      grupo_ambiguidade: grupoAmbiguidade.trim() || null,
      vence_de: venceDe,
      modulos: [...tags].map(parseTagKey),
      params,
      endpoint_kind: endpointKind,
      external_url: externa ? externalUrl : null,
      credential_id: externa ? credentialId || null : null,
      system_prompt: systemPrompt,
      body_mode: bodyMode.trim() || null,
      guard: guard.trim() || null,
      cache_ttl: cache && Number.isFinite(cache) ? cache : null,
      cache_scope: cacheScope,
      loop,
      panel_scope: panelScope,
      exclude_self: excludeSelf,
      bases: [...baseIds].map((id) => ({
        id,
        portais: acesso[id]?.portais ?? [],
        empresas: acesso[id]?.empresas ?? [],
        perfis: acesso[id]?.perfis ?? [],
      })),
    };
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={tool ? "Editar API/Tool" : "Nova API/Tool"}
      size="lg"
      resizable
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={pending} onClick={() => onSave(payload())}>
            Salvar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Chave" htmlFor="tool_key" hint="Só minúsculas, números e _.">
            <input id="tool_key" className={controlClass} value={key} onChange={(e) => setKey(e.target.value)} placeholder="consultar_ferias" />
          </Field>
          <Field label="Nome" htmlFor="tool_name">
            <input id="tool_name" className={controlClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Consultar férias" />
          </Field>
        </div>

        {/* Vocabulário: os TRÊS textos que descrevem esta ferramenta ficam juntos,
            porque respondem à mesma pergunta ("o que é isto?") para três leitores
            diferentes — o modelo, o usuário e o buscador semântico. Quem cadastra
            escreve os três numa tacada. Os sinônimos moravam lá embaixo, depois do
            editor de parâmetros — numa tool com muitos params, ninguém achava. */}
        <Field label="Descrição técnica (a IA lê isto para decidir usar)" htmlFor="tool_desc">
          <textarea id="tool_desc" rows={2} className={controlClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Datas de férias de um colaborador num período." />
        </Field>

        {/* O texto acima é do MODELO: técnico, longo, às vezes citando outra
            ferramenta. Quando o chat perguntava "de onde eu busco?", o botão saía
            DELE, cortado em 70 caracteres — medido no catálogo real, 56% terminavam
            em "…" e o que sobrava era instrução de máquina pela metade. Este campo é
            o que a pessoa lê. */}
        <Field
          label="Descrição para o usuário (aparece no chat)"
          htmlFor="tool_desc_user"
          hint="1 ou 2 frases em linguagem do dia a dia, sem jargão nem nome de endpoint. Aparece abaixo do título da ferramenta quando o chat pergunta de onde buscar. Em branco, o botão mostra só o título."
        >
          <textarea
            id="tool_desc_user"
            rows={2}
            maxLength={MAX_DESC_USUARIO}
            className={controlClass}
            value={descricaoUsuario}
            onChange={(e) => setDescricaoUsuario(e.target.value)}
            placeholder="Mostra os períodos de férias já marcados e o saldo de dias de um colaborador."
          />
          <p className={`mt-1 text-xs ${descricaoUsuario.length > 160 ? "text-amber-600 dark:text-amber-400" : "text-text-muted"}`}>
            {descricaoUsuario.length}/{MAX_DESC_USUARIO} caracteres
            {descricaoUsuario.length > 160 && " — acima de 160 o botão passa de 3 linhas no celular"}
          </p>
        </Field>

        {/* Fica colado na descrição do usuário porque os dois respondem à mesma
            pergunta: COMO esta ferramenta aparece para quem usa o chat. */}
        <label className="flex items-start gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={selecionavelNoChat}
            onChange={(e) => setSelecionavelNoChat(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-primary)]"
          />
          <span>
            Oferecer como opção no chat
            <span className="mt-0.5 block text-xs text-text-muted">
              Desmarque para ferramenta de <strong>uso interno do agente</strong> — as que só existem para
              encadear (buscar os tipos ou as competências disponíveis antes da consulta real). Ela some dos
              botões de “de onde eu busco?”, mas <strong>continua disponível para a IA chamar</strong>. Para
              tirar do ar de vez, use Ativa.
            </span>
          </span>
        </label>

        <Field
          label="Sinônimos e exemplos de frases (opcional)"
          htmlFor="tool_search"
          hint="Como o usuário PEDE isto no dia a dia — um por linha (ex.: holerite, 'quanto recebi', 'meu contracheque de março'). Não aparece para o usuário: entra no embedding e é o que faz a IA achar a ferramenta certa."
        >
          <textarea
            id="tool_search"
            className={controlClass}
            rows={4}
            value={searchTerms}
            onChange={(e) => setSearchTerms(e.target.value)}
            placeholder={"holerite\nquanto recebi no mês passado\nmeu contracheque de março"}
          />
        </Field>

        <div className="grid grid-cols-[7rem_1fr_9rem] gap-3">
          <Field label="Método" htmlFor="tool_method">
            <Select id="tool_method" value={method} onChange={(v) => setMethod(v as HttpMethod)}>
              {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Caminho (relativo à URL base)" htmlFor="tool_path" hint="Use {nome} para parâmetros de caminho.">
            <input id="tool_path" className={controlClass} value={pathTemplate} onChange={(e) => setPathTemplate(e.target.value)} placeholder="/ferias/{matricula}" />
          </Field>
          <Field label="Autenticação" htmlFor="tool_auth">
            <Select id="tool_auth" value={authType} onChange={(v) => setAuthType(v as AuthType)}>
              {AUTH_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </Select>
          </Field>
        </div>

        {/* Endpoint: interno (usa a base) × externo (outro serviço) */}
        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">Endpoint</span>
          <div className="flex gap-2">
            <KindButton active={!externa} onClick={() => setEndpointKind("base")} title="Interno — usa a URL base e a credencial da BASE">
              Interno (base)
            </KindButton>
            <KindButton active={externa} onClick={() => setEndpointKind("external")} title="Externo — outro serviço, com URL e credencial próprias">
              <Globe className="size-3.5" /> Externo
            </KindButton>
          </div>
          {externa && (
            <div className="mt-3 flex flex-col gap-3">
              <Field label="URL base do serviço externo" htmlFor="tool_ext_url">
                <input id="tool_ext_url" className={controlClass} value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://api.outroservico.com" />
              </Field>
              <Field label="Credencial (do serviço externo)" htmlFor="tool_ext_cred" hint="Credencial usada por esta tool externa em TODAS as bases.">
                <Select id="tool_ext_cred" value={credentialId} onChange={(v) => setCredentialId(v)}>
                  <option value="">— sem autenticação —</option>
                  {credentialOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.base}</option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </div>

        <Field label="Instrução própria da tool (opcional)" htmlFor="tool_sysprompt" hint="Concatenada ao prompt quando a tool está ativa. Útil p/ ensinar formato/passos de uma API externa.">
          <textarea id="tool_sysprompt" rows={2} className={controlClass} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="Ex.: Ao consultar o CEP, retorne rua, bairro e cidade em uma linha." />
        </Field>

        {/* Parâmetros */}
        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Parâmetros</span>
            <Button size="sm" variant="secondary" onClick={() => setParams((p) => [...p, paramVazio()])}>
              <Plus /> Parâmetro
            </Button>
          </div>
          {params.length === 0 ? (
            <p className="py-1 text-xs text-text-muted">Nenhum parâmetro.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {params.map((p, i) => (
                <ParamEditor
                  key={i}
                  param={p}
                  onChange={(patch) => updateParam(i, patch)}
                  onRemove={() => setParams((prev) => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          )}
        </div>

        <Field label="Dica de resposta (opcional)" htmlFor="tool_resp" hint="Como a IA deve resumir/interpretar o retorno.">
          <input id="tool_resp" className={controlClass} value={responseHint} onChange={(e) => setResponseHint(e.target.value)} />
        </Field>

        {/* Acesso por base (shuttle) */}
        <Field label="Bases onde esta tool fica ativa" htmlFor="tool_bases" hint="Padrão: todas. Só as bases da coluna direita enxergam a tool.">
          <Shuttle items={baseItems} selected={baseIds} onChange={setBaseIds} leftTitle="Sem acesso" rightTitle="Com acesso" />
        </Field>

        {/* Restrição de acesso por portal/perfil, por base (#4) */}
        {baseIds.size > 0 && (
          <Field
            label="Quem pode usar (por base)"
            htmlFor="tool_acesso"
            hint="Vazio = liberado para todos. O operador (PO) ignora a restrição de portal, mas a de perfil sempre vale."
          >
            <div className="flex flex-col gap-2">
              {bases
                .filter((b) => baseIds.has(b.id))
                .map((b) => (
                  <AcessoBase
                    key={b.id}
                    base={b}
                    portais={acesso[b.id]?.portais ?? []}
                    empresas={acesso[b.id]?.empresas ?? []}
                    perfis={acesso[b.id]?.perfis ?? []}
                    onChange={(v) => setAcessoBase(b.id, v)}
                  />
                ))}
            </div>
          </Field>
        )}

        {/* Roteamento por assunto (Opção A) */}
        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Roteamento por assunto</span>
          <p className="mb-2 text-xs text-text-muted">
            Nas bases com roteamento ligado, só as tools do(s) módulo(s) do assunto da pergunta entram no passo —
            economiza tokens. <strong>Sem nenhuma tag = a tool é sempre consultada.</strong>
          </p>
          <label className="mb-2 flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={alwaysInclude} onChange={(e) => setAlwaysInclude(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
            Essencial — entra sempre, mesmo com roteamento ligado
          </label>
          {moduleItems.length === 0 ? (
            <p className="text-xs text-text-muted">
              Nenhum módulo sincronizado ainda. Em <strong>Bases / Clientes</strong>, edite a base e use{" "}
              <strong>Sincronizar módulos</strong> para trazer a taxonomia do cliente.
            </p>
          ) : (
            <Shuttle items={moduleItems} selected={tags} onChange={setTags} leftTitle="Módulos disponíveis" rightTitle="Tags desta tool" />
          )}
        </div>

        {/* Desempate de ambiguidade — mesmo assunto do bloco acima: o que entra no turno */}
        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Desempate (ambiguidade)</span>
          <p className="mb-3 text-xs leading-relaxed text-text-muted">
            Quando duas ferramentas quase iguais chegam juntas ao modelo, quem erra a escolha é ele. Aqui a
            perdedora <strong>sai do turno</strong> — e o corte fica registrado no rastreio.{" "}
            <em>Só vale quando as duas estão disputando o topo da rodada</em>: se nenhuma das duas for a mais
            aderente à pergunta, o desempate se cala e ambas continuam disponíveis.
          </p>

          {/* 1) PAREADO — o mais específico, e o que vence o numérico */}
          <Field
            label="Esta ferramenta vence de"
            hint="Declaração explícita, par a par. Use para as colisões que você já conhece."
          >
            <div className="flex flex-col gap-2">
              {venceDe.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {venceDe.map((r) => {
                    const alvo = opcoesVenceDe.find((t) => t.id === r.tool_id);
                    return (
                      <li key={r.tool_id} className="flex items-center gap-2 rounded border border-border bg-surface px-2 py-1">
                        <span className="min-w-0 flex-1 truncate text-sm text-text" title={alvo?.key}>
                          {alvo?.name ?? "(ferramenta removida)"}
                          <span className="ml-1 text-xs text-text-muted">{alvo?.key}</span>
                        </span>
                        <Select
                          className="rounded border border-border bg-surface px-1 py-0.5 text-xs"
                          aria-label={`Quando aplicar a preferência sobre ${alvo?.name ?? r.tool_id}`}
                          value={r.modo}
                          onChange={(v) =>
                            setVenceDe((prev) =>
                              prev.map((x) => (x.tool_id === r.tool_id ? { ...x, modo: v as "empate" | "sempre" } : x)),
                            )
                          }
                        >
                          <option value="empate">só no empate</option>
                          <option value="sempre">sempre</option>
                        </Select>
                        <button
                          type="button"
                          className="px-1 text-text-muted hover:text-danger"
                          aria-label={`Remover a preferência sobre ${alvo?.name ?? r.tool_id}`}
                          onClick={() => setVenceDe((prev) => prev.filter((x) => x.tool_id !== r.tool_id))}
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Select
                aria-label="Adicionar ferramenta que esta vence"
                value=""
                placeholder="+ adicionar ferramenta…"
                buscaPlaceholder="Digite o nome ou a chave…"
                options={opcoesVenceDe
                  .filter((t) => !venceDe.some((x) => x.tool_id === t.id))
                  .map((t) => ({ value: t.id, label: t.name, hint: t.key }))}
                onChange={(id) => {
                  if (!id) return;
                  setVenceDe((prev) => (prev.some((x) => x.tool_id === id) ? prev : [...prev, { tool_id: id, modo: "empate" }]));
                }}
              />
              <p className="text-xs text-text-muted">
                <strong>só no empate</strong> = corta apenas quando as duas disputam o topo (o caso normal).{" "}
                <strong>sempre</strong> = a outra é redundante e sai toda vez que esta estiver no turno.
              </p>
            </div>
          </Field>

          {/* 2) NUMÉRICO — a rede, para o par que ainda não foi mapeado */}
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-xs text-text-muted">
              Ou, sem declarar par a par: ferramentas do <strong>mesmo grupo</strong> competem por prioridade — a
              de maior número vence o empate. Fora do grupo, o número não tem efeito nenhum.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Grupo de ambiguidade" htmlFor="tool_grupo" hint="Rótulo livre. Vazio = a prioridade não se aplica.">
                <input
                  id="tool_grupo"
                  className={controlClass}
                  list="grupos_ambiguidade"
                  value={grupoAmbiguidade}
                  onChange={(e) => setGrupoAmbiguidade(e.target.value)}
                  placeholder="ex.: historico_financeiro"
                />
                <datalist id="grupos_ambiguidade">
                  {gruposExistentes.map((g) => <option key={g} value={g} />)}
                </datalist>
              </Field>
              <Field label="Prioridade no grupo" htmlFor="tool_prioridade" hint="Maior vence. 0 = neutro.">
                <input
                  id="tool_prioridade"
                  type="number"
                  min={-99}
                  max={99}
                  className={controlClass}
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Escopo por painel (PO/PG/PC) — controle de acesso a dados de pessoas */}
        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Escopo por painel (PO/PG/PC)</span>
          <p className="mb-2 text-xs leading-relaxed text-text-muted">
            Alcance da consulta de <strong>empresa/matrícula</strong> por painel. <em>Próprios</em> força os dados do
            próprio usuário (a IA nem vê o campo); <em>Equipe</em> valida a matrícula na equipe do gestor; <em>Todos</em>{" "}
            respeita o acesso já parametrizado no sistema; <em>—</em> bloqueia a ferramenta para o painel.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["PO", "PG", "PC"] as const).map((p) => (
              <Field key={p} label={`${p} · ${PORTAL_LABEL[p]}`} htmlFor={`scope_${p}`}>
                <Select
                  id={`scope_${p}`}
                 
                  value={panelScope[p] ?? "todos"}
                  onChange={(v) => setPanelScope((s) => ({ ...s, [p]: v as EscopoPainel }))}
                >
                  {ESCOPO_OPCOES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </Select>
              </Field>
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={excludeSelf} onChange={(e) => setExcludeSelf(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
            Nunca os próprios dados (ex.: requisição de desligamento — o usuário não pode se ver)
          </label>
        </div>

        {/* Avançado */}
        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <button type="button" onClick={() => setAdvOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Avançado</span>
            <span className="text-xs text-text-muted">{advOpen ? "ocultar" : "mostrar"}</span>
          </button>
          {advOpen && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Envelope do corpo (body_mode)" htmlFor="tool_bodymode" hint="vazio/object · array · wrap:chave">
                  <input id="tool_bodymode" className={controlClass} value={bodyMode} onChange={(e) => setBodyMode(e.target.value)} placeholder="ex.: wrap:saque" />
                </Field>
                <Field label="Guard (servidor)" htmlFor="tool_guard" hint="Checagem no servidor antes de chamar a API.">
                  <Select id="tool_guard" value={guard} onChange={(v) => setGuard(v)}>
                    <option value="">(nenhum)</option>
                    {GUARD_CATALOG.map((g) => (
                      <option key={g.key} value={g.key}>{g.label}</option>
                    ))}
                    {guard && !guardInfo(guard) && <option value={guard}>{guard} (desconhecido)</option>}
                  </Select>
                  {guardInfo(guard) && (
                    <p className="mt-1 text-xs leading-snug text-text-muted">{guardInfo(guard)!.description}</p>
                  )}
                  {guard && !guardInfo(guard) && (
                    <p className="mt-1 text-xs leading-snug text-amber-600 dark:text-amber-500">
                      Guard desconhecido — a ferramenta fica bloqueada até corrigir.
                    </p>
                  )}
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cache (segundos)" htmlFor="tool_cache" hint="Dados quase-estáticos. Vazio = sem cache.">
                  <input id="tool_cache" type="number" min={0} className={controlClass} value={cacheTtl} onChange={(e) => setCacheTtl(e.target.value)} placeholder="ex.: 3600" />
                </Field>
                <Field label="Escopo do cache" htmlFor="tool_cache_scope" hint="empresa/global compartilham entre usuários — só se a saída NÃO depender do usuário.">
                  <Select id="tool_cache_scope" value={cacheScope} onChange={(v) => setCacheScope(v)}>
                    <option value="user">Por usuário (padrão)</option>
                    <option value="empresa">Por empresa (compartilha)</option>
                    <option value="global">Global (todos)</option>
                  </Select>
                </Field>
              </div>
              <div className="rounded-lg border border-border bg-surface p-3">
                <label className="flex items-center gap-2 text-sm text-text">
                  <input type="checkbox" checked={loopOn} onChange={(e) => setLoopOn(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
                  Loop — a API aceita 1 valor por chamada; o servidor itera e agrega quando o usuário pede vários
                </label>
                {loopOn && (
                  <div className="mt-2 flex flex-col gap-2">
                    <Field label="Modo do loop" htmlFor="loop_unit">
                      <Select id="loop_unit" value={loopUnit} onChange={(v) => setLoopUnit(v as "month" | "values" | "batch")}>
                        <option value="month">Período (mês a mês) — modelo informa início/fim</option>
                        <option value="values">Lista de valores — 1 chamada por valor (guard por valor)</option>
                        <option value="batch">Lote (batch) — API aceita lista por vírgula; fatia em lotes</option>
                      </Select>
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label={loopUnit === "month" ? "Param. mensal (API)" : "Param. a repetir (API)"} htmlFor="loop_param" hint={loopUnit === "values" ? "Ex.: matricula — vira uma LISTA para o modelo." : loopUnit === "batch" ? "Ex.: p_matricula — a API recebe a lista por vírgula, em lotes." : undefined}>
                        <input id="loop_param" className={controlClass} value={loopParam} onChange={(e) => setLoopParam(e.target.value)} placeholder={loopUnit === "month" ? "data_ref" : "matricula"} />
                      </Field>
                      <Field label={loopUnit === "month" ? "Máx. de meses" : loopUnit === "batch" ? "Itens por lote" : "Máx. de valores"} htmlFor="loop_max">
                        <input id="loop_max" type="number" min={1} className={controlClass} value={loopMax} onChange={(e) => setLoopMax(e.target.value)} />
                      </Field>
                      {loopUnit === "month" && (
                        <>
                          <Field label="Início (modelo)" htmlFor="loop_from">
                            <input id="loop_from" className={controlClass} value={loopFrom} onChange={(e) => setLoopFrom(e.target.value)} placeholder="periodo_ini" />
                          </Field>
                          <Field label="Fim (modelo)" htmlFor="loop_to">
                            <input id="loop_to" className={controlClass} value={loopTo} onChange={(e) => setLoopTo(e.target.value)} placeholder="periodo_fim" />
                          </Field>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
          Ativa (no catálogo)
        </label>
      </div>
    </Dialog>
  );
}

function KindButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)]/10 px-3 py-1.5 text-sm font-medium text-[var(--color-primary)]"
          : "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-muted hover:text-text"
      }
    >
      {children}
    </button>
  );
}

// ──────────────────────────── Editor de 1 parâmetro ─────────────────────────
function ParamEditor({
  param,
  onChange,
  onRemove,
}: {
  param: ToolParam;
  onChange: (patch: Partial<ToolParam>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2.5">
      <div className="grid grid-cols-[1fr_8rem_auto] gap-2">
        <input
          className={controlClass}
          value={param.nome}
          onChange={(e) => onChange({ nome: e.target.value })}
          placeholder="nome do parâmetro"
          aria-label="Nome do parâmetro"
        />
        <Select value={param.tipo} onChange={(v) => onChange({ tipo: v as ToolParam["tipo"] })} aria-label="Tipo">
          {PARAM_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Button size="icon" variant="danger" onClick={onRemove} title="Remover parâmetro">
          <Trash2 />
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Select value={param.origem} onChange={(v) => onChange({ origem: v as ToolParam["origem"] })} aria-label="Origem">
          {PARAM_ORIGENS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select value={param.local} onChange={(v) => onChange({ local: v as ToolParam["local"] })} aria-label="Local">
          {PARAM_LOCAIS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </Select>
      </div>

      {/* Campos condicionais por origem/tipo */}
      <div className="mt-2 flex flex-col gap-2">
        {param.origem === "identidade" && (
          <Select
           
            value={param.campoIdentidade ?? ""}
            onChange={(v) => onChange({ campoIdentidade: (v || null) as ToolParam["campoIdentidade"] })}
            aria-label="Campo de identidade"
          >
            <option value="">— campo do token —</option>
            {IDENTITY_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </Select>
        )}
        {param.origem === "fixo" && (
          <input className={controlClass} value={param.valorFixo ?? ""} onChange={(e) => onChange({ valorFixo: e.target.value })} placeholder="valor fixo" aria-label="Valor fixo" />
        )}
        {param.origem === "modelo" && (
          <input className={controlClass} value={param.descricao} onChange={(e) => onChange({ descricao: e.target.value })} placeholder="descrição p/ a IA" aria-label="Descrição" />
        )}
        {param.tipo === "date" && (
          <input className={controlClass} value={param.mascara ?? ""} onChange={(e) => onChange({ mascara: e.target.value })} placeholder="máscara da data (ex.: dd/MM/yyyy)" aria-label="Máscara" />
        )}
        {param.tipo === "enum" && (
          <input
            className={controlClass}
            value={(param.opcoes ?? []).join(", ")}
            onChange={(e) => onChange({ opcoes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            placeholder="opções separadas por vírgula"
            aria-label="Opções"
          />
        )}
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <input type="checkbox" checked={param.obrigatorio} onChange={(e) => onChange({ obrigatorio: e.target.checked })} className="size-3.5 accent-[var(--color-primary)]" />
          Obrigatório
        </label>
      </div>
    </div>
  );
}

// ── Editor de acesso (portais + empresas + perfis) de UMA tool em UMA base (#4) ──
function AcessoBase({
  base,
  portais,
  empresas,
  perfis,
  onChange,
}: {
  base: BaseRow;
  portais: string[];
  empresas: string[];
  perfis: string[];
  onChange: (v: { portais: string[]; empresas: string[]; perfis: string[] }) => void;
}) {
  const toast = useToast();
  const [novo, setNovo] = useState("");
  const [novaEmpresa, setNovaEmpresa] = useState("");
  const [sugestoes, setSugestoes] = useState<string[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const togglePortal = (code: string) =>
    onChange({ portais: portais.includes(code) ? portais.filter((p) => p !== code) : [...portais, code], empresas, perfis });
  const addPerfil = (p: string) => {
    const v = p.trim();
    if (v && !perfis.some((x) => x.toLowerCase() === v.toLowerCase())) onChange({ portais, empresas, perfis: [...perfis, v] });
    setNovo("");
  };
  const removePerfil = (p: string) => onChange({ portais, empresas, perfis: perfis.filter((x) => x !== p) });
  const addEmpresa = (e: string) => {
    const v = e.trim();
    if (v && !empresas.some((x) => x.toLowerCase() === v.toLowerCase())) onChange({ portais, empresas: [...empresas, v], perfis });
    setNovaEmpresa("");
  };
  const removeEmpresa = (e: string) => onChange({ portais, empresas: empresas.filter((x) => x !== e), perfis });

  async function buscar() {
    setBuscando(true);
    const r = await listarPerfisDaBase(base.id);
    setBuscando(false);
    if (!r.ok) return toast.error(r.error ?? "Falha ao buscar perfis.");
    setSugestoes(r.perfis ?? []);
    if (!r.perfis?.length) {
      toast.info(base.perfis_endpoint ? "A API não retornou perfis." : "Configure a API de perfis nesta base (editar base).");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <div className="mb-2 text-sm font-medium text-text">{base.name}</div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-xs text-text-muted">Portais:</span>
        {PORTAIS.map((p) => (
          <label key={p.code} className="inline-flex items-center gap-1.5 text-sm text-text">
            <input
              type="checkbox"
              checked={portais.includes(p.code)}
              onChange={() => togglePortal(p.code)}
              className="size-4 accent-[var(--color-primary)]"
            />
            {p.code} <span className="text-text-muted">({p.label})</span>
          </label>
        ))}
      </div>
      <div className="mb-2">
        <div className="mb-1 text-xs text-text-muted">Empresas (cod_empresa) — vazio = todas:</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {empresas.map((e) => (
            <span key={e} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {e}
              <button type="button" onClick={() => removeEmpresa(e)} aria-label={`Remover empresa ${e}`} className="text-primary/70 hover:text-primary">
                ×
              </button>
            </span>
          ))}
          <input
            className="min-w-[140px] flex-1 rounded border border-border bg-surface px-2 py-1 text-xs"
            value={novaEmpresa}
            onChange={(e) => setNovaEmpresa(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addEmpresa(novaEmpresa);
              }
            }}
            placeholder="código da empresa e Enter (ex.: 1001)"
          />
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs text-text-muted">Perfis:</span>
          <Button size="sm" variant="ghost" onClick={buscar} disabled={buscando}>
            {buscando ? "Buscando…" : "Buscar da API"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {perfis.map((p) => (
            <span key={p} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {p}
              <button type="button" onClick={() => removePerfil(p)} aria-label={`Remover ${p}`} className="text-primary/70 hover:text-primary">
                ×
              </button>
            </span>
          ))}
          <input
            className="min-w-[140px] flex-1 rounded border border-border bg-surface px-2 py-1 text-xs"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addPerfil(novo);
              }
            }}
            placeholder="digite um perfil e Enter (ex.: MASTER)"
          />
        </div>
        {sugestoes && sugestoes.filter((s) => !perfis.some((p) => p.toLowerCase() === s.toLowerCase())).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {sugestoes
              .filter((s) => !perfis.some((p) => p.toLowerCase() === s.toLowerCase()))
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addPerfil(s)}
                  className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted hover:text-text"
                >
                  + {s}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type BaseToolRow = {
  base_id: string;
  tool_id: string;
  enabled: boolean;
  base_url: string | null;
  credential_id: string | null;
  /** Allowlist de acesso (#4): portais/empresas/perfis liberados. Vazio = liberado. */
  portais: string[];
  empresas: string[];
  perfis: string[];
};
