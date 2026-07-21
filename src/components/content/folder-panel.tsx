"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Folder,
  Palette,
  Sparkles,
} from "lucide-react";
import { ICONS } from "@/lib/blocks/icons";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Field } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";
import { IconPicker } from "@/components/editor/blocks/icon-picker";
import {
  changeSlug,
  renameNode,
  updateNodeMeta,
} from "@/app/(admin)/admin/(app)/conteudo/actions";
import {
  publishSubtree,
  reindexSubtreeEmbeddings,
} from "@/app/(admin)/admin/(app)/conteudo/article-actions";

export type FolderStats = {
  publicados: number;
  rascunhos: number;
  emRevisao: number;
  pastas: number;
};

/**
 * Tela da PASTA na área de edição — o que abre ao clicar num diretório na
 * árvore. É onde o ícone e a descrição do diretório (o par que os cards da
 * home pública exibem) deixam de morar só no diálogo do lápis.
 *
 * Mesmo trio de actions do NodePropertiesDialog: nada de caminho novo de
 * escrita, só uma superfície nova.
 */
export function FolderPanel({
  node,
  stats,
  isRoot,
  publicUrl,
  spaceId,
  canEdit,
  canPublish,
}: {
  node: {
    id: string;
    title: string;
    slug: string;
    icon: string | null;
    description: string | null;
  };
  stats: FolderStats;
  /** Diretório raiz: o card da home pública usa este ícone/descrição. */
  isRoot: boolean;
  /** URL pública da seção — só quando publicada e o espaço é público. */
  publicUrl?: string;
  spaceId: string;
  canEdit: boolean;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(node.title);
  const [slug, setSlug] = useState(node.slug);
  const [icon, setIcon] = useState<string | undefined>(node.icon ?? undefined);
  const [description, setDescription] = useState(node.description ?? "");
  const [salvando, startSalvar] = useTransition();
  const [agindo, startAgir] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const sujo =
    title.trim() !== node.title ||
    slug.trim() !== node.slug ||
    (icon ?? null) !== node.icon ||
    (description.trim() || null) !== node.description;

  function salvar() {
    setMsg(null);
    startSalvar(async () => {
      // Sequencial: cada action revalida e audita por conta própria.
      if (title.trim() && title.trim() !== node.title) {
        const r = await renameNode(node.id, title.trim());
        if (!r.ok) return setMsg(r.error);
      }
      if (slug.trim() && slug.trim() !== node.slug) {
        const r = await changeSlug(node.id, slug.trim());
        if (!r.ok) return setMsg(r.error);
      }
      const novoIcone = icon ?? null;
      const novaDescricao = description.trim() || null;
      if (novoIcone !== node.icon || novaDescricao !== node.description) {
        const r = await updateNodeMeta(node.id, { icon: novoIcone, description: novaDescricao });
        if (!r.ok) return setMsg(r.error);
      }
      setMsg("Salvo.");
      router.refresh();
    });
  }

  function publicarTudo() {
    if (!confirm(`Publicar "${node.title}" e TODOS os artigos dentro?`)) return;
    setMsg(null);
    startAgir(async () => {
      const r = await publishSubtree(node.id);
      setMsg(r.ok ? "Publicado — a seção já aparece no portal." : r.error);
      router.refresh();
    });
  }

  function gerarEmbeddings() {
    if (
      !confirm(`Gerar embeddings de TODOS os artigos dentro de "${node.title}" (todos os níveis)?`)
    )
      return;
    setMsg("Gerando embeddings…");
    startAgir(async () => {
      const r = await reindexSubtreeEmbeddings(node.id);
      setMsg(r.ok ? `Embeddings gerados: ${r.count} artigo(s).` : r.error);
    });
  }

  const IconePreview = (icon && ICONS[icon]) || Folder;
  const artigos = stats.publicados + stats.rascunhos + stats.emRevisao;

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-1">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40">
          <IconePreview className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{node.title}</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {isRoot ? "Diretório raiz" : "Diretório"} · {artigos} artigo(s) · {stats.pastas}{" "}
            subpasta(s)
          </p>
        </div>
        {publicUrl && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-text-muted transition-colors hover:border-primary hover:text-primary"
          >
            <ExternalLink className="size-4" /> Ver no portal
          </a>
        )}
      </div>

      {isRoot && (
        <Surface elevation={1} padding="lg" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              Card na home pública
            </h2>
            <a
              href={`/admin/aparencia?space=${spaceId}`}
              className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
            >
              <Palette className="size-3.5" /> Aparência
            </a>
          </div>
          <p className="text-sm leading-relaxed text-text-muted">
            Diretórios raiz viram os cards de categoria da home. O ícone e a descrição abaixo são
            exatamente o que o leitor vê:
          </p>
          {/* Mini-preview do card (estilo "blocos" da home). */}
          <div className="flex max-w-xs flex-col items-center gap-2.5 rounded-xl border border-border bg-bg px-5 py-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40">
              <IconePreview className="size-5" />
            </span>
            <span className="font-semibold leading-snug">{title.trim() || node.title}</span>
            <span className="text-[0.8125rem] leading-relaxed text-text-muted">
              {description.trim() || `${artigos} artigo(s)`}
            </span>
          </div>
        </Surface>
      )}

      <Surface elevation={1} padding="lg" className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Propriedades
        </h2>
        <Field label="Nome" htmlFor="pasta-nome">
          <Input
            id="pasta-nome"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Ícone"
            htmlFor="pasta-icone"
            hint={isRoot ? "Aparece no card da home." : "Aparece nos cards e listas do portal."}
          >
            <IconPicker value={icon} onChange={canEdit ? setIcon : () => {}} />
          </Field>
          <Field
            label="Slug (URL)"
            htmlFor="pasta-slug"
            hint="Mudar cria um redirect 301 — links antigos seguem funcionando."
          >
            <Input
              id="pasta-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </div>
        <Field
          label="Descrição"
          htmlFor="pasta-descricao"
          hint="Uma linha sobre o que há aqui — exibida no card da home pública."
        >
          <textarea
            id="pasta-descricao"
            rows={2}
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Guias de faturamento e emissão de notas."
            className={controlClass}
            disabled={!canEdit}
          />
        </Field>
        {canEdit && (
          <div className="flex items-center gap-3">
            <Button onClick={salvar} disabled={salvando || !sujo || !title.trim()}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
            {sujo && (
              <Button
                variant="ghost"
                disabled={salvando}
                onClick={() => {
                  setTitle(node.title);
                  setSlug(node.slug);
                  setIcon(node.icon ?? undefined);
                  setDescription(node.description ?? "");
                }}
              >
                Descartar
              </Button>
            )}
          </div>
        )}
      </Surface>

      <Surface elevation={1} padding="lg" className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Conteúdo desta seção
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Publicados", stats.publicados],
              ["Rascunhos", stats.rascunhos],
              ["Em revisão", stats.emRevisao],
              ["Subpastas", stats.pastas],
            ] as const
          ).map(([rotulo, n]) => (
            <div key={rotulo} className="rounded-lg border border-border px-3 py-2.5">
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted">
                {rotulo}
              </dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>
        <p className="flex items-start gap-2 text-sm text-text-muted">
          <FileText className="mt-0.5 size-4 shrink-0" />
          Os artigos e subpastas são editados pela árvore ao lado.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {canPublish && (
            <Button variant="secondary" size="sm" onClick={publicarTudo} disabled={agindo}>
              <CheckCircle2 className="size-4" /> Publicar tudo
            </Button>
          )}
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={gerarEmbeddings} disabled={agindo}>
              <Sparkles className="size-4" /> Gerar embeddings
            </Button>
          )}
        </div>
      </Surface>

      {msg && (
        <p role="status" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
          {msg}
        </p>
      )}
    </div>
  );
}
