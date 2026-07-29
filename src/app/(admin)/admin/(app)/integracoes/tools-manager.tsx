"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Braces, Pencil, Plus, Trash2, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { controlClass } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
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
  type ToolParam,
} from "@/lib/integrations/tools";
import { saveTool, deleteTool } from "./tool-actions";
import type { IntegResult } from "./actions";

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
};

const AUTH_LABEL = Object.fromEntries(AUTH_TYPES.map((a) => [a.value, a.label])) as Record<AuthType, string>;

export function ToolsManager({ tools }: { tools: ToolRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<{ tool?: ToolRow } | null>(null);

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
        <Button size="sm" onClick={() => setDialog({})}>
          <Plus /> Nova API/Tool
        </Button>
      </div>
      <p className="mb-3 text-xs text-text-muted">
        O catálogo é global. Os endpoints (base_url) e as credenciais são por base (aba Bases).
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
              <Button size="sm" variant="ghost" onClick={() => setDialog({ tool: t })} title="Editar">
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
          pending={pending}
          onClose={() => setDialog(null)}
          onSave={(payload) => run(() => saveTool(payload), "Tool salva.", () => setDialog(null))}
        />
      )}
    </div>
  );
}

// ──────────────────────────── Diálogo: Tool ─────────────────────────────────
function ToolDialog({
  tool,
  pending,
  onClose,
  onSave,
}: {
  tool?: ToolRow;
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

  function updateParam(i: number, patch: Partial<ToolParam>) {
    setParams((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
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
          <Button
            disabled={pending}
            onClick={() =>
              onSave({
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
          <Field label="Caminho (relativo à base_url)" htmlFor="tool_path" hint="Use {nome} para parâmetros de caminho.">
            <input id="tool_path" className={controlClass} value={pathTemplate} onChange={(e) => setPathTemplate(e.target.value)} placeholder="/ferias/{matricula}" />
          </Field>
          <Field label="Autenticação" htmlFor="tool_auth">
            <select id="tool_auth" className={controlClass} value={authType} onChange={(e) => setAuthType(e.target.value as AuthType)}>
              {AUTH_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>
        </div>

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

        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
          Ativa
        </label>
      </div>
    </Dialog>
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

export type BaseToolRow = {
  base_id: string;
  tool_id: string;
  enabled: boolean;
  base_url: string | null;
  credential_id: string | null;
};
