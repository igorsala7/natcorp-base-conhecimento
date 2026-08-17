"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Trash2, Zap, Mail, Cpu, LayoutTemplate, DatabaseBackup, MessageSquareText, Puzzle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { Surface } from "@/components/ui/surface";
import { Tabs, useAbaAtual, type Aba as AbaUI } from "@/components/ui/tabs";
import { abasDaRota } from "@/lib/admin/mapa-rotas";
import { Field, eyebrowLabel } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, DataHead, Th, Td, Tr, EmptyRow } from "@/components/ui/data-table";
import {
  PROVIDER_LABEL,
  PROVIDER_HELP,
  PURPOSES,
  modelosDe,
  suportaFinalidade,
  type ProviderKind,
  type Purpose,
} from "@/lib/ai/catalog";
import {
  saveProvider,
  deleteProvider,
  assignPurpose,
  testPurpose,
  saveEmailSettings,
  sendTestEmail,
  getAiUsageReport,
  getAiUsageFacets,
  type AiUsageRow,
} from "./actions";
import { BackupPanel, type BackupRow, type BackupSettingsRow } from "./backup-panel";
import { PromptsPanel, type PromptCatUI } from "./prompts-panel";
import { WebAccessPanel, type WebAccessData } from "./web-access-panel";
import { ExtensionPanel } from "./extension-panel";
import { Select } from "@/components/ui/select";

export type ProviderRow = {
  id: string;
  name: string;
  kind: string;
  base_url: string | null;
  active: boolean;
  base_code: string;
};
export type AssignmentRow = { purpose: string; provider_id: string; model: string; base_code: string };
export type EmailRow = {
  transport: string;
  from_name: string;
  from_email: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_secure: boolean;
};

type Aba = "ia" | "email" | "backup" | "prompts" | "extensao";

/**
 * O ícone fica AQUI, não no mapa de rotas.
 *
 * O mapa é dado puro e testável — importar `lucide-react` nele arrastaria o
 * pacote de ícones para dentro de todo teste que só quer saber se as abas
 * batem. O rótulo e a permissão vêm de lá; a aparência é assunto da tela.
 */
const ICONE_DA_ABA: Record<string, LucideIcon | undefined> = {
  ia: Cpu,
  email: Mail,
  extensao: Puzzle,
  prompts: MessageSquareText,
  backup: DatabaseBackup,
};

