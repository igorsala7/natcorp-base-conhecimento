"use client";

import { useMemo, useState, useTransition } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Check, FolderTree, Plus, Trash2, Upload, UserPlus, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar } from "@/components/ui/page-shell";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { Input, controlClass } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import type { Role } from "@/lib/auth/roles";
import type { UserRow, Membership, SpaceOption } from "./page";
import {
  inviteUser,
  setUserSuspended,
  removeUser,
  revokeSessions,
  updateProfileIdentity,
  addMembershipRule,
  removeMembershipRule,
  type ActionState,
} from "./actions";
import { saveAuthor, deleteAuthor, type AuthorRow, type AuthorActionResult } from "./author-actions";
import { listSpaceFolders } from "../conteudo/space-actions";
import { uploadAvatar } from "@/lib/content/upload";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { oQueOPapelFaz } from "@/lib/auth/o-que-o-papel-faz";

type Perms = { invite: boolean; manage: boolean; suspend: boolean };

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  invited: "Convidado",
  suspended: "Suspenso",
};
const STATUS_TONE: Record<string, BadgeTone> = {
  active: "success",
  invited: "info",
  suspended: "danger",
};
const STATUS_DOT: Record<string, string> = {
  active: "bg-success",
  invited: "bg-info",
  suspended: "bg-danger",
};

