"use client";

import { useState, useTransition } from "react";
import type { TreeNode } from "@/lib/content/tree";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";
import { IconPicker } from "@/components/editor/blocks/icon-picker";
import {
  changeSlug,
  renameNode,
  updateNodeMeta,
} from "@/app/(admin)/admin/(app)/conteudo/actions";

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
  const [error, setError] = useState<string | null>(null);

  const ehPasta = node.type === "folder";

  function salvar() {
    setError(null);
    startTransition(async () => {
      // Sequencial de propósito: cada action revalida e audita por conta
      // própria; paralelizar faria duas escritas disputarem o mesmo nó.
      if (title.trim() && title.trim() !== node.title) {
        const r = await renameNode(node.id, title.trim());
        if (!r.ok) return setError(r.error);
      }
      if (slug.trim() && slug.trim() !== node.slug) {
        const r = await changeSlug(node.id, slug.trim());
        if (!r.ok) return setError(r.error);
      }
      const novoIcone = icon ?? null;
      const novaDescricao = description.trim() || null;
      if (novoIcone !== node.icon || novaDescricao !== node.description) {
        const r = await updateNodeMeta(node.id, {
          icon: novoIcone,
          description: novaDescricao,
        });
        if (!r.ok) return setError(r.error);
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

        {error && (
          <p role="alert" className="rounded-md bg-brand-pink-50 px-3 py-2 text-sm text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
