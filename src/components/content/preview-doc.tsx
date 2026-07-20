"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, FileText, Pencil, Upload } from "lucide-react";
import { RenderBlocks } from "@/lib/blocks/render";
import type { Block } from "@/lib/blocks/schema";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { InlineArticleEditor } from "@/components/content/inline-article-editor";
import { publishPendingDrafts } from "@/app/(admin)/admin/(app)/conteudo/article-actions";
import { ancoraDePrevia } from "@/lib/content/preview-anchor";
import type { PreviewNode, PreviewArticle } from "@/lib/content/preview";

const STATUS: Record<string, { rotulo: string; tom: BadgeTone }> = {
  draft: { rotulo: "Rascunho", tom: "warning" },
  review: { rotulo: "Em revisão", tom: "info" },
  published: { rotulo: "Publicado", tom: "neutral" },
};

const ancora = (n: PreviewNode) => ancoraDePrevia(n.id);

type Item = { node: PreviewNode; depth: number };

/** Ordem de leitura: pasta, depois tudo o que vive dentro dela. */
function percorrer(nodes: PreviewNode[], depth = 0): Item[] {
  return nodes.flatMap((node) =>
    node.type === "divider" || node.type === "link"
      ? []
      : [{ node, depth }, ...percorrer(node.children, depth + 1)],
  );
}

