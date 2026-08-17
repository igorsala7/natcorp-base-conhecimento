"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Eye, KeyRound, Pencil, Plus, ShieldAlert, Stethoscope, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sectionTitleClass } from "@/components/ui/page-shell";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { controlClass } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { cn } from "@/lib/utils";
import type { Passo } from "@/lib/integrations/base-health";
import { Select } from "@/components/ui/select";
import {
  AUTH_TYPES,
  CREDENTIAL_FIELDS,
  chavesSecretas,
  type AuthType,
} from "@/lib/integrations/credentials";
import {
  createBase,
  updateBase,
  deleteBase,
  saveCredential,
  deleteCredential,
  lerCredencial,
  syncModulesAction,
  testarBase,
  type IntegResult,
} from "./actions";

export type CredentialRow = {
  id: string;
  name: string;
  auth_type: AuthType;
  active: boolean;
  hasSecret: boolean;
  /** Campo `meta` (coluna, não blob cifrado) — o único que volta para a tela. */
  provider: string | null;
};
export type NodePos = { x: number; y: number };
export type BaseRow = {
  id: string;
  base_code: string;
  name: string;
  active: boolean;
  base_url: string | null;
  credential_id: string | null;
  tool_routing: boolean;
  widget_paineis: string[] | null;
  perfis_endpoint: string | null;
  perfis_campo: string | null;
  flow_layout: Record<string, NodePos> | null;
  spaceIds: string[];
  credentials: CredentialRow[];
};
export type SpaceOption = { id: string; name: string };

const AUTH_LABEL = Object.fromEntries(AUTH_TYPES.map((a) => [a.value, a.label])) as Record<AuthType, string>;

