"use client";

import { useEffect, useState, useTransition } from "react";
import type { TreeNode } from "@/lib/content/tree";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { IconPicker } from "@/components/editor/blocks/icon-picker";
import {
  changeSlug,
  renameNode,
  updateNodeMeta,
} from "@/app/(admin)/admin/(app)/conteudo/actions";
import {
  createTag,
  getNodeTagsAndAuthor,
  listTags,
  setNodeAuthor,
  setNodeTags,
  type TagInfo,
} from "@/app/(admin)/admin/(app)/conteudo/tag-actions";
import { listAuthors, type AuthorRow } from "@/app/(admin)/admin/(app)/usuarios/author-actions";

/**
 * Propriedades de um nó da árvore: nome, slug, ícone e descrição.
 *
 * Substitui os `prompt()` de renomear/slug por um lugar só. Cada campo salva
 * pela action que já existia (renomear, slug com redirect 301, meta) — nada de
 * caminho novo de escrita.
 */
export function NodePropertiesDialog({
  node,
  onClose,
  onDone,
}: {
  node: TreeNode;
  onClose: () => void;
  onDone: (message: string | null) => void;
}) {
  const [title, setTitle] = useState(node.title);
  const [slug, setSlug] = useState(node.slug);
  const [icon, setIcon] = useState<string | undefined>(node.icon ?? undefined);
  const [description, setDescription] = useState(node.description ?? "");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const ehPasta = node.type === "folder";
  const ehArtigo = node.type === "article";

  // Tags e autor (só artigo): carregados ao abrir; null = ainda carregando —
  // sem isso, salvar antes da carga APAGARIA as tags existentes.
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [authors, setAuthors] = useState<AuthorRow[]>([]);
  const [tagIds, setTagIds] = useState<Set<string> | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [novaTag, setNovaTag] = useState("");

  useEffect(() => {
    if (!ehArtigo) return;
    let alive = true;
    void Promise.all([
      listTags(node.space_id),
      listAuthors(),
      getNodeTagsAndAuthor(node.id),
    ]).then(([t, a, atual]) => {
      if (!alive) return;
      setTags(t);
      setAuthors(a.filter((x) => x.active || x.id === atual.authorId));
      setTagIds(new Set(atual.tagIds));
      setAuthorId(atual.authorId);
    });
    return () => {
      alive = false;
    };
  }, [ehArtigo, node.id, node.space_id]);

  function salvar() {
    startTransition(async () => {
      // Sequencial de propósito: cada action revalida e audita por conta
      // própria; paralelizar faria duas escritas disputarem o mesmo nó.
      if (title.trim() && title.trim() !== node.title) {
        const r = await renameNode(node.id, title.trim());
        if (!r.ok) return toast.error(r.error);
      }
      if (slug.trim() && slug.trim() !== node.slug) {
        const r = await changeSlug(node.id, slug.trim());
        if (!r.ok) return toast.error(r.error);
      }
      const novoIcone = icon ?? null;
      const novaDescricao = description.trim() || null;
      if (novoIcone !== node.icon || novaDescricao !== node.description) {
        const r = await updateNodeMeta(node.id, {
          icon: novoIcone,
          description: novaDescricao,
        });
        if (!r.ok) return toast.error(r.error);
      }
      if (ehArtigo && tagIds !== null) {
        const rt = await setNodeTags(node.id, [...tagIds]);
        if (!rt.ok) return toast.error(rt.error);
        const ra = await setNodeAuthor(node.id, authorId);
        if (!ra.ok) return toast.error(ra.error);
      }
      onDone(null);
      onClose();
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Propriedades"
      description={ehPasta ? "Pasta (categoria da documentação)" : "Artigo"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={pending || !title.trim()}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome" htmlFor="prop-nome">
          <Input
            id="prop-nome"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>

        <Field
          label="Slug (URL)"
          htmlFor="prop-slug"
          hint="Mudar o slug cria um redirect 301 — links já compartilhados continuam funcionando."
        >
          <Input
            id="prop-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </Field>

        <Field
          label="Ícone"
          htmlFor="prop-icone"
          hint={
            ehPasta
              ? "Aparece no card da categoria na home pública."
              : "Aparece no card do artigo quando ele está solto na home."
          }
        >
          <IconPicker value={icon} onChange={setIcon} />
        </Field>

        <Field
          label="Descrição"
          htmlFor="prop-descricao"
          hint="Uma linha sobre o que há aqui — exibida no card da home pública."
        >
          <textarea
            id="prop-descricao"
            rows={2}
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={ehPasta ? "Ex.: Guias de faturamento e emissão de notas." : ""}
            className={controlClass}
          />
        </Field>

        {ehArtigo && (
          <>
            <Field
              label="Tags"
              htmlFor="prop-nova-tag"
              hint="Etiquetas transversais — o leitor filtra por elas no portal."
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {tags.map((t) => {
                  const ativa = tagIds?.has(t.id) ?? false;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={ativa}
                      disabled={tagIds === null}
                      onClick={() =>
                        setTagIds((prev) => {
                          const next = new Set(prev ?? []);
                          if (next.has(t.id)) next.delete(t.id);
                          else next.add(t.id);
                          return next;
                        })
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        ativa
                          ? "border-primary bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40"
                          : "border-border text-text-muted hover:border-primary hover:text-primary"
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
                <input
                  id="prop-nova-tag"
                  value={novaTag}
                  onChange={(e) => setNovaTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const nome = novaTag.trim();
                    if (!nome) return;
                    setNovaTag("");
                    // Criação inline (padrão HubSpot): cria e já marca.
                    void createTag(node.space_id, nome).then(async (r) => {
                      if (!r.ok) return toast.error(r.error);
                      const lista = await listTags(node.space_id);
                      setTags(lista);
                      if (r.id) setTagIds((prev) => new Set([...(prev ?? []), r.id!]));
                    });
                  }}
                  placeholder="+ nova tag (Enter)"
                  className="h-7 w-36 rounded-full border border-dashed border-border bg-transparent px-2.5 text-xs focus:border-primary focus:outline-none"
                />
              </div>
            </Field>

            <Field
              label="Autor"
              htmlFor="prop-autor"
              hint="Perfil público exibido no artigo. Cadastre autores em Usuários."
            >
              <select
                id="prop-autor"
                value={authorId ?? ""}
                disabled={tagIds === null}
                onChange={(e) => setAuthorId(e.target.value || null)}
                className={`${controlClass} h-10`}
              >
                <option value="">Sem autor</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.public_name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </div>
    </Dialog>
  );
}