export function SystemManager({
  providers,
  assignments,
  email,
  temChave,
  isOwner,
  temChaveMestra,
  canBackup,
  backups,
  backupSettings,
  githubTokenPresent,
  canPrompts,
  prompts,
  webAccess,
  bases,
}: {
  providers: ProviderRow[];
  assignments: AssignmentRow[];
  email: EmailRow;
  /** Quais provedores já têm chave gravada (nunca o valor). */
  temChave: Record<string, boolean>;
  isOwner: boolean;
  temChaveMestra: boolean;
  canBackup: boolean;
  backups: BackupRow[];
  backupSettings: BackupSettingsRow;
  githubTokenPresent: boolean;
  canPrompts: boolean;
  prompts: PromptCatUI[];
  webAccess: WebAccessData;
  bases: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  /**
   * A ABA MORA NA URL — e a lista vem do mapa de rotas.
   *
   * Eram duas falhas empilhadas. `useState` fazia o F5 voltar sempre para
   * "Inteligência artificial", numa tela onde quem foi conferir um backup ou
   * ajustar um prompt perde o lugar a cada recarga; e o `mapa-rotas` declarava
   * para esta rota uma aba "Chaves" que nunca existiu aqui (as chaves são
   * `/admin/chaves-api`) enquanto omitia "Extensão" e "Prompts", que existem.
   * O Cmd+K oferecia "Sistema › Chaves", montava a URL, e a tela abria em IA
   * sem dizer nada.
   *
   * Agora a barra e a paleta leem a MESMA lista, filtrada pelas mesmas
   * permissões — não há duas verdades para divergirem.
   */
  const permissoesDaTela = useMemo(() => {
    const s = new Set<string>();
    if (canPrompts) s.add("ai.configure");
    if (canBackup) s.add("system.backup");
    return s;
  }, [canPrompts, canBackup]);
  const abas: AbaUI[] = useMemo(
    () =>
      abasDaRota("/admin/sistema", permissoesDaTela).map((a) => ({
        key: a.key,
        label: a.rotulo,
        icon: ICONE_DA_ABA[a.key],
      })),
    [permissoesDaTela],
  );
  const aba = useAbaAtual(abas) as Aba;
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; msg?: string; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.msg ?? "Feito.");
      else toast.error(r.error ?? "Falhou.");
      router.refresh();
    });
  }

  return (
    <div className="mt-6">
      <Tabs tabs={abas} aria-label="Áreas da configuração" />

      {!temChaveMestra && (
        <p className="mt-3 rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-sm leading-relaxed text-warning">
          <strong className="font-medium">Chaves guardadas em texto simples.</strong> Sem{" "}
          <code>APP_ENCRYPTION_KEY</code> no servidor, as chaves de API ficam legíveis no banco —
          quem obtiver um dump lê todas. O acesso segue restrito, mas <strong className="font-medium">
          não use assim em produção</strong>. Ao definir a variável e salvar de novo, o segredo passa
          a ser cifrado; nada precisa ser refeito.
        </p>
      )}


      {aba === "ia" ? (
        <>
          <AbaIA
            providers={providers}
            assignments={assignments}
            bases={bases}
            temChave={temChave}
            isOwner={isOwner}
            temChaveMestra={temChaveMestra}
            pending={pending}
            run={run}
          />
          <div className="mt-6">
            <WebAccessPanel {...webAccess} />
          </div>
        </>
      ) : aba === "prompts" && canPrompts ? (
        <PromptsPanel categorias={prompts} />
      ) : aba === "backup" && canBackup ? (
        <BackupPanel backups={backups} settings={backupSettings} isOwner={isOwner} githubTokenPresent={githubTokenPresent} />
      ) : aba === "extensao" ? (
        <ExtensionPanel />
      ) : (
        <AbaEmail email={email} isOwner={isOwner} pending={pending} run={run} />
      )}
    </div>
  );
}

type Run = (fn: () => Promise<{ ok: boolean; msg?: string; error?: string }>) => void;

