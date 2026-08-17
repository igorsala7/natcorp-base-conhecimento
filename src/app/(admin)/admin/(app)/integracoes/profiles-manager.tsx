"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCog, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { controlClass } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { saveProfile, deleteProfile } from "./profile-actions";
import type { IntegResult } from "./actions";
import type { ModuleTag } from "./tools-manager";
import { Select } from "@/components/ui/select";

export type ProfileRow = {
  id: string;
  base_code: string;
  titulo: string;
  nome: string | null;
  descricao: string | null;
  cargo: string | null;
  comportamento: string | null;
  acoes: string[];
  prompt_refino: string;
  requires_perfil: string | null;
  priority: number;
  active: boolean;
  modulos: ModuleTag[];
};
export type BaseOption = { base_code: string; name: string };

const ACOES: { id: string; label: string }[] = [
  { id: "sugestoes", label: "Sugestões" },
  { id: "pontos_atencao", label: "Pontos de atenção" },
  { id: "alertas", label: "Alertas" },
  { id: "estrategias", label: "Estratégias" },
  { id: "diagnostico", label: "Diagnóstico" },
];

const tagKey = (m: ModuleTag): string => JSON.stringify([m.modulo, m.submodulo]);
const parseTagKey = (k: string): ModuleTag => {
  const [modulo, submodulo] = JSON.parse(k) as [string, string | null];
  return { modulo, submodulo: submodulo ?? null };
};
const tagLabel = (m: ModuleTag): string => (m.submodulo ? `${m.modulo} › ${m.submodulo}` : m.modulo);
const normaliza = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ProfilesManager({
  profiles,
  bases,
  moduleOptions,
}: {
  profiles: ProfileRow[];
  bases: BaseOption[];
  moduleOptions: ModuleTag[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<{ profile?: ProfileRow } | null>(null);

  function run(fn: () => Promise<IntegResult>, okMsg?: string, onOk?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return toast.error(r.error);
      if (okMsg) toast.success(okMsg);
      onOk?.();
      router.refresh();
    });
  }

  async function excluir(p: ProfileRow) {
    if (
      await confirmar({
        title: "Excluir perfil",
        description: `Excluir "${p.titulo}"?`,
        tone: "danger",
        confirmLabel: "Excluir",
      })
    )
      run(() => deleteProfile(p.id), "Perfil excluído.");
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Perfis de Análise</h2>
        <Button size="sm" onClick={() => setDialog({})}>
          <Plus /> Novo perfil
        </Button>
      </div>
      <p className="mb-3 text-xs text-text-muted">
        Persona usada para ANALISAR um relatório da tela (Classic/IR/IG), escolhida pelo MÓDULO do
        relatório. Não precisa de tools — a análise sai do próprio relatório + documentação. Ex.: módulo
        &quot;Segurança do Trabalho&quot; → engenheiro do trabalho com sugestões, alertas e estratégias.
      </p>

      {profiles.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Nenhum perfil de análise"
          description="Crie um perfil (título, cargo, comportamento) e vincule os módulos que ele atende."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
              <UserCog className="size-4 shrink-0 text-text-muted" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-text">{p.titulo}</span>
                  <Badge tone="neutral">{p.base_code}</Badge>
                  {p.cargo && <span className="truncate text-xs text-text-muted">{p.cargo}</span>}
                  {p.requires_perfil && <Badge tone="info">perfil: {p.requires_perfil}</Badge>}
                  {!p.active && <Badge tone="warning">Inativo</Badge>}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {p.modulos.length === 0 ? (
                    <span className="text-xs text-warning">sem módulo vinculado (não será acionado)</span>
                  ) : (
                    p.modulos.map((m) => (
                      <span key={tagKey(m)} className="rounded bg-surface-2 px-1.5 py-0.5 text-2xs text-text-muted">
                        {tagLabel(m)}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setDialog({ profile: p })} title="Editar">
                <Pencil />
              </Button>
              <Button size="icon" variant="danger" onClick={() => excluir(p)} title="Excluir">
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {dialog && (
        <ProfileDialog
          profile={dialog.profile}
          bases={bases}
          moduleOptions={moduleOptions}
          pending={pending}
          onClose={() => setDialog(null)}
          onSave={(payload) => run(() => saveProfile(payload), "Perfil salvo.", () => setDialog(null))}
        />
      )}
    </div>
  );
}

// ──────────────────────────── Diálogo: Perfil ───────────────────────────────
function ProfileDialog({
  profile,
  bases,
  moduleOptions,
  pending,
  onClose,
  onSave,
}: {
  profile?: ProfileRow;
  bases: BaseOption[];
  moduleOptions: ModuleTag[];
  pending: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [baseCode, setBaseCode] = useState(profile?.base_code ?? bases[0]?.base_code ?? "");
  const [titulo, setTitulo] = useState(profile?.titulo ?? "");
  const [nome, setNome] = useState(profile?.nome ?? "");
  const [cargo, setCargo] = useState(profile?.cargo ?? "");
  const [descricao, setDescricao] = useState(profile?.descricao ?? "");
  const [comportamento, setComportamento] = useState(profile?.comportamento ?? "");
  const [acoes, setAcoes] = useState<Set<string>>(new Set(profile?.acoes ?? []));
  const [promptRefino, setPromptRefino] = useState(profile?.prompt_refino ?? "");
  const [requiresPerfil, setRequiresPerfil] = useState(profile?.requires_perfil ?? "");
  const [priority, setPriority] = useState(profile?.priority ?? 0);
  const [active, setActive] = useState(profile?.active ?? true);
  const [modulos, setModulos] = useState<Set<string>>(new Set((profile?.modulos ?? []).map(tagKey)));
  const [filtroMod, setFiltroMod] = useState("");

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setter(n);
  }

  // Ordena por rótulo e filtra pelo texto de busca (sem acento/maiúsculas).
  const modulosFiltrados = useMemo(() => {
    const ordenados = [...moduleOptions].sort((a, b) => tagLabel(a).localeCompare(tagLabel(b), "pt-BR"));
    const q = normaliza(filtroMod.trim());
    return q ? ordenados.filter((m) => normaliza(tagLabel(m)).includes(q)) : ordenados;
  }, [moduleOptions, filtroMod]);

  return (
    <Dialog
      open
      onClose={onClose}
      title={profile ? "Editar perfil de análise" : "Novo perfil de análise"}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={pending}
            onClick={() =>
              onSave({
                ...(profile ? { id: profile.id } : {}),
                base_code: baseCode,
                titulo,
                nome,
                cargo,
                descricao,
                comportamento,
                acoes: [...acoes],
                prompt_refino: promptRefino,
                requires_perfil: requiresPerfil,
                priority: Number(priority) || 0,
                active,
                modulos: [...modulos].map(parseTagKey),
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
          <Field label="Base do cliente" htmlFor="pf_base" hint="O p_base do token.">
            <Select id="pf_base" value={baseCode} onChange={(v) => setBaseCode(v)}>
              {bases.length === 0 && <option value="">— nenhuma base —</option>}
              {bases.map((b) => (
                <option key={b.base_code} value={b.base_code}>{b.name} ({b.base_code})</option>
              ))}
            </Select>
          </Field>
          <Field label="Título" htmlFor="pf_titulo" hint="Identifica o perfil na lista.">
            <input id="pf_titulo" className={controlClass} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Analista de SESMT" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome (persona)" htmlFor="pf_nome" hint="Como a IA se apresenta. Opcional.">
            <input id="pf_nome" className={controlClass} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nati" />
          </Field>
          <Field label="Cargo" htmlFor="pf_cargo" hint="Ex.: Engenheira de Segurança do Trabalho.">
            <input id="pf_cargo" className={controlClass} value={cargo} onChange={(e) => setCargo(e.target.value)} />
          </Field>
        </div>

        <Field label="Descrição (o que este perfil faz)" htmlFor="pf_desc">
          <textarea id="pf_desc" rows={2} className={controlClass} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Especialista em engenharia do trabalho voltada a RH e Departamento Pessoal." />
        </Field>

        <Field label="Comportamento (opcional)" htmlFor="pf_comp" hint="Se preenchido, substitui o texto gerado pelas ações abaixo.">
          <textarea id="pf_comp" rows={2} className={controlClass} value={comportamento} onChange={(e) => setComportamento(e.target.value)} placeholder="Ao analisar os dados do relatório, dê um parecer técnico curto e objetivo." />
        </Field>

        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Tipos de ação na análise</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {ACOES.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm text-text">
                <input type="checkbox" checked={acoes.has(a.id)} onChange={() => toggle(acoes, setAcoes, a.id)} className="size-4 accent-[var(--color-primary)]" />
                {a.label}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Módulos que este perfil atende
            {modulos.size > 0 && (
              <span className="ml-1 normal-case text-primary">· {modulos.size} selecionado{modulos.size > 1 ? "s" : ""}</span>
            )}
          </p>

          {/* Selecionados: chips removíveis, sempre visíveis (mesmo ao filtrar). */}
          {modulos.size > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {[...modulos].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggle(modulos, setModulos, k)}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20"
                  title="Remover"
                >
                  <span className="truncate">{tagLabel(parseTagKey(k))}</span>
                  <X className="size-3.5 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {moduleOptions.length === 0 ? (
            <p className="text-xs text-text-muted">Nenhum módulo sincronizado ainda (sincronize a base na aba APIs).</p>
          ) : (
            <>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
                <input
                  className={cn(controlClass, "pl-8")}
                  placeholder="Filtrar módulos…"
                  value={filtroMod}
                  onChange={(e) => setFiltroMod(e.target.value)}
                />
              </div>
              {modulosFiltrados.length === 0 ? (
                <p className="px-1 py-2 text-xs text-text-muted">Nenhum módulo para “{filtroMod}”.</p>
              ) : (
                <div className="flex max-h-56 flex-col gap-0.5 overflow-auto">
                  {modulosFiltrados.map((m) => {
                    const k = tagKey(m);
                    const checked = modulos.has(k);
                    return (
                      <label
                        key={k}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm",
                          checked ? "bg-primary/10" : "hover:bg-surface-2",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(modulos, setModulos, k)}
                          className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
                        />
                        <span className="min-w-0 break-words text-text">
                          <span className="font-medium">{m.modulo}</span>
                          {m.submodulo && <span className="text-text-muted"> › {m.submodulo}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <Field label="Prompt de refino (opcional)" htmlFor="pf_refino" hint="Ajuste livre acrescentado ao final da persona.">
          <textarea id="pf_refino" rows={2} className={controlClass} value={promptRefino} onChange={(e) => setPromptRefino(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Perfil exigido (opcional)" htmlFor="pf_req" hint="Só usa este perfil quando o p_perfil do login confere. Ex.: GESTOR.">
            <input id="pf_req" className={controlClass} value={requiresPerfil} onChange={(e) => setRequiresPerfil(e.target.value)} />
          </Field>
          <Field label="Prioridade" htmlFor="pf_prio" hint="Maior = escolhido antes quando mais de um casa.">
            <input id="pf_prio" type="number" className={controlClass} value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
          Perfil ativo
        </label>
      </div>
    </Dialog>
  );
}