export function PreviewDoc({
  spaceId,
  spaceName,
  spaceSlug,
  tree,
  conteudos,
  snippets,
  editavel,
  edicaoInicial,
}: {
  spaceId: string;
  spaceName: string;
  spaceSlug: string;
  tree: PreviewNode[];
  /** Arrays, não Map: atravessam a fronteira servidor→cliente sem depender do
   *  suporte a Map na serialização do RSC. Remontados em Map logo abaixo. */
  conteudos: [string, PreviewArticle][];
  snippets: [string, Block[]][];
  /** O usuário tem `content.edit` neste espaço. */
  editavel: boolean;
  /** Veio com `?edit=1` (atalho do portal ou link direto). */
  edicaoInicial: boolean;
}) {
  const conteudosMap = useMemo(() => new Map(conteudos), [conteudos]);
  const snippetsMap = useMemo(() => new Map(snippets), [snippets]);
  const itens = percorrer(tree);
  const artigos = itens.filter((i) => i.node.type === "article");
  const naoPublicados = itens.filter((i) => i.node.status !== "published").length;

  const [modoEdicao, setModoEdicao] = useState(editavel && edicaoInicial);
  /** Qual artigo está aberto para edição — um por vez: montar N editores numa
   *  documentação inteira derrubaria a página. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  /** Rascunhos pendentes, semeado do servidor e atualizado ao salvar. */
  const [rascunhos, setRascunhos] = useState<Set<string>>(
    () => new Set(artigos.filter((a) => conteudosMap.get(a.node.id)?.hasDraft).map((a) => a.node.id)),
  );
  const [publicando, setPublicando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const comRascunho = rascunhos.size;

  async function publicarPendentes() {
    if (!confirm(`Publicar ${comRascunho} alteração(ões) pendente(s)? O site público muda agora.`))
      return;
    setPublicando(true);
    const res = await publishPendingDrafts(spaceId);
    setPublicando(false);
    if (!res.ok) return setAviso(res.error);
    setRascunhos(new Set());
    setAviso(`${res.count} artigo(s) publicado(s).`);
  }

  return (
    <div className="mx-auto max-w-[90rem]">
      {/* Faixa de contexto: sem ela é fácil confundir a prévia com o site no ar
          e concluir que algo já está público quando não está. */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-purple-200 bg-brand-purple-50/60 px-4 py-3 dark:border-brand-purple-900 dark:bg-brand-purple-950/30">
        <Eye className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">Prévia — não é o que o público vê.</span>{" "}
          <span className="text-text-muted">
            Inclui rascunhos e itens nunca publicados
            {comRascunho > 0 && `, e mostra a edição pendente de ${comRascunho} artigo(s)`}.
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {naoPublicados > 0 && <Badge tone="warning">{naoPublicados} fora do ar</Badge>}
          <Link
            href={`/docs/${spaceSlug}`}
            target="_blank"
            rel="noopener"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Ver o site publicado
          </Link>
        </div>
      </div>

      {editavel && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5">
          <Button
            size="sm"
            variant={modoEdicao ? "primary" : "secondary"}
            aria-pressed={modoEdicao}
            onClick={() => {
              setModoEdicao((v) => !v);
              setEditandoId(null);
            }}
          >
            <Pencil className="size-4" /> {modoEdicao ? "Editando" : "Editar aqui"}
          </Button>
          <span className="text-sm text-text-muted">
            {modoEdicao
              ? "Clique em Editar no artigo. As alterações viram rascunho — o site só muda ao publicar."
              : "Corrija vários artigos sem sair da leitura."}
          </span>
          {comRascunho > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <Badge tone="primary">
                {comRascunho} pendente{comRascunho === 1 ? "" : "s"}
              </Badge>
              <Button size="sm" onClick={publicarPendentes} disabled={publicando}>
                <Upload className="size-4" />
                {publicando ? "Publicando…" : "Publicar alterações pendentes"}
              </Button>
            </div>
          )}
        </div>
      )}

      {aviso && (
        <p role="status" className="mt-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
          {aviso}
        </p>
      )}

      <div className="mt-8 flex gap-10">
        {/* Índice: âncoras na MESMA página — nenhum destes nós tem URL pública
            enquanto estiver fora do ar, então link para /docs quebraria. */}
        {itens.length > 0 && (
          <aside className="hidden w-64 shrink-0 lg:block">
            <nav
              aria-label="Índice da prévia"
              className="sticky top-4 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-2 text-sm"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                {spaceName}
              </p>
              <ul>
                {itens.map(({ node, depth }) => (
                  <li key={node.id}>
                    <a
                      href={`#${ancora(node)}`}
                      style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
                      className={`flex items-center gap-1.5 rounded-sm py-1.5 pr-2 leading-snug transition-colors hover:bg-surface-2 ${
                        node.type === "folder" ? "font-medium text-text" : "text-text-muted"
                      }`}
                    >
                      <span className="truncate">{node.title}</span>
                      {node.status !== "published" && (
                        <span
                          aria-label={STATUS[node.status]?.rotulo}
                          title={STATUS[node.status]?.rotulo}
                          className="size-1.5 shrink-0 rounded-full bg-amber-500"
                        />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}

        <main className="min-w-0 flex-1">
          <h1 className="text-[length:var(--text-3xl)] font-semibold leading-tight">{spaceName}</h1>
          <p className="mt-2 text-sm text-text-muted">
            {artigos.length} {artigos.length === 1 ? "artigo" : "artigos"} em leitura contínua.
          </p>

          {itens.length === 0 ? (
            <EmptyState
              className="mt-8"
              icon={FileText}
              title="Esta documentação está vazia"
              description="Crie um diretório ou artigo na árvore para ver a prévia aqui."
            />
          ) : (
            itens.map(({ node, depth }) => {
              const info = STATUS[node.status];
              const selo = node.status !== "published" && info && (
                <Badge tone={info.tom}>{info.rotulo}</Badge>
              );

              if (node.type === "folder") {
                return (
                  <section
                    key={node.id}
                    id={ancora(node)}
                    className={
                      depth === 0
                        ? "mt-16 scroll-mt-6 border-t border-border pt-10 first:mt-10 first:border-0 first:pt-0"
                        : "mt-12 scroll-mt-6"
                    }
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
                        Seção
                      </p>
                      {selo}
                    </div>
                    <h2
                      className={
                        depth === 0
                          ? "mt-1.5 text-[length:var(--text-3xl)] font-semibold leading-tight"
                          : "mt-1.5 text-[length:var(--text-2xl)] font-semibold leading-tight"
                      }
                    >
                      {node.title}
                    </h2>
                  </section>
                );
              }

              const artigo = conteudosMap.get(node.id);
              return (
                // `previa-alvo` + :target destaca o artigo que veio do link do
                // editor. CSS puro: numa página longa, chegar via âncora sem
                // sinal nenhum deixa a dúvida de "caí no artigo certo?".
                <section
                  key={node.id}
                  id={ancora(node)}
                  className="previa-alvo mt-12 scroll-mt-6"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[length:var(--text-2xl)] font-semibold leading-tight">
                      {node.title}
                    </h3>
                    {selo}
                    {rascunhos.has(node.id) && <Badge tone="primary">Edição pendente</Badge>}
                    <div className="ml-auto flex items-center gap-3">
                      {modoEdicao && editandoId !== node.id && (
                        <Button size="sm" variant="secondary" onClick={() => setEditandoId(node.id)}>
                          <Pencil className="size-4" /> Editar
                        </Button>
                      )}
                      <Link
                        href={`/admin/conteudo/${node.id}`}
                        className="text-xs text-primary underline-offset-4 hover:underline"
                      >
                        Editor completo
                      </Link>
                    </div>
                  </div>

                  {modoEdicao && editandoId === node.id ? (
                    <div className="mt-5">
                      <InlineArticleEditor
                        // key pelo nó: trocar de artigo remonta o editor com o
                        // conteúdo certo, sem estado vazando entre eles.
                        key={node.id}
                        nodeId={node.id}
                        spaceId={spaceId}
                        blocosIniciais={artigo?.blocks ?? []}
                        hasDraftInicial={rascunhos.has(node.id)}
                        onDraft={(tem) =>
                          setRascunhos((prev) => {
                            if (prev.has(node.id) === tem) return prev;
                            const next = new Set(prev);
                            if (tem) next.add(node.id);
                            else next.delete(node.id);
                            return next;
                          })
                        }
                        onFechar={() => setEditandoId(null)}
                      />
                    </div>
                  ) : artigo && artigo.blocks.length > 0 ? (
                    // headingShift=2 pelo mesmo motivo do portal: o H1 do
                    // conteúdo tem de ficar abaixo do título do artigo.
                    <div className="prose prose-neutral prose-portal mt-5 max-w-none dark:prose-invert">
                      <RenderBlocks
                        blocks={artigo.blocks}
                        snippets={snippetsMap}
                        idPrefix={`${ancora(node)}--`}
                        headingShift={2}
                      />
                    </div>
                  ) : (
                    <p className="mt-4 text-sm italic text-text-muted">Artigo sem conteúdo.</p>
                  )}
                </section>
              );
            })
          )}

          <div className="mt-16 border-t border-border pt-6">
            <Link
              href="/admin/conteudo"
              className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
            >
              <ArrowLeft className="size-4" /> Voltar para a árvore
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
