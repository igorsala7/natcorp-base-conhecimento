"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Braces, Globe, Pencil, Plus, Trash2, Webhook } from "lucide-react";
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
import { saveTool, deleteTool, listarPerfisDaBase } from "./tool-actions";
import { PORTAIS } from "@/lib/integrations/gating";
import type { IntegResult } from "./actions";
import type { BaseRow } from "./integrations-manager";

export type EndpointKind = "base" | "external";
export type ToolRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  method: HttpMethod;
  path_template: string;
  auth_type: AuthType;
  params: ToolParam[];
  response_hint: string | null;
  active: boolean;
  endpoint_kind: EndpointKind;
  external_url: string | null;
  credential_id: string | null;
  system_prompt: string;
  body_mode: string | null;
  guard: string | null;
  cache_ttl: number | null;
  loop: LoopConfig | null;
};

type CredentialOption = { id: string; name: string; base: string };

const AUTH_LABEL = Object.fromEntries(AUTH_TYPES.map((a) => [a.value, a.label])) as Record<AuthType, string>;

export function ToolsManager({
  tools,
  bases,
  baseTools,
}: {
  tools: ToolRow[];
  bases: BaseRow[];
  baseTools: BaseToolRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<{
    tool?: ToolRow;
    baseIds: string[];
    acesso: Record<string, { portais: string[]; perfis: string[] }>;
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
    const m = new Map<string, Record<string, { portais: string[]; perfis: string[] }>>();
    for (const bt of baseTools) {
      if (!bt.enabled) continue;
      const rec = m.get(bt.tool_id) ?? {};
      rec[bt.base_id] = { portais: bt.portais ?? [], perfis: bt.perfis ?? [] };
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

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Catálogo de APIs / Tools</h2>
        <Button size="sm" onClick={() => abrir()}>
          <Plus /> Nova API/Tool
        </Button>
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
          credentialOptions={credentialOptions}
          pending={pending}
          onClose={() => setDialog(null)}
          onSave={(payload) => run(() => saveTool(payload), "Tool salva.", () => setDialog(null))}
        />
      )}
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
  credentialOptions,
  pending,
  onClose,
  onSave,
}: {
  tool?: ToolRow;
  initialBaseIds: string[];
  initialAcesso: Record<string, { portais: string[]; perfis: string[] }>;
  baseItems: ShuttleItem[];
  bases: BaseRow[];
  credentialOptions: CredentialOption[];
  pending: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [key, setKey] = useState(tool?.key ?? "");
  const [name, setName] = useState(tool?.name ?? "");
  const [description, setDescription] = useState(tool?.description ?? "");
  const [method, setMethod] = useState<HttpMethod>(tool?.method ?? "GET");
  const [pathTemplate, setPathTemplate] = useState(tool?.path_template ?? "");
  const [authType, setAuthType] = useState<AuthType>(tool?.auth_type ?? "oauth2");
  const [responseHint, setResponseHint] = useState(tool?.response_hint ?? "");
  const [active, setActive] = useState(tool?.active ?? true);
  const [params, setParams] = useState<ToolParam[]>(tool?.params ?? []);
  // Endpoint (interno × externo) + prompt próprio.
  const [endpointKind, setEndpointKind] = useState<EndpointKind>(tool?.endpoint_kind ?? "base");
  const [externalUrl, setExternalUrl] = useState(tool?.external_url ?? "");
  const [credentialId, setCredentialId] = useState(tool?.credential_id ?? "");
  const [systemPrompt, setSystemPrompt] = useState(tool?.system_prompt ?? "");
  // Avançado.
  const [advOpen, setAdvOpen] = useState(false);
  const [bodyMode, setBodyMode] = useState(tool?.body_mode ?? "");
  const [guard, setGuard] = useState(tool?.guard ?? "");
  const [cacheTtl, setCacheTtl] = useState(tool?.cache_ttl != null ? String(tool.cache_ttl) : "");
  const [loopOn, setLoopOn] = useState(Boolean(tool?.loop));
  const [loopUnit, setLoopUnit] = useState<"month" | "values">(tool?.loop?.unit ?? "month");
  const [loopParam, setLoopParam] = useState(tool?.loop?.param ?? "data_ref");
  const [loopFrom, setLoopFrom] = useState(tool?.loop?.from ?? "periodo_ini");
  const [loopTo, setLoopTo] = useState(tool?.loop?.to ?? "periodo_fim");
  const [loopMax, setLoopMax] = useState(tool?.loop?.max != null ? String(tool.loop.max) : "24");
  // Acesso por base (shuttle) + allowlists de portal/perfil por base (#4).
  const [baseIds, setBaseIds] = useState<Set<string>>(new Set(initialBaseIds));
  const [acesso, setAcesso] = useState<Record<string, { portais: string[]; perfis: string[] }>>(initialAcesso);
  const setAcessoBase = (id: string, v: { portais: string[]; perfis: string[] }) =>
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
        : { unit: "values" as const, param: loopParam.trim(), max: loopMax.trim() ? Number(loopMax.trim()) : 20 }
      : null;
    return {
      ...(tool ? { id: tool.id } : {}),
      key,
      name,
      description,
      method,
      path_template: pathTemplate,
      auth_type: authType,
      response_hint: responseHint,
      active,
      params,
      endpoint_kind: endpointKind,
      external_url: externa ? externalUrl : null,
      credential_id: externa ? credentialId || null : null,
      system_prompt: systemPrompt,
      body_mode: bodyMode.trim() || null,
      guard: guard.trim() || null,
      cache_ttl: cache && Number.isFinite(cache) ? cache : null,
      loop,
      bases: [...baseIds].map((id) => ({
        id,
        portais: acesso[id]?.portais ?? [],
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

        <Field label="Descrição (a IA lê isto para decidir usar)" htmlFor="tool_desc">
          <textarea id="tool_desc" rows={2} className={controlClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Datas de férias de um colaborador num período." />
        </Field>

        <div className="grid grid-cols-[7rem_1fr_9rem] gap-3">
          <Field label="Método" htmlFor="tool_method">
            <select id="tool_method" className={controlClass} value={method} onChange={(e) => setMethod(e.target.value as HttpMethod)}>
              {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Caminho (relativo à URL base)" htmlFor="tool_path" hint="Use {nome} para parâmetros de caminho.">
            <input id="tool_path" className={controlClass} value={pathTemplate} onChange={(e) => setPathTemplate(e.target.value)} placeholder="/ferias/{matricula}" />
          </Field>
          <Field label="Autenticação" htmlFor="tool_auth">
            <select id="tool_auth" className={controlClass} value={authType} onChange={(e) => setAuthType(e.target.value as AuthType)}>
              {AUTH_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
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
                <select id="tool_ext_cred" className={controlClass} value={credentialId} onChange={(e) => setCredentialId(e.target.value)}>
                  <option value="">— sem autenticação —</option>
                  {credentialOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.base}</option>
                  ))}
                </select>
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
                    perfis={acesso[b.id]?.perfis ?? []}
                    onChange={(v) => setAcessoBase(b.id, v)}
                  />
                ))}
            </div>
          </Field>
        )}

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
                <Field label="Guard (servidor)" htmlFor="tool_guard" hint="ex.: team_membership · saque_confirmation">
                  <input id="tool_guard" className={controlClass} value={guard} onChange={(e) => setGuard(e.target.value)} placeholder="(nenhum)" />
                </Field>
              </div>
              <Field label="Cache (segundos)" htmlFor="tool_cache" hint="Dados quase-estáticos (estrutura, cadastro). Vazio = sem cache.">
                <input id="tool_cache" type="number" min={0} className={controlClass} value={cacheTtl} onChange={(e) => setCacheTtl(e.target.value)} placeholder="ex.: 1800" />
              </Field>
              <div className="rounded-lg border border-border bg-surface p-3">
                <label className="flex items-center gap-2 text-sm text-text">
                  <input type="checkbox" checked={loopOn} onChange={(e) => setLoopOn(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
                  Loop — a API aceita 1 valor por chamada; o servidor itera e agrega quando o usuário pede vários
                </label>
                {loopOn && (
                  <div className="mt-2 flex flex-col gap-2">
                    <Field label="Modo do loop" htmlFor="loop_unit">
                      <select id="loop_unit" className={controlClass} value={loopUnit} onChange={(e) => setLoopUnit(e.target.value as "month" | "values")}>
                        <option value="month">Período (mês a mês) — modelo informa início/fim</option>
                        <option value="values">Lista de valores — modelo passa vários no mesmo parâmetro</option>
                      </select>
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label={loopUnit === "month" ? "Param. mensal (API)" : "Param. a repetir (API)"} htmlFor="loop_param" hint={loopUnit === "values" ? "Ex.: matricula — vira uma LISTA para o modelo." : undefined}>
                        <input id="loop_param" className={controlClass} value={loopParam} onChange={(e) => setLoopParam(e.target.value)} placeholder={loopUnit === "month" ? "data_ref" : "matricula"} />
                      </Field>
                      <Field label={loopUnit === "month" ? "Máx. de meses" : "Máx. de valores"} htmlFor="loop_max">
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
        <select className={controlClass} value={param.tipo} onChange={(e) => onChange({ tipo: e.target.value as ToolParam["tipo"] })} aria-label="Tipo">
          {PARAM_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <Button size="icon" variant="danger" onClick={onRemove} title="Remover parâmetro">
          <Trash2 />
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <select className={controlClass} value={param.origem} onChange={(e) => onChange({ origem: e.target.value as ToolParam["origem"] })} aria-label="Origem">
          {PARAM_ORIGENS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className={controlClass} value={param.local} onChange={(e) => onChange({ local: e.target.value as ToolParam["local"] })} aria-label="Local">
          {PARAM_LOCAIS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>

      {/* Campos condicionais por origem/tipo */}
      <div className="mt-2 flex flex-col gap-2">
        {param.origem === "identidade" && (
          <select
            className={controlClass}
            value={param.campoIdentidade ?? ""}
            onChange={(e) => onChange({ campoIdentidade: (e.target.value || null) as ToolParam["campoIdentidade"] })}
            aria-label="Campo de identidade"
          >
            <option value="">— campo do token —</option>
            {IDENTITY_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
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

// ─────── Editor de acesso (portais + perfis) de UMA tool em UMA base (#4) ─────
function AcessoBase({
  base,
  portais,
  perfis,
  onChange,
}: {
  base: BaseRow;
  portais: string[];
  perfis: string[];
  onChange: (v: { portais: string[]; perfis: string[] }) => void;
}) {
  const toast = useToast();
  const [novo, setNovo] = useState("");
  const [sugestoes, setSugestoes] = useState<string[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const togglePortal = (code: string) =>
    onChange({ portais: portais.includes(code) ? portais.filter((p) => p !== code) : [...portais, code], perfis });
  const addPerfil = (p: string) => {
    const v = p.trim();
    if (v && !perfis.some((x) => x.toLowerCase() === v.toLowerCase())) onChange({ portais, perfis: [...perfis, v] });
    setNovo("");
  };
  const removePerfil = (p: string) => onChange({ portais, perfis: perfis.filter((x) => x !== p) });

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
  /** Allowlist de acesso (#4): portais/perfis liberados. Vazio = liberado. */
  portais: string[];
  perfis: string[];
};
