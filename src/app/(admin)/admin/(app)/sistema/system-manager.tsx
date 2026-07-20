"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Trash2, Zap, Mail, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Field } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, DataHead, Th, Td, Tr } from "@/components/ui/data-table";
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
} from "./actions";

export type ProviderRow = {
  id: string;
  name: string;
  kind: string;
  base_url: string | null;
  active: boolean;
};
export type AssignmentRow = { purpose: string; provider_id: string; model: string };
export type EmailRow = {
  transport: string;
  from_name: string;
  from_email: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_secure: boolean;
};

type Aba = "ia" | "email";

export function SystemManager({
  providers,
  assignments,
  email,
  temChave,
  isOwner,
  temChaveMestra,
}: {
  providers: ProviderRow[];
  assignments: AssignmentRow[];
  email: EmailRow;
  /** Quais provedores já têm chave gravada (nunca o valor). */
  temChave: Record<string, boolean>;
  isOwner: boolean;
  temChaveMestra: boolean;
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("ia");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; msg?: string; error?: string }>) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, texto: r.ok ? (r.msg ?? "Feito.") : (r.error ?? "Falhou.") });
      router.refresh();
    });
  }

  return (
    <div className="mt-6">
      <div role="tablist" className="flex gap-1 rounded-lg bg-surface-2 p-1">
        {([
          ["ia", "Inteligência artificial", Cpu],
          ["email", "E-mail", Mail],
        ] as const).map(([k, rotulo, Icon]) => (
          <button
            key={k}
            role="tab"
            aria-selected={aba === k}
            onClick={() => setAba(k)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              aba === k ? "bg-surface font-medium text-text shadow-1" : "text-text-muted hover:text-text"
            }`}
          >
            <Icon className="size-4" /> {rotulo}
          </button>
        ))}
      </div>

      {!temChaveMestra && (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <strong className="font-medium">APP_ENCRYPTION_KEY não configurada no servidor.</strong>{" "}
          Sem ela não é possível gravar chaves nem segredos. Defina no ambiente e reinicie — e
          guarde-a bem: perdê-la inutiliza tudo que já foi cifrado.
        </p>
      )}

      {msg && (
        <p
          role="status"
          className={`mt-3 whitespace-pre-wrap rounded-md border px-3 py-2 text-sm ${
            msg.ok
              ? "border-border bg-surface-2"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {msg.texto}
        </p>
      )}

      {aba === "ia" ? (
        <AbaIA
          providers={providers}
          assignments={assignments}
          temChave={temChave}
          isOwner={isOwner}
          pending={pending}
          run={run}
        />
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
  temChave,
  isOwner,
  pending,
  run,
}: {
  providers: ProviderRow[];
  assignments: AssignmentRow[];
  temChave: Record<string, boolean>;
  isOwner: boolean;
  pending: boolean;
  run: Run;
}) {
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState({
    id: "",
    name: "",
    kind: "openai" as ProviderKind,
    baseUrl: "",
    active: true,
    apiKey: "",
  });

  return (
    <div className="mt-5 space-y-6">
      <Surface elevation={1} padding="lg">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Provedores
          </h2>
          <Button size="sm" className="ml-auto" onClick={() => { setNovo(true); setForm({ id: "", name: "", kind: "openai", baseUrl: "", active: true, apiKey: "" }); }}>
            <Plus className="size-4" /> Novo provedor
          </Button>
        </div>

        {providers.length === 0 && !novo ? (
          <EmptyState
            className="mt-4"
            icon={Cpu}
            title="Nenhum provedor cadastrado"
            description="Enquanto não houver nenhum, o sistema continua usando as variáveis de ambiente — como sempre funcionou."
          />
        ) : (
          <div className="mt-4">
            <DataTable>
              <DataHead>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>Chave</Th>
                <Th>Situação</Th>
                <Th>Ações</Th>
              </DataHead>
              <tbody>
                {providers.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-medium">{p.name}</Td>
                    <Td>{PROVIDER_LABEL[p.kind as ProviderKind] ?? p.kind}</Td>
                    <Td>
                      {temChave[p.id] ? (
                        <Badge tone="primary">
                          <KeyRound className="size-3" /> gravada
                        </Badge>
                      ) : (
                        <Badge tone="warning">sem chave</Badge>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={p.active ? "neutral" : "danger"}>
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
                          onClick={() => {
                            if (confirm(`Excluir "${p.name}"? As finalidades que o usam voltam para as variáveis de ambiente.`))
                              run(() => deleteProvider(p.id));
                          }}
                        >
                          <Trash2 className="size-4 text-red-600 dark:text-red-400" />
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
                <select id="p-tipo" className={`${controlClass} h-10`} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ProviderKind })}>
                  {(Object.keys(PROVIDER_LABEL) as ProviderKind[]).map((k) => (
                    <option key={k} value={k}>{PROVIDER_LABEL[k]}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field
              label="Chave de API"
              htmlFor="p-chave"
              hint={
                isOwner
                  ? `${PROVIDER_HELP[form.kind]}. Deixe em branco para manter a chave atual — ela nunca é exibida de volta.`
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
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Qual IA faz o quê
        </h2>
        <p className="text-xs leading-relaxed text-text-muted">
          Sem atribuição, a finalidade usa as variáveis de ambiente (o comportamento de sempre).
        </p>
        {PURPOSES.map((p) => (
          <LinhaFinalidade
            key={p.key}
            purpose={p.key}
            label={p.label}
            desc={p.desc}
            providers={providers}
            atual={assignments.find((a) => a.purpose === p.key)}
            pending={pending}
            run={run}
          />
        ))}
      </Surface>
    </div>
  );
}

function LinhaFinalidade({
  purpose,
  label,
  desc,
  providers,
  atual,
  pending,
  run,
}: {
  purpose: Purpose;
  label: string;
  desc: string;
  providers: ProviderRow[];
  atual?: AssignmentRow;
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
        <select
          aria-label={`Provedor para ${label}`}
          className={`${controlClass} h-9 w-auto`}
          value={providerId}
          onChange={(e) => { setProviderId(e.target.value); setModel(""); }}
        >
          <option value="">— usar variáveis de ambiente —</option>
          {elegiveis.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

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

        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => assignPurpose(purpose, providerId || null, model))}>
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
        <select id="transp" className={`${controlClass} h-10`} value={f.transport} onChange={(e) => setF({ ...f, transport: e.target.value as typeof f.transport })}>
          <option value="off">Desligado (não envia e-mail)</option>
          <option value="brevo">Brevo (API)</option>
          <option value="smtp">SMTP genérico</option>
        </select>
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
      </div>
    </Surface>
  );
}