function maxLevel(u: UserRow) {
  return u.memberships.reduce((max, m) => Math.max(max, m.role_level), 0);
}
function papelPrincipal(u: UserRow): Membership | null {
  return u.memberships.reduce<Membership | null>(
    (top, m) => (!top || m.role_level > top.role_level ? m : top),
    null,
  );
}
function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function Avatar({ url, size = "size-11" }: { url: string | null; size?: string }) {
  if (url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted`}>
      <UserRound className="size-1/2" />
    </span>
  );
}

/** Foto com UPLOAD (bucket `avatars`) + campo de URL como alternativa. */
function AvatarUpload({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);
  function escolher() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setEnviando(true);
      const url = await uploadAvatar(file);
      setEnviando(false);
      if (url) onChange(url);
      else toast.error("Falha ao enviar a foto.");
    };
    input.click();
  }
  return (
    <div className="flex items-center gap-3">
      <Avatar url={value || null} size="size-16" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={disabled || enviando} onClick={escolher}>
          <Upload className="size-4" /> {enviando ? "Enviando…" : "Enviar foto"}
        </Button>
        <input
          className={`${controlClass} h-8 text-xs`}
          placeholder="ou cole uma URL https://…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function InviteSubmit({ disabled, form }: { disabled?: boolean; form?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" form={form} loading={pending} loadingLabel="Convidando…" disabled={disabled}>
      Convidar
    </Button>
  );
}

/** Convite numa tela modal (Dialog), no mesmo padrão do painel do usuário. */
function InviteDialog({
  open,
  onClose,
  roles,
  spaces,
  actorLevel,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  roles: Role[];
  spaces: SpaceOption[];
  actorLevel: number;
  onDone: (msg: string) => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await inviteUser(prev, fd);
    if (res?.ok) onDone(res.ok);
    return res;
  }, undefined);
  const assignable = roles.filter((r) => r.level < actorLevel);
  const [papelConvite, setPapelConvite] = useState(assignable[0]?.key ?? "");
  /**
   * ESCOPO É ESCOLHA, NÃO OMISSÃO.
   *
   * O campo não existia: `actions.ts` lia `spaceId` do FormData, o formulário
   * nunca o enviava, e o membership nascia com `space_id = null` — que significa
   * TODAS as documentações. Convidar um "Editor" concedia edição no tenant
   * inteiro, e o diálogo não mencionava escopo em lugar nenhum.
   *
   * O bug cortava nos dois sentidos: com `spaceId` nulo, a linha
   * `requirePermission("user.invite", null)` passava a exigir permissão GLOBAL —
   * então um Gestor com escopo numa documentação não conseguia convidar nem
   * para a documentação dele.
   *
   * Nasce vazio de propósito. Um padrão aqui seria a mesma omissão com outra
   * roupa: quem não olha o campo continuaria concedendo o que não pretendia.
   */
  const [escopo, setEscopo] = useState("");
  const papelEscolhido = assignable.find((r) => r.key === papelConvite);
  const escopoGlobal = escopo === "__todas";
  const nomeDoEscopo = spaces.find((sp) => sp.id === escopo)?.name;
  const resumo = papelEscolhido ? oQueOPapelFaz(papelEscolhido.level) : null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="md"
      title="Convidar usuário"
      description="A pessoa recebe um e-mail para definir a senha e entrar."
    >
      <form id="form-convite" action={action} className="space-y-4">
        <Field label="E-mail" htmlFor="invite-email" required error={state?.error ?? null}>
          <Input
            id="invite-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="pessoa@natcorp.com.br"
          />
        </Field>
        <Field label="Papel" htmlFor="invite-role" required hint="Só papéis abaixo do seu nível aparecem aqui.">
          {/* O formulário é server action (FormData), e o Select é um botão — o
              hidden carrega o valor. Papéis customizados podem crescer, e aí o
              filtro por digitação aparece sozinho. */}
          <input type="hidden" name="roleKey" value={papelConvite} />
          <Select
            id="invite-role"
            value={papelConvite}
            onChange={setPapelConvite}
            className="h-10 w-full"
            aria-label="Papel do convite"
            options={assignable.map((r) => ({ value: r.key, label: r.name, hint: `nível ${r.level}` }))}
          />
        </Field>
        <Field
          label="Documentação"
          htmlFor="invite-space"
          required
          hint="Onde esta pessoa vai atuar. Dá para conceder mais acesso depois, no cartão dela."
        >
          <input type="hidden" name="spaceId" value={escopoGlobal ? "" : escopo} />
          <Select
            id="invite-space"
            value={escopo}
            onChange={setEscopo}
            className="h-10 w-full"
            aria-label="Documentação do convite"
            placeholder="Escolha uma documentação"
            options={[
              ...spaces.map((sp) => ({ value: sp.id, label: sp.name })),
              { value: "__todas", label: "Todas as documentações", hint: "acesso amplo" },
            ]}
          />
        </Field>

        {/* O acesso amplo continua possível — só deixa de ser o que acontece
            quando ninguém olha. Dito por extenso, com o papel no meio da frase,
            porque "todas as documentações" só assusta quando se sabe o que a
            pessoa poderá fazer nelas. */}
        {escopoGlobal && (
          <p
            role="alert"
            className="rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-xs text-warning"
          >
            <strong>{papelEscolhido?.name ?? "Este papel"}</strong> em <strong>todas</strong> as documentações —
            inclusive nas que forem criadas depois.
          </p>
        )}

        {/* A PRÉVIA — o que muda de fato quando este convite for aceito.
            O guia de papéis existe, mas mora no rodapé da página: informação
            que exige sair da tela para ser consultada não é consultada. Aqui
            ela aparece no momento da escolha, em verbos e não em chaves. */}
        {resumo && (
          <div className="space-y-2 rounded-lg border border-border bg-surface-2 px-4 py-3 text-xs">
            <p className="font-semibold text-text">
              {papelEscolhido?.name} {escopo && !escopoGlobal && <>em <strong>{nomeDoEscopo}</strong></>} poderá:
            </p>
            <ul className="space-y-0.5 text-text-muted">
              {resumo.pode.map((x) => (
                <li key={x} className="flex gap-1.5">
                  <Check className="mt-0.5 size-3 shrink-0 text-success" aria-hidden="true" />
                  {x}
                </li>
              ))}
              {resumo.naoPode?.map((x) => (
                <li key={x} className="flex gap-1.5">
                  <X className="mt-0.5 size-3 shrink-0 text-danger" aria-hidden="true" />
                  <span>Não {x}</span>
                </li>
              ))}
            </ul>
            {resumo.atencao && <p className="pt-1 font-medium text-warning">{resumo.atencao}</p>}
          </div>
        )}
      </form>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <InviteSubmit disabled={!escopo} form="form-convite" />
      </div>
    </Sheet>
  );
}

export function UsersManager({
  users,
  roles,
  authors,
  spaces,
  actorLevel,
  actorId,
  can,
}: {
  users: UserRow[];
  roles: Role[];
  authors: AuthorRow[];
  spaces: SpaceOption[];
  actorLevel: number;
  actorId: string | null;
  can: Perms;
}) {
  const toast = useToast();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = query.toLowerCase();
      const matchesQuery =
        !q ||
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.job_title?.toLowerCase().includes(q) ||
        u.author?.public_name.toLowerCase().includes(q);
      const matchesRole = !roleFilter || u.memberships.some((m) => m.role_key === roleFilter);
      const matchesStatus = !statusFilter || u.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [users, query, roleFilter, statusFilter]);

  const selected = selectedId ? users.find((u) => u.id === selectedId) ?? null : null;

  return (
    <div className="mt-6">
      {/* A contagem vinha de graça com o `Toolbar` e não existia aqui: filtrar
          120 pessoas para 3 sem dizer "3 de 120" esconde justamente o efeito do
          filtro. O `aria-live` do primitivo também anuncia a mudança. */}
      <Toolbar
        busca={
          <SearchInput
            value={query}
            onChange={setQuery}
            label="Buscar pessoas"
            placeholder="Buscar por nome, e-mail, cargo…"
            wrapperClassName="max-w-xs"
          />
        }
        filtros={
          <>
            <Select
              value={roleFilter}
              onChange={(v) => setRoleFilter(v)}
              className={`${controlClass} h-10 w-auto`}
              aria-label="Filtrar por papel"
            >
              <option value="">Todos os papéis</option>
              {roles.map((r) => (
                <option key={r.id} value={r.key}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Segmented
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "", label: "Todos" },
                { value: "active", label: "Ativo" },
                { value: "invited", label: "Convidado" },
                { value: "suspended", label: "Suspenso" },
              ]}
            />
          </>
        }
        total={filtered.length === users.length ? `${users.length}` : `${filtered.length} de ${users.length}`}
        acoes={
          can.invite ? (
            <Button onClick={() => setShowInvite(true)}>
              <UserPlus /> Convidar
            </Button>
          ) : undefined
        }
      />

      {can.invite && (
        <InviteDialog
          open={showInvite}
          onClose={() => setShowInvite(false)}
          roles={roles}
          spaces={spaces}
          actorLevel={actorLevel}
          onDone={(msg) => {
            toast.success(msg);
            setShowInvite(false);
            router.refresh();
          }}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState className="mt-6" icon={UserRound} title="Nenhum usuário" description="Nada corresponde aos filtros." />
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((u) => (
            <UserCard key={u.id} user={u} onOpen={() => setSelectedId(u.id)} />
          ))}
        </div>
      )}

      {selected && (
        <UserDrawer
          key={selected.id}
          user={selected}
          roles={roles}
          authors={authors}
          spaces={spaces}
          actorLevel={actorLevel}
          isSelf={selected.id === actorId}
          can={can}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function UserCard({ user, onOpen }: { user: UserRow; onOpen: () => void }) {
  const principal = papelPrincipal(user);
  const nome = user.full_name || user.email || "—";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col rounded-xl border border-border bg-surface p-4 text-left shadow-1 transition-colors hover:border-border-strong hover:bg-surface-2"
    >
      <div className="flex items-center gap-3">
        <Avatar url={user.avatar_url} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{nome}</p>
          <p className="truncate text-xs text-text-muted">
            {user.job_title || <span className="italic">sem cargo</span>}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {principal ? (
          <Badge tone="primary">{principal.role_name}</Badge>
        ) : (
          <span className="text-xs text-text-muted">sem papel</span>
        )}
        {user.memberships.length > 1 && (
          <span className="text-xs text-text-muted">+{user.memberships.length - 1} regra(s)</span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block size-2 rounded-full ${STATUS_DOT[user.status] ?? "bg-brand-gray-400"}`} />
          {STATUS_LABEL[user.status] ?? user.status}
        </span>
        {user.author && (
          <span className="flex items-center gap-1">
            <UserRound className="size-3.5" /> {user.author.artigos} art.
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Painel de UM usuário: identidade (foto/nome/cargo), REGRAS de acesso por
 * documentação/diretório, conta e perfil de autor. O servidor revalida cada
 * ação; a UI esconde o que o ator não pode fazer.
 */
function UserDrawer({
  user,
  roles,
  authors,
  spaces,
  actorLevel,
  isSelf,
  can,
  onClose,
}: {
  user: UserRow;
  roles: Role[];
  authors: AuthorRow[];
  spaces: SpaceOption[];
  actorLevel: number;
  isSelf: boolean;
  can: Perms;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [pending, start] = useTransition();

  const targetLevel = maxLevel(user);
  const canActOn = actorLevel > targetLevel;

  // Identidade
  const [nome, setNome] = useState(user.full_name ?? "");
  const [cargo, setCargo] = useState(user.job_title ?? "");
  const [foto, setFoto] = useState(user.avatar_url ?? "");

  // Nova regra de acesso
  const atribuiveis = roles.filter((r) => r.level < actorLevel);
  const [novoPapel, setNovoPapel] = useState(atribuiveis[0]?.key ?? "");
  const [novoEspaco, setNovoEspaco] = useState(spaces[0]?.id ?? "");
  const [novoNo, setNovoNo] = useState("");
  const [pastas, setPastas] = useState<{ id: string; title: string; depth: number }[]>([]);

  // Autor
  const a = user.author;
  const [aNome, setANome] = useState(a?.public_name ?? user.full_name ?? "");
  const [aSlug, setASlug] = useState(a?.slug ?? "");
  const [aAvatar, setAAvatar] = useState(a?.avatar_url ?? "");
  const [aBio, setABio] = useState(a?.bio ?? "");
  const [aAtivo, setAAtivo] = useState(a?.active ?? true);
  const [criandoAutor, setCriandoAutor] = useState(false);
  const [excluindoAutor, setExcluindoAutor] = useState(false);
  const [reatribuirPara, setReatribuirPara] = useState("");
  const temAutor = !!a;
  const mostrarFormAutor = temAutor || criandoAutor;

  function runUser(fn: () => Promise<ActionState>, aoOk?: () => void) {
    start(async () => {
      const res = await fn();
      if (res?.ok) {
        toast.success(res.ok);
        aoOk?.();
      } else if (res?.error) toast.error(res.error);
      router.refresh();
    });
  }
  function runAuthor(fn: () => Promise<AuthorActionResult>, aoOk?: () => void) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success("Perfil de autor salvo.");
        aoOk?.();
      } else toast.error(res.error);
      router.refresh();
    });
  }
  function carregarPastas(spaceId: string) {
    setNovoNo("");
    setPastas([]);
    if (!spaceId) return;
    start(async () => {
      const fs = await listSpaceFolders(spaceId);
      setPastas(fs);
    });
  }

  const outrosAutores = authors.filter((x) => x.id !== user.id);
  const secTitulo = "text-xs font-semibold uppercase tracking-wide text-text-muted";

  return (
    <Dialog
      open
      onClose={() => !pending && onClose()}
      size="lg"
      title={user.full_name || user.email || "Usuário"}
      description={user.full_name ? (user.email ?? undefined) : undefined}
      footer={
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Identidade */}
        <section>
          <h3 className={secTitulo}>Identidade</h3>
          <p className="mt-0.5 text-xs text-text-muted">Foto, nome e cargo — dado interno, separado do perfil de autor.</p>
          <fieldset disabled={!can.manage || pending} className="mt-3 space-y-3">
            <AvatarUpload value={foto} onChange={setFoto} disabled={!can.manage || pending} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome" htmlFor="id-nome">
                <Input id="id-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
              </Field>
              <Field label="Cargo" htmlFor="id-cargo">
                <Input id="id-cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Gerente de Suporte" />
              </Field>
            </div>
            {can.manage && (
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  runUser(() =>
                    updateProfileIdentity({
                      userId: user.id,
                      fullName: nome.trim() || null,
                      jobTitle: cargo.trim() || null,
                      avatarUrl: foto.trim() || null,
                    }),
                  )
                }
              >
                {pending ? "Salvando…" : "Salvar identidade"}
              </Button>
            )}
          </fieldset>
        </section>

        {/* Regras de acesso */}
        <section className="border-t border-border pt-5">
          <h3 className={secTitulo}>Regras de acesso</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            Cada regra = papel + documentação + diretório (opcional). Papel de <strong>edição</strong> restringe o que a
            pessoa edita; papel com <strong>aprovação</strong> restringe o que ela aprova. Sem diretório, vale a documentação
            inteira.
          </p>

          <ul className="mt-3 space-y-1.5">
            {user.memberships.length === 0 && (
              <li className="text-sm text-text-muted">Nenhuma regra — sem acesso a nenhuma documentação.</li>
            )}
            {user.memberships.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
              >
                <Badge tone="primary">{m.role_name}</Badge>
                <span className="min-w-0 flex-1 truncate text-text-muted">
                  {m.space_name ?? (m.space_id ? "documentação" : "todas as documentações")}
                  {m.node_id && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="inline-flex items-center gap-1 text-text">
                        <FolderTree className="size-3.5" />
                        {m.node_title ?? "diretório"}
                      </span>
                    </>
                  )}
                  {!m.node_id && m.space_id && " · toda a documentação"}
                </span>
                {can.manage && actorLevel > m.role_level && (
                  <button
                    type="button"
                    title="Remover regra"
                    disabled={pending}
                    onClick={() => runUser(() => removeMembershipRule(m.id))}
                    className="shrink-0 rounded p-1 text-text-muted hover:bg-surface-2 hover:text-brand-pink-700"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {can.manage && (
            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3">
              <Field label="Papel" htmlFor="rule-papel">
                <Select
                  id="rule-papel"
                  value={novoPapel}
                  onChange={(v) => setNovoPapel(v)}
                  className={`${controlClass} h-9 w-auto`}
                >
                  {atribuiveis.map((r) => (
                    <option key={r.id} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Documentação" htmlFor="rule-espaco">
                <Select
                  id="rule-espaco"
                  value={novoEspaco}
                  onChange={(v) => {
                    setNovoEspaco(v);
                    carregarPastas(v);
                  }}
                  className={`${controlClass} h-9 w-auto`}
                >
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Diretório (opcional)" htmlFor="rule-no">
                <Select
                  id="rule-no"
                  value={novoNo}
                  onChange={(v) => setNovoNo(v)}
                  className={`${controlClass} h-9 w-auto max-w-[14rem]`}
                >
                  <option value="">Toda a documentação</option>
                  {pastas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {" ".repeat(p.depth * 2)}
                      {p.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending || !novoPapel || !novoEspaco}
                onClick={() =>
                  runUser(
                    () =>
                      addMembershipRule({
                        userId: user.id,
                        roleKey: novoPapel,
                        spaceId: novoEspaco,
                        nodeId: novoNo || null,
                      }),
                    () => {
                      setNovoNo("");
                    },
                  )
                }
              >
                <Plus className="size-4" /> Adicionar
              </Button>
            </div>
          )}
        </section>

        {/* Conta */}
        <section className="border-t border-border pt-5">
          <h3 className={secTitulo}>Conta</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Badge tone={STATUS_TONE[user.status] ?? "neutral"}>{STATUS_LABEL[user.status] ?? user.status}</Badge>
            <span className="text-text-muted">
              Membro desde <span className="text-text">{fmtData(user.created_at)}</span>
            </span>
            <span className="text-text-muted">
              Visto por último <span className="text-text">{fmtData(user.last_seen_at)}</span>
            </span>
          </div>
          {isSelf ? (
            <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-text-muted">É você — ações de conta ficam com outro gestor.</p>
          ) : !canActOn ? (
            <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-text-muted">
              Este usuário tem nível ≥ ao seu — você não pode alterar a conta.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {can.suspend && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => runUser(() => setUserSuspended(user.id, user.status !== "suspended"))}
                >
                  {user.status === "suspended" ? "Reativar" : "Suspender"}
                </Button>
              )}
              {can.manage && (
                <>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => runUser(() => revokeSessions(user.id))}>
                    Revogar sessões
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-brand-pink-700"
                    disabled={pending}
                    onClick={async () => {
                      if (
                        await confirmar({
                          title: "Remover usuário",
                          description: `Remover ${user.email}? Esta ação não pode ser desfeita.`,
                          tone: "danger",
                          confirmLabel: "Remover",
                        })
                      )
                        runUser(() => removeUser(user.id), onClose);
                    }}
                  >
                    Remover
                  </Button>
                </>
              )}
            </div>
          )}
        </section>

        {/* Perfil público de autor */}
        <section className="border-t border-border pt-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className={secTitulo}>Perfil de autor</h3>
              <p className="mt-0.5 text-xs text-text-muted">
                O que o LEITOR vê nos artigos do portal.
                {temAutor && ` Assina ${a!.artigos} artigo${a!.artigos === 1 ? "" : "s"}.`}
              </p>
            </div>
            {!can.manage && <Badge tone="neutral">somente leitura</Badge>}
          </div>

          {!mostrarFormAutor ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-text-muted">Sem perfil de autor.</span>
              {can.manage && (
                <Button size="sm" variant="secondary" onClick={() => setCriandoAutor(true)}>
                  Criar perfil de autor
                </Button>
              )}
            </div>
          ) : (
            <fieldset disabled={!can.manage || pending} className="mt-3 space-y-3">
              <AvatarUpload value={aAvatar} onChange={setAAvatar} disabled={!can.manage || pending} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome público" htmlFor="autor-nome">
                  <Input id="autor-nome" value={aNome} onChange={(e) => setANome(e.target.value)} placeholder="Ex.: Equipe Natcorp" />
                </Field>
                <Field label="Slug" htmlFor="autor-slug" hint="URL do filtro no portal (?autor=…).">
                  <Input id="autor-slug" value={aSlug} onChange={(e) => setASlug(e.target.value)} placeholder="equipe-natcorp" />
                </Field>
              </div>
              <Field label="Bio" htmlFor="autor-bio">
                <textarea id="autor-bio" rows={2} maxLength={400} value={aBio} onChange={(e) => setABio(e.target.value)} className={controlClass} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={aAtivo} onChange={(e) => setAAtivo(e.target.checked)} className="accent-[var(--color-primary)]" />
                Ativo (aparece no portal)
              </label>

              {can.manage && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={pending || !aNome.trim()}
                    onClick={() =>
                      runAuthor(
                        () =>
                          saveAuthor({
                            userId: user.id,
                            publicName: aNome.trim(),
                            slug: aSlug.trim() || null,
                            avatarUrl: aAvatar.trim() || null,
                            bio: aBio.trim() || null,
                            active: aAtivo,
                          }),
                        () => setCriandoAutor(false),
                      )
                    }
                  >
                    {pending ? "Salvando…" : temAutor ? "Salvar perfil" : "Criar perfil"}
                  </Button>
                  {temAutor && !excluindoAutor && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-brand-pink-700"
                      disabled={pending}
                      onClick={() => {
                        setReatribuirPara("");
                        setExcluindoAutor(true);
                      }}
                    >
                      Excluir perfil
                    </Button>
                  )}
                  {criandoAutor && !temAutor && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => setCriandoAutor(false)}>
                      Cancelar
                    </Button>
                  )}
                </div>
              )}

              {excluindoAutor && a && (
                <div className="rounded-md border border-border bg-surface-2 p-3">
                  <p className="text-sm">
                    {a.artigos > 0
                      ? `"${a.public_name}" assina ${a.artigos} artigo(s). Escolha quem os herda.`
                      : "O perfil público será removido; o usuário continua existindo."}
                  </p>
                  {a.artigos > 0 && (
                    <Select value={reatribuirPara} onChange={(v) => setReatribuirPara(v)} className={`${controlClass} mt-2 h-9 w-full`}>
                      <option value="">Reatribuir artigos para…</option>
                      {outrosAutores.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.public_name}
                        </option>
                      ))}
                    </Select>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pending || (a.artigos > 0 && !reatribuirPara)}
                      onClick={() => runAuthor(() => deleteAuthor(user.id, reatribuirPara || null), () => setExcluindoAutor(false))}
                    >
                      {pending ? "Excluindo…" : "Excluir perfil"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => setExcluindoAutor(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </fieldset>
          )}
        </section>
      </div>
    </Dialog>
  );
}