function AbaIA({
  providers,
  assignments,
  bases,
  temChave,
  isOwner,
  temChaveMestra,
  pending,
  run,
}: {
  providers: ProviderRow[];
  assignments: AssignmentRow[];
  bases: string[];
  temChave: Record<string, boolean>;
  isOwner: boolean;
  temChaveMestra: boolean;
  pending: boolean;
  run: Run;
}) {
  const [novo, setNovo] = useState(false);
  const { confirmar } = useConfirm();
  const [baseSel, setBaseSel] = useState("");
  const [form, setForm] = useState({
    id: "",
    name: "",
    kind: "openai" as ProviderKind,
    baseUrl: "",
    active: true,
    apiKey: "",
  });

  // Recorte por base: '' = padrão (todas). Provedores desta base; nas atribuições
  // a base pode usar o provedor PRÓPRIO ou um do padrão.
  const providersDoBase = providers.filter((p) => p.base_code === baseSel);
  const providersAtrib = baseSel ? providers.filter((p) => p.base_code === baseSel || p.base_code === "") : providersDoBase;

  return (
    <div className="mt-5 space-y-6">
      <Surface elevation={1} padding="lg">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className={eyebrowLabel}>Configuração por base</h2>
          <Select
            aria-label="Base"
            className={`${controlClass} h-9 w-auto`}
            value={baseSel}
            onChange={(v) => { setBaseSel(v); setNovo(false); }}
          >
            <option value="">Padrão (todas as bases)</option>
            {bases.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>
          <span className="text-xs text-text-muted">
            {baseSel
              ? "Provedores e atribuições PRÓPRIOS desta base. Sem override, ela herda o padrão."
              : "Padrão global — vale para todas as bases que não têm configuração própria."}
          </span>
        </div>
      </Surface>

      <Surface elevation={1} padding="lg">
        <div className="flex items-center gap-3">
          <h2 className={eyebrowLabel}>Provedores</h2>
          <Button size="sm" className="ml-auto" onClick={() => { setNovo(true); setForm({ id: "", name: "", kind: "openai", baseUrl: "", active: true, apiKey: "" }); }}>
            <Plus className="size-4" /> Novo provedor
          </Button>
        </div>

        {providersDoBase.length === 0 && !novo ? (
          <EmptyState
            className="mt-4"
            icon={Cpu}
            title={baseSel ? "Sem provedor próprio nesta base" : "Nenhum provedor cadastrado"}
            description={baseSel ? "Esta base herda o padrão global. Crie um provedor para dar uma conta/credencial própria a ela." : "Enquanto não houver nenhum, o sistema continua usando as variáveis de ambiente — como sempre funcionou."}
          />
        ) : (
          <div className="mt-4">
            <DataTable rotulo="Provedores de IA">
              <DataHead>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>Chave</Th>
                <Th>Situação</Th>
                <Th>Ações</Th>
              </DataHead>
              <tbody>
                {providersDoBase.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-medium">{p.name}</Td>
                    <Td>{PROVIDER_LABEL[p.kind as ProviderKind] ?? p.kind}</Td>
                    <Td>
                      {temChave[p.id] ? (
                        <Badge tone="success">
                          <KeyRound className="size-3.5" /> gravada
                        </Badge>
                      ) : (
                        <Badge tone="neutral">sem chave</Badge>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={p.active ? "success" : "neutral"}>
                        {p.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setNovo(true);
                            setForm({
                              id: p.id,
                              name: p.name,
                              kind: p.kind as ProviderKind,
                              baseUrl: p.base_url ?? "",
                              active: p.active,
                              apiKey: "",
                            });
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          // Só o ícone: sem rótulo, o leitor de tela anunciava
                          // "botão" três vezes seguidas numa tabela e não dizia
                          // o que cada um exclui. Nomeia o PROVEDOR, não a ação
                          // — quem navega botão a botão precisa do alvo.
                          aria-label={`Excluir o provedor ${p.name}`}
                          onClick={async () => {
                            if (
                              await confirmar({
                                title: "Excluir provedor",
                                description: `Excluir "${p.name}"? As finalidades que o usam voltam para as variáveis de ambiente.`,
                                tone: "danger",
                              })
                            )
                              run(() => deleteProvider(p.id));
                          }}
                        >
                          <Trash2 className="size-4 text-danger" />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}

        {novo && (
          <div className="mt-4 space-y-3 rounded-lg border border-primary/40 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome" htmlFor="p-nome" required>
                <Input id="p-nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: OpenAI produção" />
              </Field>
              <Field label="Tipo" htmlFor="p-tipo">
                <Select id="p-tipo" className={`${controlClass} h-10`} value={form.kind} onChange={(v) => setForm({ ...form, kind: v as ProviderKind })}>
                  {(Object.keys(PROVIDER_LABEL) as ProviderKind[]).map((k) => (
                    <option key={k} value={k}>{PROVIDER_LABEL[k]}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="Chave de API"
              htmlFor="p-chave"
              hint={
                isOwner
                  ? `${PROVIDER_HELP[form.kind]}. Deixe em branco para manter a chave atual — ela nunca é exibida de volta.${temChaveMestra ? "" : " Atenção: será guardada em texto simples."}`
                  : "Somente o Owner pode ver ou alterar chaves."
              }
            >
              <Input
                id="p-chave"
                type="password"
                autoComplete="off"
                disabled={!isOwner}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder={form.id && temChave[form.id] ? "•••••••• (já gravada)" : "cole a chave aqui"}
              />
            </Field>

            <Field label="URL base (opcional)" htmlFor="p-url" hint="Para gateway compatível — Azure OpenAI, LiteLLM, proxy interno.">
              <Input id="p-url" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://…" />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--color-primary)]" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Ativo
            </label>

            <div className="flex gap-2">
              <Button
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const r = await saveProvider({
                      id: form.id || undefined,
                      name: form.name,
                      kind: form.kind,
                      baseUrl: form.baseUrl,
                      active: form.active,
                      base: baseSel,
                      apiKey: form.apiKey || null,
                    });
                    if (r.ok) setNovo(false);
                    return r;
                  })
                }
              >
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => setNovo(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </Surface>

      <Surface elevation={1} padding="lg" className="space-y-4">
        <h2 className={eyebrowLabel}>Qual IA faz o quê</h2>
        <p className="text-xs leading-relaxed text-text-muted">
          Sem atribuição, a finalidade usa as variáveis de ambiente (o comportamento de sempre).
        </p>
        {PURPOSES.map((p) => (
          <LinhaFinalidade
            key={p.key}
            purpose={p.key}
            label={p.label}
            desc={p.desc}
            providers={providersAtrib}
            atual={assignments.find((a) => a.purpose === p.key && a.base_code === baseSel)}
            base={baseSel}
            pending={pending}
            run={run}
          />
        ))}
      </Surface>

      <ConsumoIA />
    </div>
  );
}

/** Data de hoje (UTC) em `YYYY-MM-DD` para os inputs de data. */
function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}
/** `n` dias atrás (UTC) em `YYYY-MM-DD`. */
function diasAtras(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
const fmt = (n: number) => n.toLocaleString("pt-BR");
/** Rótulo amigável da AÇÃO (finalidade) — ex.: import_layout → "Importação — layout". */
const acaoLabel = (p: string) => PURPOSES.find((x) => x.key === p)?.label ?? p;

/** Consumo de tokens (envio/recebimento) por IA e por modelo, com período. */
type UsoTipo = "system" | "user" | "all";
/** Filtros de identidade (só no tipo "usuário"). "Painel" = p_portal. */
const CAMPOS_USO = [
  ["base", "Base"],
  ["portal", "Painel"],
  ["perfil", "Perfil"],
  ["usuario", "Usuário"],
  ["empresa", "Empresa"],
  ["matricula", "Matrícula"],
] as const;
type FiltrosUso = Record<(typeof CAMPOS_USO)[number][0], string>;

function ConsumoIA() {
  const [from, setFrom] = useState(() => diasAtras(30));
  const [to, setTo] = useState(() => hojeIso());
  // Padrão TODOS: o Chat/widget grava com kind="user" e as ações internas com
  // kind="system"; "sistema" escondia o Chat do relatório de faturamento. Nunca
  // omitir nenhum consumo por padrão — ver acaoLabel (fallback mostra a ação crua).
  const [tipo, setTipo] = useState<UsoTipo>("all");
  const [filtros, setFiltros] = useState<FiltrosUso>({
    base: "",
    portal: "",
    perfil: "",
    usuario: "",
    empresa: "",
    matricula: "",
  });
  const [rows, setRows] = useState<AiUsageRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, startLoad] = useTransition();
  // Valores já registrados, para os filtros virarem listas (digita e filtra).
  const [facetas, setFacetas] = useState<Record<string, string[]>>({});
  useEffect(() => {
    getAiUsageFacets().then((r) => {
      if (r.ok) setFacetas(r.facets);
    });
  }, []);

  // Debounce: digitar nos filtros de identidade não dispara uma consulta por tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      startLoad(async () => {
        const r = await getAiUsageReport({
          from,
          to,
          kind: tipo === "all" ? null : tipo,
          ...(tipo === "user" ? filtros : {}),
        });
        if (r.ok) {
          setRows(r.rows);
          setErro(null);
        } else {
          setRows([]);
          setErro(r.error);
        }
      });
    }, 350);
    return () => clearTimeout(t);
  }, [from, to, tipo, filtros]);

  const total = useMemo(
    () =>
      (rows ?? []).reduce(
        (a, r) => ({
          input: a.input + r.input,
          output: a.output + r.output,
          calls: a.calls + r.calls,
        }),
        { input: 0, output: 0, calls: 0 },
      ),
    [rows],
  );

  // Agrega os modelos de cada provedor numa linha por IA.
  const porIA = useMemo(() => {
    const m = new Map<string, { input: number; output: number; total: number; calls: number }>();
    for (const r of rows ?? []) {
      const a = m.get(r.provider) ?? { input: 0, output: 0, total: 0, calls: 0 };
      a.input += r.input;
      a.output += r.output;
      a.total += r.total;
      a.calls += r.calls;
      m.set(r.provider, a);
    }
    return [...m.entries()].sort((x, y) => y[1].total - x[1].total);
  }, [rows]);

  // As linhas do relatório vêm por (IA, modelo, ação); aqui somam-se as ações
  // para a visão por modelo.
  const porModelo = useMemo(() => {
    const m = new Map<
      string,
      { provider: string; model: string; input: number; output: number; total: number; calls: number }
    >();
    for (const r of rows ?? []) {
      const chave = `${r.provider}\u0000${r.model}`;
      const a = m.get(chave) ?? { provider: r.provider, model: r.model, input: 0, output: 0, total: 0, calls: 0 };
      a.input += r.input;
      a.output += r.output;
      a.total += r.total;
      a.calls += r.calls;
      m.set(chave, a);
    }
    return [...m.values()].sort((x, y) => y.total - x.total);
  }, [rows]);

  return (
    <Surface elevation={1} padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className={eyebrowLabel}>Consumo de IA</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            aria-label="Tipo de consumo"
            value={tipo}
            onChange={(v) => setTipo(v as UsoTipo)}
            className={`${controlClass} h-8 w-auto px-2 py-1 text-xs`}
          >
            <option value="all">Tipo: Todos</option>
            <option value="user">Tipo: Usuário (Chat)</option>
            <option value="system">Tipo: Sistema</option>
          </Select>
          <div className="flex overflow-hidden rounded-md border border-border">
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setFrom(diasAtras(n));
                  setTo(hojeIso());
                }}
                className="border-r border-border px-2.5 py-1 text-xs text-text-muted last:border-0 hover:bg-surface-2 hover:text-text"
              >
                {n} dias
              </button>
            ))}
          </div>
          <input
            type="date"
            aria-label="De"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className={`${controlClass} h-8 w-auto px-2 py-1`}
          />
          <span className="text-text-muted">→</span>
          <input
            type="date"
            aria-label="Até"
            value={to}
            min={from}
            max={hojeIso()}
            onChange={(e) => setTo(e.target.value)}
            className={`${controlClass} h-8 w-auto px-2 py-1`}
          />
        </div>
      </div>

      {tipo === "user" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {CAMPOS_USO.map(([campo, rotulo]) => (
            <label key={campo} className="block">
              <span className="mb-0.5 block text-xs text-text-muted">{rotulo}</span>
              <Input
                value={filtros[campo]}
                onChange={(e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }))}
                placeholder="—"
                className="h-8"
                list={`uso-${campo}`}
                autoComplete="off"
              />
              <datalist id={`uso-${campo}`}>
                {(facetas[campo] ?? []).map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </label>
          ))}
        </div>
      )}

      {erro && (
        <p className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      {rows === null ? (
        <p className="py-8 text-center text-sm text-text-muted">Carregando…</p>
      ) : (
        <div className={`space-y-5 transition-opacity ${carregando ? "opacity-60" : ""}`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Cartao rotulo="Envio (entrada)" valor={fmt(total.input)} sufixo="tokens" />
            <Cartao rotulo="Recebimento (saída)" valor={fmt(total.output)} sufixo="tokens" />
            <Cartao rotulo="Chamadas" valor={fmt(total.calls)} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Por IA</h3>
            <DataTable rotulo="Finalidades de IA">
              <DataHead>
                <Th>Provedor</Th>
                <Th className="text-right">Envio</Th>
                <Th className="text-right">Recebimento</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Chamadas</Th>
              </DataHead>
              <tbody>
                {porIA.length === 0 ? (
                  <EmptyRow colSpan={5}>Sem consumo no período.</EmptyRow>
                ) : (
                  porIA.map(([prov, a]) => (
                    <Tr key={prov}>
                      <Td className="font-medium">{PROVIDER_LABEL[prov as ProviderKind] ?? prov}</Td>
                      <Td className="text-right tabular-nums">{fmt(a.input)}</Td>
                      <Td className="text-right tabular-nums">{fmt(a.output)}</Td>
                      <Td className="text-right tabular-nums">{fmt(a.total)}</Td>
                      <Td className="text-right tabular-nums">{fmt(a.calls)}</Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </DataTable>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Por modelo</h3>
            <DataTable rotulo="Modelos e preços">
              <DataHead>
                <Th>Provedor</Th>
                <Th>Modelo</Th>
                <Th className="text-right">Envio</Th>
                <Th className="text-right">Recebimento</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Chamadas</Th>
              </DataHead>
              <tbody>
                {porModelo.length === 0 ? (
                  <EmptyRow colSpan={6}>Sem consumo no período.</EmptyRow>
                ) : (
                  porModelo.map((r) => (
                    <Tr key={`${r.provider}:${r.model}`}>
                      <Td>{PROVIDER_LABEL[r.provider as ProviderKind] ?? r.provider}</Td>
                      <Td className="font-mono text-xs">{r.model}</Td>
                      <Td className="text-right tabular-nums">{fmt(r.input)}</Td>
                      <Td className="text-right tabular-nums">{fmt(r.output)}</Td>
                      <Td className="text-right tabular-nums">{fmt(r.total)}</Td>
                      <Td className="text-right tabular-nums">{fmt(r.calls)}</Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </DataTable>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Por IA, modelo e ação</h3>
            <DataTable rotulo="Limites por base">
              <DataHead>
                <Th>Provedor</Th>
                <Th>Modelo</Th>
                <Th>Ação</Th>
                <Th className="text-right">Envio</Th>
                <Th className="text-right">Recebimento</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Chamadas</Th>
              </DataHead>
              <tbody>
                {rows.length === 0 ? (
                  <EmptyRow colSpan={7}>Sem consumo no período.</EmptyRow>
                ) : (
                  rows.map((r, i) => (
                    <Tr key={`${r.provider}:${r.model}:${r.purpose}:${i}`}>
                      <Td>{PROVIDER_LABEL[r.provider as ProviderKind] ?? r.provider}</Td>
                      <Td className="font-mono text-xs">{r.model}</Td>
                      <Td>{acaoLabel(r.purpose)}</Td>
                      <Td className="text-right tabular-nums">{fmt(r.input)}</Td>
                      <Td className="text-right tabular-nums">{fmt(r.output)}</Td>
                      <Td className="text-right tabular-nums">{fmt(r.total)}</Td>
                      <Td className="text-right tabular-nums">{fmt(r.calls)}</Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-text-muted">
        Envio = tokens de entrada; recebimento = tokens de saída. O registro de consumo começou em
        jul/2026; períodos anteriores não têm dados.
      </p>
    </Surface>
  );
}

/** Cartão de total no topo do consumo. */
function Cartao({ rotulo, valor, sufixo }: { rotulo: string; valor: string; sufixo?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
      <p className="text-xs text-text-muted">{rotulo}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {valor}
        {sufixo && <span className="ml-1 text-xs font-normal text-text-muted">{sufixo}</span>}
      </p>
    </div>
  );
}

function LinhaFinalidade({
  purpose,
  label,
  desc,
  providers,
  atual,
  base,
  pending,
  run,
}: {
  purpose: Purpose;
  label: string;
  desc: string;
  providers: ProviderRow[];
  atual?: AssignmentRow;
  base: string;
  pending: boolean;
  run: Run;
}) {
  const [providerId, setProviderId] = useState(atual?.provider_id ?? "");
  const [model, setModel] = useState(atual?.model ?? "");
  // Embedding não roda em qualquer provedor: a Anthropic não tem essa API.
  const elegiveis = providers.filter(
    (p) => p.active && suportaFinalidade(p.kind as ProviderKind, purpose),
  );
  const escolhido = elegiveis.find((p) => p.id === providerId);
  const sugestoes = escolhido ? modelosDe(escolhido.kind as ProviderKind, purpose) : [];

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="ml-2 text-xs text-text-muted">{desc}</span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Select
          aria-label={`Provedor para ${label}`}
          className={`${controlClass} h-9 w-auto`}
          value={providerId}
          onChange={(v) => { setProviderId(v); setModel(""); }}
        >
          <option value="">{base ? "— herdar o padrão —" : "— usar variáveis de ambiente —"}</option>
          {elegiveis.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>

        {providerId && (
          <input
            aria-label={`Modelo para ${label}`}
            list={`modelos-${purpose}`}
            className={`${controlClass} h-9 w-auto`}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="modelo"
          />
        )}
        <datalist id={`modelos-${purpose}`}>
          {sugestoes.map((m) => <option key={m} value={m} />)}
        </datalist>

        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => assignPurpose(purpose, providerId || null, model, base))}>
          Salvar
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => testPurpose(purpose))} title="Faz uma chamada real ao provedor">
          <Zap className="size-4" /> Testar
        </Button>
      </div>
    </div>
  );
}

function AbaEmail({
  email,
  isOwner,
  pending,
  run,
}: {
  email: EmailRow;
  isOwner: boolean;
  pending: boolean;
  run: Run;
}) {
  const [f, setF] = useState({
    transport: email.transport as "off" | "brevo" | "smtp",
    fromName: email.from_name,
    fromEmail: email.from_email ?? "",
    smtpHost: email.smtp_host ?? "",
    smtpPort: email.smtp_port ?? 587,
    smtpUser: email.smtp_user ?? "",
    smtpSecure: email.smtp_secure,
    brevoKey: "",
    smtpPass: "",
  });

  return (
    <Surface elevation={1} padding="lg" className="mt-5 space-y-4">
      <Field label="Como enviar" htmlFor="transp">
        <Select id="transp" className={`${controlClass} h-10`} value={f.transport} onChange={(v) => setF({ ...f, transport: v as typeof f.transport })}>
          <option value="off">Desligado (não envia e-mail)</option>
          <option value="brevo">Brevo (API)</option>
          <option value="smtp">SMTP genérico</option>
        </Select>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome do remetente" htmlFor="fn">
          <Input id="fn" value={f.fromName} onChange={(e) => setF({ ...f, fromName: e.target.value })} />
        </Field>
        <Field label="E-mail do remetente" htmlFor="fe" hint="Precisa ser um remetente verificado no provedor.">
          <Input id="fe" type="email" value={f.fromEmail} onChange={(e) => setF({ ...f, fromEmail: e.target.value })} placeholder="nao-responda@empresa.com" />
        </Field>
      </div>

      {f.transport === "brevo" && (
        <Field
          label="Chave da API do Brevo"
          htmlFor="bk"
          hint={isOwner ? "Deixe em branco para manter a atual." : "Somente o Owner pode alterar."}
        >
          <Input id="bk" type="password" autoComplete="off" disabled={!isOwner} value={f.brevoKey} onChange={(e) => setF({ ...f, brevoKey: e.target.value })} placeholder="xkeysib-…" />
        </Field>
      )}

      {f.transport === "smtp" && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Servidor" htmlFor="sh">
              <Input id="sh" value={f.smtpHost} onChange={(e) => setF({ ...f, smtpHost: e.target.value })} placeholder="smtp-relay.brevo.com" />
            </Field>
            <Field label="Porta" htmlFor="sp">
              <Input id="sp" type="number" value={f.smtpPort} onChange={(e) => setF({ ...f, smtpPort: Number(e.target.value) })} />
            </Field>
            <Field label="Usuário" htmlFor="su">
              <Input id="su" value={f.smtpUser} onChange={(e) => setF({ ...f, smtpUser: e.target.value })} />
            </Field>
            <Field label="Senha" htmlFor="ss" hint={isOwner ? "Em branco mantém a atual." : "Somente o Owner."}>
              <Input id="ss" type="password" autoComplete="off" disabled={!isOwner} value={f.smtpPass} onChange={(e) => setF({ ...f, smtpPass: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[var(--color-primary)]" checked={f.smtpSecure} onChange={(e) => setF({ ...f, smtpSecure: e.target.checked })} />
            Conexão segura (TLS) — desmarque só para a porta 587 com STARTTLS
          </label>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            run(() =>
              saveEmailSettings({
                transport: f.transport,
                fromName: f.fromName,
                fromEmail: f.fromEmail,
                smtpHost: f.smtpHost,
                smtpPort: f.smtpPort,
                smtpUser: f.smtpUser,
                smtpSecure: f.smtpSecure,
                brevoKey: f.brevoKey || null,
                smtpPass: f.smtpPass || null,
              }),
            )
          }
        >
          Salvar
        </Button>
        <Button variant="secondary" disabled={pending || f.transport === "off"} onClick={() => run(() => sendTestEmail())}>
          <Mail className="size-4" /> Enviar e-mail de teste
        </Button>
        <Button asChild variant="secondary">
          <Link href="/admin/sistema/email-template">
            <LayoutTemplate className="size-4" /> Template de e-mail
          </Link>
        </Button>
      </div>
    </Surface>
  );
}