export function IntegrationsManager({
  bases,
  spaces,
  temChaveMestra,
}: {
  bases: BaseRow[];
  spaces: SpaceOption[];
  temChaveMestra: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [pending, startTransition] = useTransition();
  const [aberta, setAberta] = useState<Set<string>>(new Set());
  const [baseDialog, setBaseDialog] = useState<{ base?: BaseRow } | null>(null);
  const [credDialog, setCredDialog] = useState<{ baseId: string; cred?: CredentialRow } | null>(null);
  // Diagnóstico da base. O resultado é uma LISTA de passos, não um "deu certo /
  // deu errado": o valor está em dizer QUAL peça falta, que é justamente o que
  // faltava quando a stefanini-dev quebrou num campo de credencial em branco.
  const [testando, setTestando] = useState<string | null>(null);
  const [diag, setDiag] = useState<{ base: string; passos: Passo[]; resumo: string; falhou: boolean } | null>(null);

  function testar(b: BaseRow) {
    setTestando(b.id);
    void testarBase({ baseId: b.id })
      .then((r) => {
        if (!("passos" in r)) {
          if (!r.ok) toast.error(r.error);
          return;
        }
        setDiag({ base: b.name, passos: r.passos, resumo: r.resumo, falhou: r.falhou });
      })
      .finally(() => setTestando(null));
  }


  function toggle(id: string) {
    setAberta((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function run(fn: () => Promise<IntegResult>, okMsg?: string, onOk?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return toast.error(r.error); // erro: mantém o diálogo aberto p/ corrigir
      if (okMsg) toast.success(okMsg);
      onOk?.(); // sucesso: fecha o diálogo
      router.refresh();
    });
  }

  async function excluirBase(b: BaseRow) {
    if (
      await confirmar({
        title: "Excluir base",
        description: `Excluir "${b.name}" e todas as suas credenciais? Esta ação não pode ser desfeita.`,
        tone: "danger",
        confirmLabel: "Excluir",
      })
    )
      run(() => deleteBase(b.id), "Base excluída.");
  }

  async function excluirCred(c: CredentialRow) {
    if (
      await confirmar({
        title: "Excluir credencial",
        description: `Excluir "${c.name}"? As integrações que a usam ficarão sem credencial.`,
        tone: "danger",
        confirmLabel: "Excluir",
      })
    )
      run(() => deleteCredential(c.id), "Credencial excluída.");
  }

  return (
    <div>
      {!temChaveMestra && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning-line bg-warning-soft px-3.5 py-2.5 text-sm text-warning">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">APP_ENCRYPTION_KEY não configurada.</strong> As
            credenciais serão gravadas em <em>texto simples</em> no banco. Defina a chave-mestra e
            salve novamente para cifrá-las.
          </span>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className={sectionTitleClass}>Bases / Clientes</h2>
        <Button size="sm" onClick={() => setBaseDialog({})}>
          <Plus /> Nova base
        </Button>
      </div>

      {bases.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Nenhuma base cadastrada"
          description="Cadastre um cliente/base para configurar suas credenciais de acesso às APIs."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {bases.map((b) => {
            const open = aberta.has(b.id);
            return (
              <li key={b.id} className="rounded-xl border border-border bg-surface">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggle(b.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={open}
                  >
                    {open ? (
                      <ChevronDown className="size-4 shrink-0 text-text-muted" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-text-muted" />
                    )}
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-text">{b.name}</span>
                        {!b.active && <Badge tone="warning">Inativa</Badge>}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-text-muted">
                        {b.base_code}
                        <span className="ml-2 font-sans">
                          · {b.credentials.length} credencial(is)
                        </span>
                      </span>
                    </span>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={testando === b.id}
                    onClick={() => testar(b)}
                    title="Testar a conexão desta base"
                  >
                    <Stethoscope />
                    {testando === b.id ? "Testando…" : "Testar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setBaseDialog({ base: b })} title="Editar base">
                    <Pencil />
                  </Button>
                  <Button size="icon" variant="danger" onClick={() => excluirBase(b)} title="Excluir base">
                    <Trash2 />
                  </Button>
                </div>

                {open && (
                  <div className="border-t border-border px-3 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Credenciais
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => setCredDialog({ baseId: b.id })}>
                        <Plus /> Nova credencial
                      </Button>
                    </div>
                    {b.credentials.length === 0 ? (
                      <p className="py-2 text-sm text-text-muted">Nenhuma credencial nesta base.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {b.credentials.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface-2/40 px-3 py-2"
                          >
                            <KeyRound className="size-4 shrink-0 text-text-muted" />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-medium text-text">{c.name}</span>
                                <Badge tone="neutral">{AUTH_LABEL[c.auth_type]}</Badge>
                                {c.auth_type !== "none" &&
                                  (c.hasSecret ? (
                                    <Badge tone="info">Configurada</Badge>
                                  ) : (
                                    <Badge tone="warning">Sem segredo</Badge>
                                  ))}
                                {!c.active && <Badge tone="warning">Inativa</Badge>}
                              </span>
                            </span>
                            <Button size="sm" variant="ghost" onClick={() => setCredDialog({ baseId: b.id, cred: c })} title="Editar">
                              <Pencil />
                            </Button>
                            <Button size="icon" variant="danger" onClick={() => excluirCred(c)} title="Excluir">
                              <Trash2 />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <p className="mt-4 text-xs text-text-muted">
                      As APIs/Tools desta base são ligadas/desligadas no editor de cada tool (aba{" "}
                      <strong>APIs / Tools</strong> → seletor de bases). A <strong>URL base</strong> e a{" "}
                      <strong>credencial padrão</strong> ficam em <strong>Editar base</strong>.
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {diag && (
        <Dialog
          open
          onClose={() => setDiag(null)}
          title={`Teste da base ${diag.base}`}
          description={diag.resumo}
          footer={<Button onClick={() => setDiag(null)}>Fechar</Button>}
        >
          <ul className="flex flex-col gap-2.5">
            {diag.passos.map((p, i) => (
              <li key={i} className="flex gap-2.5">
                {p.estado === "ok" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                ) : p.estado === "aviso" ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                )}
                <span className="min-w-0">
                  <span className="block text-sm text-text">{p.nome}</span>
                  {p.detalhe && (
                    <span className="block break-words text-xs text-text-muted">{p.detalhe}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {/* Diz o que o teste NÃO cobre: passar aqui e falhar no chat, sem
              essa nota, faria o diagnóstico parecer mentiroso. */}
          <p className="mt-4 border-t border-border pt-3 text-xs text-text-muted">
            O teste vai até obter o token. Chamar uma ferramenta de verdade exigiria a identidade de um
            usuário (empresa, matrícula), que não existe aqui — o erro seria de negócio, não de cadastro.
          </p>
        </Dialog>
      )}

      {baseDialog && (
        <BaseDialog
          base={baseDialog.base}
          spaces={spaces}
          pending={pending}
          onClose={() => setBaseDialog(null)}
          onSave={(payload) =>
            run(
              () => (baseDialog.base ? updateBase(payload) : createBase(payload)),
              baseDialog.base ? "Base salva." : "Base criada.",
              () => setBaseDialog(null),
            )
          }
        />
      )}

      {credDialog && (
        <CredentialDialog
          baseId={credDialog.baseId}
          cred={credDialog.cred}
          pending={pending}
          onClose={() => setCredDialog(null)}
          onSave={(payload) => run(() => saveCredential(payload), "Credencial salva.", () => setCredDialog(null))}
        />
      )}
    </div>
  );
}

// ─────────────────────────────── Diálogo: Base ──────────────────────────────
export function BaseDialog({
  base,
  spaces,
  pending,
  onClose,
  onSave,
}: {
  base?: BaseRow;
  spaces: SpaceOption[];
  pending: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [baseCode, setBaseCode] = useState(base?.base_code ?? "");
  const [name, setName] = useState(base?.name ?? "");
  const [active, setActive] = useState(base?.active ?? true);
  const [baseUrl, setBaseUrl] = useState(base?.base_url ?? "");
  const [credentialId, setCredentialId] = useState(base?.credential_id ?? "");
  const [toolRouting, setToolRouting] = useState(base?.tool_routing ?? false);
  // `null` = todos os painéis (padrão e comportamento de sempre). Uma LISTA
  // recorta; lista vazia desliga o widget nesta base.
  const [widgetPaineis, setWidgetPaineis] = useState<string[] | null>(base?.widget_paineis ?? null);
  const [perfisEndpoint, setPerfisEndpoint] = useState(base?.perfis_endpoint ?? "");
  const [perfisCampo, setPerfisCampo] = useState(base?.perfis_campo ?? "");
  const [spaceIds, setSpaceIds] = useState<Set<string>>(new Set(base?.spaceIds ?? []));
  const credenciais = base?.credentials ?? [];
  const toast = useToast();
  const [syncing, startSync] = useTransition();

  function sincronizarModulos() {
    if (!base) return;
    startSync(async () => {
      const r = await syncModulesAction(base.base_code);
      if (!r.ok) return toast.error(r.error);
      toast.success(`${r.count ?? 0} módulo(s) sincronizado(s). Tagueie as tools na aba APIs / Tools.`);
    });
  }

  function toggleSpace(id: string) {
    setSpaceIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={base ? "Editar base" : "Nova base"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={pending}
            onClick={() =>
              onSave(
                base
                  ? {
                      id: base.id,
                      base_code: baseCode,
                      name,
                      active,
                      base_url: baseUrl,
                      credential_id: credentialId || null,
                      tool_routing: toolRouting,
                      widget_paineis: widgetPaineis,
                      perfis_endpoint: perfisEndpoint,
                      perfis_campo: perfisCampo,
                      space_ids: [...spaceIds],
                    }
                  : {
                      base_code: baseCode,
                      name,
                      base_url: baseUrl,
                      credential_id: credentialId || null,
                      tool_routing: toolRouting,
                      widget_paineis: widgetPaineis,
                      perfis_endpoint: perfisEndpoint,
                      perfis_campo: perfisCampo,
                      space_ids: [...spaceIds],
                    },
              )
            }
          >
            Salvar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Código da base (p_base)" htmlFor="base_code" hint="Igual ao p_base que o token do cliente envia. Único.">
          <input id="base_code" className={controlClass} value={baseCode} onChange={(e) => setBaseCode(e.target.value)} placeholder="ex.: ACME" />
        </Field>
        <Field label="Nome do cliente" htmlFor="base_name">
          <input id="base_name" className={controlClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Acme S/A" />
        </Field>
        <Field label="URL base" htmlFor="base_url" hint="Endereço-base das APIs internas deste cliente. As tools internas usam esta URL + o caminho de cada uma.">
          <input id="base_url" className={controlClass} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.cliente.com/v1" />
        </Field>
        <Field
          label="Credencial padrão"
          htmlFor="base_cred"
          // A dica muda com o MOTIVO de o campo estar como está. Antes ela só
          // descrevia o campo, então uma base sem credencial mostrava um
          // seletor acinzentado sem dizer por quê — e não dá para distinguir
          // "falta cadastrar" de "quebrou".
          hint={
            !base
              ? "Salve a base e cadastre credenciais; depois escolha a padrão aqui."
              : credenciais.length === 0
                ? "Esta base ainda não tem credencial. Feche este diálogo, use “+ Credencial” na linha da base e volte aqui para escolher a padrão."
                : "Credencial usada pelas tools internas desta base."
          }
        >
          <Select
            id="base_cred"
           
            value={credentialId}
            onChange={(v) => setCredentialId(v)}
            disabled={credenciais.length === 0}
          >
            <option value="">— sem autenticação —</option>
            {credenciais.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>

        {/* Widget por painel — o recorte que a operação usa: "a empresa X ainda
            não liberou para os colaboradores, mas os gestores já usam". */}
        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={widgetPaineis === null}
              onChange={(e) => setWidgetPaineis(e.target.checked ? null : ["PO", "PG", "PC"])}
              className="size-4 accent-[var(--color-primary)]"
            />
            Widget em todos os painéis
          </label>
          {widgetPaineis !== null && (
            <div className="mt-2 flex flex-wrap gap-3">
              {(["PO", "PG", "PC"] as const).map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={widgetPaineis.includes(p)}
                    onChange={(e) =>
                      setWidgetPaineis(
                        e.target.checked ? [...widgetPaineis, p] : widgetPaineis.filter((x) => x !== p),
                      )
                    }
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  {p === "PO" ? "Operador" : p === "PG" ? "Gestor" : "Colaborador"}
                </label>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-xs text-text-muted">
            {widgetPaineis === null
              ? "O widget aparece nos três painéis desta base."
              : widgetPaineis.length === 0
                ? "Nenhum painel marcado — o widget não aparece nesta base."
                : `O widget aparece só em: ${widgetPaineis.join(", ")}. Nos demais, a bolha nem é desenhada.`}
          </p>
        </div>

        {/* Roteamento por assunto (Opção A) — economiza tokens */}
        <div className="rounded-lg border border-border bg-surface-2/40 p-3">
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={toolRouting} onChange={(e) => setToolRouting(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
            Roteamento de tools por assunto (economiza tokens)
          </label>
          <p className="mt-1.5 text-xs text-text-muted">
            Um classificador rápido escolhe o(s) módulo(s) do assunto e só as tools daquele recorte entram no passo.
            Tools sem tag e as marcadas como <strong>essencial</strong> entram sempre. Desligado = todas as tools do perfil.
          </p>
          {base ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={sincronizarModulos} disabled={syncing}>
                {syncing ? "Sincronizando…" : "Sincronizar módulos"}
              </Button>
              <span className="text-xs text-text-muted">
                Traz a taxonomia (módulos/submódulos) do endpoint do cliente para taguear as tools.
              </span>
            </div>
          ) : (
            <p className="mt-2 text-xs text-text-muted">Salve a base para sincronizar os módulos do cliente.</p>
          )}
        </div>

        <Field
          label="API de perfis (opcional)"
          htmlFor="base_perfis_endpoint"
          hint="Path (relativo à URL base) que lista os perfis do cliente — usado para popular a allowlist de acesso das ferramentas. Deixe em branco para digitar os perfis à mão."
        >
          <input
            id="base_perfis_endpoint"
            className={controlClass}
            value={perfisEndpoint}
            onChange={(e) => setPerfisEndpoint(e.target.value)}
            placeholder="/rh/v1/perfis"
          />
        </Field>
        <Field
          label="Campo do perfil na resposta"
          htmlFor="base_perfis_campo"
          hint="Nome do campo do JSON que contém o perfil (código/nome). Vazio = a resposta é uma lista simples de valores."
        >
          <input
            id="base_perfis_campo"
            className={controlClass}
            value={perfisCampo}
            onChange={(e) => setPerfisCampo(e.target.value)}
            placeholder="ex.: perfil"
          />
        </Field>
        <Field label="Documentações do chatbot" htmlFor="base_spaces" hint="Bases de conhecimento que o chatbot desta base usa (RAG). Pode marcar várias; a 1ª é onde as conversas do WhatsApp são registradas.">
          {spaces.length === 0 ? (
            <p className="text-sm text-text-muted">Nenhuma documentação disponível.</p>
          ) : (
            <div className="flex max-h-48 flex-col gap-1.5 overflow-auto rounded-lg border border-border bg-surface-2/40 p-2.5">
              {spaces.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={spaceIds.has(s.id)}
                    onChange={() => toggleSpace(s.id)}
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
          )}
        </Field>
        {base && (
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
            Base ativa
          </label>
        )}
      </div>
    </Dialog>
  );
}

// ────────────────────────── Diálogo: Credencial ─────────────────────────────
function CredentialDialog({
  baseId,
  cred,
  pending,
  onClose,
  onSave,
}: {
  baseId: string;
  cred?: CredentialRow;
  pending: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(cred?.name ?? "");
  const [authType, setAuthType] = useState<AuthType>(cred?.auth_type ?? "oauth2");
  const [active, setActive] = useState(cred?.active ?? true);
  // Campos `meta` (coluna, não blob) já entram preenchidos; o resto é carregado
  // do servidor logo abaixo.
  const [secret, setSecret] = useState<Record<string, string>>(
    cred?.provider ? { provider: cred.provider } : {},
  );
  // TUDO À VISTA, por decisão do Igor (11/08/2026) para facilitar a conferência
  // dos dados durante a validação das integrações.
  //
  // Antes o segredo vinha mascarado e só aparecia sob clique, com o pedido
  // gravado na auditoria. O que muda ao abrir mão disso: o valor passa a viajar
  // no payload da página, ficando visível em devtools, no cache do navegador e
  // em qualquer tela compartilhada. A auditoria CONTINUA — cada abertura grava
  // `integrations.credential.reveal`, que é o rastro de quem viu o quê.
  //
  // Para voltar a mascarar: `comSegredo: false` no efeito abaixo e
  // `type={f.secret ? "password" : "text"}` no campo.
  // Já nasce carregando quando há credencial: marcar dentro do efeito
  // dispararia um render em cascata (e o lint reprova, com razão).
  const [carregando, setCarregando] = useState(Boolean(cred?.id));
  const toastCred = useToast();

  const campos = CREDENTIAL_FIELDS[authType];
  // Segredo já existe e o tipo não mudou → pode manter (deixar em branco).
  const podeManter = Boolean(cred?.hasSecret && cred.auth_type === authType);

  // CONFIGURAÇÃO de volta para a tela ao abrir para edição.
  //
  // Antes nada voltava, e editar obrigava a redigitar até `client_id` e a URL do
  // token — que nunca foram segredo. Como recadastrar ficava mais fácil que
  // conferir, o caminho comum virou sobrescrever campo certo por engano.
  useEffect(() => {
    if (!cred?.id) return;
    let vivo = true;
    void lerCredencial({ credentialId: cred.id, comSegredo: true })
      .then((r) => {
        if (!vivo) return;
        if (!("config" in r)) {
          // Blob indecifrável (chave-mestra trocada) precisa aparecer: em
          // silêncio, a pessoa recadastraria por cima de algo recuperável.
          if (!r.ok) toastCred.error(r.error);
          return;
        }
        // `prev` por último: o que a pessoa já digitou vence o que veio do banco.
        setSecret((prev) => ({ ...r.config, ...r.segredo, ...prev }));
      })
      .finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
    // Só na abertura: recarregar a cada tecla sobrescreveria o que está sendo
    // digitado com o que está gravado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cred?.id]);

  function setField(k: string, v: string) {
    setSecret((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={cred ? "Editar credencial" : "Nova credencial"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={pending}
            onClick={() =>
              onSave({
                ...(cred ? { id: cred.id } : {}),
                baseId,
                name,
                auth_type: authType,
                active,
                secret,
              })
            }
          >
            Salvar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Nome da credencial" htmlFor="cred_name" hint="Ex.: OAuth ERP, API Folha…">
          <input id="cred_name" className={controlClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Tipo de autenticação" htmlFor="cred_auth">
          <Select id="cred_auth" value={authType} onChange={(v) => setAuthType(v as AuthType)}>
            {AUTH_TYPES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </Select>
        </Field>

        {campos.length > 0 && (
          <div className="rounded-lg border border-border bg-surface-2/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Credenciais
            </p>
            {podeManter && (
              <p className="mb-2 text-xs text-text-muted">
                Já configurada. Deixe em branco para <strong>manter</strong> a atual; preencha para substituir.
              </p>
            )}
            {/* Tudo já vem preenchido e à vista, inclusive os segredos. O botão
                "Ver segredos salvos" deixou de existir — não há mais o que revelar. */}
            {podeManter && chavesSecretas(authType).length > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-text-muted">
                <Eye className="size-3.5 shrink-0" aria-hidden="true" />
                Valores gravados à mostra para conferência — cada abertura fica registrada na auditoria.
              </p>
            )}
            <div className="flex flex-col gap-2.5">
              {campos.map((f) => (
                <Field key={f.key} label={f.label} htmlFor={`cred_${f.key}`} hint={f.hint} required={f.required && !podeManter}>
                  {f.options ? (
                    // Valores fixos viram LISTA: digitar "Microsoft" onde o motor
                    // espera "microsoft" é um erro que só apareceria na hora de
                    // conectar, longe daqui.
                    <Select
                      id={`cred_${f.key}`}
                      value={secret[f.key] ?? ""}
                      onChange={(v) => setField(f.key, v)}
                    >
                      <option value="">Selecione…</option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  ) : (
                    <input
                      id={`cred_${f.key}`}
                      className={cn(controlClass, f.secret && "font-mono")}
                      // Campo sensível só vira texto DEPOIS de revelado. Sem
                      // isso, quem abre a tela numa reunião compartilha o
                      // segredo sem perceber.
                      type="text"
                      // Sem `type=password`: os valores ficam à vista para conferência.
                      // Ver a nota no topo do componente para voltar a mascarar.
                      autoComplete="off"
                      value={secret[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={
                        carregando ? "Carregando…" : podeManter && f.secret ? "•••••• (manter)" : undefined
                      }
                    />
                  )}
                </Field>
              ))}
            </div>
          </div>
        )}

        {cred && (
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
            Credencial ativa
          </label>
        )}
      </div>
    </Dialog>
  );
}
