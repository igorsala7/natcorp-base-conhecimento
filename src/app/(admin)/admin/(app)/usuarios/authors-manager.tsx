"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";
import { deleteAuthor, saveAuthor, type AuthorRow } from "./author-actions";

type UserOption = { id: string; label: string };

const VAZIO = {
  userId: "",
  publicName: "",
  slug: "",
  avatarUrl: "",
  bio: "",
  active: true,
};

/**
 * Perfis PÚBLICOS de autor (padrão HubSpot): nome de exibição ≠ nome interno,
 * slug para o filtro `?autor=` do portal, avatar e bio. Excluir autor com
 * artigos exige reatribuição — artigo publicado não fica órfão.
 */
export function AuthorsManager({
  authors,
  users,
  canManage,
}: {
  authors: AuthorRow[];
  users: UserOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<typeof VAZIO | null>(null);
  const [ehNovo, setEhNovo] = useState(false);
  const [excluindo, setExcluindo] = useState<AuthorRow | null>(null);
  const [reatribuirPara, setReatribuirPara] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const semPerfil = users.filter((u) => !authors.some((a) => a.id === u.id));

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, aoOk?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success("Feito.");
        aoOk?.();
      } else {
        toast.error(r.error ?? "Falha.");
      }
      router.refresh();
    });
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Autores</h2>
          <p className="text-sm text-text-muted">
            Perfil público exibido nos artigos do portal — separado do cadastro interno.
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEhNovo(true);
              setEditando({ ...VAZIO, userId: semPerfil[0]?.id ?? "" });
            }}
            disabled={semPerfil.length === 0}
            title={semPerfil.length === 0 ? "Todos os usuários já têm perfil de autor" : undefined}
          >
            <Plus className="size-4" /> Novo autor
          </Button>
        )}
      </div>


      {authors.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={UserRound}
          title="Nenhum perfil de autor ainda"
          description="Crie um para o nome aparecer nos artigos publicados."
        />
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
          {authors.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              {a.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.avatar_url} alt="" className="size-9 rounded-full object-cover" />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-text-muted">
                  <UserRound className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {a.public_name}
                  {!a.active && (
                    <Badge tone="neutral" className="ml-2">
                      Inativo
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-text-muted">
                  /{a.slug} · {a.artigos} artigo{a.artigos === 1 ? "" : "s"}
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEhNovo(false);
                      setEditando({
                        userId: a.id,
                        publicName: a.public_name,
                        slug: a.slug,
                        avatarUrl: a.avatar_url ?? "",
                        bio: a.bio ?? "",
                        active: a.active,
                      });
                    }}
                  >
                    <PenLine className="size-4" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-brand-pink-700"
                    onClick={() => {
                      setReatribuirPara("");
                      setExcluindo(a);
                    }}
                  >
                    Excluir
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Criar/editar perfil */}
      <Dialog
        open={!!editando}
        onClose={() => !pending && setEditando(null)}
        title={ehNovo ? "Novo autor" : "Editar autor"}
        description="O que o LEITOR vê: nome público, avatar e bio."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditando(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              disabled={pending || !editando?.userId || !editando?.publicName.trim()}
              onClick={() =>
                editando &&
                run(
                  () =>
                    saveAuthor({
                      userId: editando.userId,
                      publicName: editando.publicName.trim(),
                      slug: editando.slug.trim() || null,
                      avatarUrl: editando.avatarUrl.trim() || null,
                      bio: editando.bio.trim() || null,
                      active: editando.active,
                    }),
                  () => setEditando(null),
                )
              }
            >
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </>
        }
      >
        {editando && (
          <div className="space-y-4">
            {ehNovo && (
              <Field label="Usuário" htmlFor="autor-usuario">
                <select
                  id="autor-usuario"
                  value={editando.userId}
                  onChange={(e) => setEditando({ ...editando, userId: e.target.value })}
                  className={`${controlClass} h-10`}
                >
                  {semPerfil.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Nome público" htmlFor="autor-nome">
              <Input
                id="autor-nome"
                value={editando.publicName}
                onChange={(e) => setEditando({ ...editando, publicName: e.target.value })}
                placeholder="Ex.: Equipe Natcorp"
                autoFocus
              />
            </Field>
            <Field
              label="Slug"
              htmlFor="autor-slug"
              hint="URL do filtro no portal (?autor=…). Vazio deriva do nome."
            >
              <Input
                id="autor-slug"
                value={editando.slug}
                onChange={(e) => setEditando({ ...editando, slug: e.target.value })}
                placeholder="equipe-natcorp"
              />
            </Field>
            <Field label="Avatar (URL https)" htmlFor="autor-avatar">
              <Input
                id="autor-avatar"
                value={editando.avatarUrl}
                onChange={(e) => setEditando({ ...editando, avatarUrl: e.target.value })}
                placeholder="https://…/foto.png"
              />
            </Field>
            <Field label="Bio" htmlFor="autor-bio">
              <textarea
                id="autor-bio"
                rows={3}
                maxLength={400}
                value={editando.bio}
                onChange={(e) => setEditando({ ...editando, bio: e.target.value })}
                className={controlClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editando.active}
                onChange={(e) => setEditando({ ...editando, active: e.target.checked })}
                className="accent-[var(--color-primary)]"
              />
              Ativo (aparece no portal)
            </label>
          </div>
        )}
      </Dialog>

      {/* Excluir com reatribuição obrigatória quando há artigos */}
      <Dialog
        open={!!excluindo}
        onClose={() => !pending && setExcluindo(null)}
        title="Excluir autor"
        description={
          excluindo && excluindo.artigos > 0
            ? `"${excluindo.public_name}" assina ${excluindo.artigos} artigo(s). Escolha quem os herda.`
            : "O perfil público é removido; o usuário continua existindo."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setExcluindo(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={pending || (!!excluindo && excluindo.artigos > 0 && !reatribuirPara)}
              onClick={() =>
                excluindo &&
                run(
                  () => deleteAuthor(excluindo.id, reatribuirPara || null),
                  () => setExcluindo(null),
                )
              }
            >
              {pending ? "Excluindo…" : "Excluir"}
            </Button>
          </>
        }
      >
        {excluindo && excluindo.artigos > 0 && (
          <Field label="Reatribuir artigos para" htmlFor="autor-reatribuir">
            <select
              id="autor-reatribuir"
              value={reatribuirPara}
              onChange={(e) => setReatribuirPara(e.target.value)}
              className={`${controlClass} h-10`}
            >
              <option value="">Escolha um autor…</option>
              {authors
                .filter((a) => a.id !== excluindo.id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.public_name}
                  </option>
                ))}
            </select>
          </Field>
        )}
      </Dialog>
    </section>
  );
}
