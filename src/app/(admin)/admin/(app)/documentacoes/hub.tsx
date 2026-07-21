"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  ExternalLink,
  Eye,
  FolderTree,
  Globe,
  KeyRound,
  Lock,
  Palette,
  Plus,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { SpaceInfo } from "@/lib/content/spaces";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { NewSpaceDialog } from "@/components/content/new-space-dialog";
import { useConfirm } from "@/components/ui/confirm";
import { deleteSpace, reindexSpaceEmbeddings } from "./actions";

export type DocResumo = {
  id: string;
  slug: string;
  name: string;
  type: "global" | "client";
  visibility: "public" | "private" | "password";
  publicados: number;
  rascunhos: number;
  emRevisao: number;
  pastas: number;
  chunksIndexados: number;
  canEdit: boolean;
  canDelete: boolean;
  /** Tem clientes herdando — a exclusão é travada até eles saírem. */
  temClientes: boolean;
  publicBase: string;
};

const VISIBILIDADE = {
  public: { rotulo: "Pública", Icon: Globe },
  password: { rotulo: "Com senha", Icon: KeyRound },
  private: { rotulo: "Privada", Icon: Lock },
} as const;

/** Atalho de área da documentação — todos os destinos já aceitam ?space=. */
function Atalho({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof Palette;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-text transition-colors hover:border-primary hover:text-primary"
    >
      <Icon className="size-4 text-text-muted" /> {children}
    </Link>
  );
}

export function DocsHub({
  docs,
  spaces,
  canCreate,
}: {
  docs: DocResumo[];
  /** Lista completa — o diálogo de criação precisa dela para herdar/copiar. */
  spaces: SpaceInfo[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const { confirmar } = useConfirm();
  const [criando, setCriando] = useState(false);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function excluir(doc: DocResumo) {
    const ok = await confirmar({
      title: `Excluir "${doc.name}"`,
      description:
        `Exclusão DEFINITIVA e irreversível: ${doc.publicados + doc.rascunhos + doc.emRevisao} artigo(s) com todas as versões, ` +
        `${doc.pastas} pasta(s), ${doc.chunksIndexados} trecho(s) indexado(s) (embeddings), os chatbots (chaves de widget), ` +
        "os arquivos da base do chatbot, as conversas e as imagens do Storage. A página pública sai do ar agora. " +
        "Só a trilha de auditoria permanece.",
      tone: "danger",
      confirmLabel: "Excluir definitivamente",
      typeToConfirm: doc.name,
    });
    if (!ok) return;
    setOcupado(doc.id);
    setMsg((m) => ({ ...m, [doc.id]: "Excluindo…" }));
    startTransition(async () => {
      const r = await deleteSpace(doc.id);
      setOcupado(null);
      if (!r.ok) setMsg((m) => ({ ...m, [doc.id]: r.error }));
      router.refresh();
    });
  }

  async function gerarEmbeddings(doc: DocResumo) {
    const total = doc.publicados + doc.rascunhos + doc.emRevisao;
    const ok = await confirmar({
      title: "Gerar embeddings",
      description: `Gerar embeddings dos ${total} artigo(s) de "${doc.name}"? Pode levar minutos.`,
      confirmLabel: "Gerar",
    });
    if (!ok) return;
    setOcupado(doc.id);
    setMsg((m) => ({ ...m, [doc.id]: "Gerando embeddings…" }));
    startTransition(async () => {
      const r = await reindexSpaceEmbeddings(doc.id);
      setOcupado(null);
      setMsg((m) => ({
        ...m,
        [doc.id]: r.ok ? `Embeddings gerados: ${r.count} artigo(s).` : r.error,
      }));
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Documentações</h1>
          <p className="mt-1 text-sm text-text-muted">
            Cada documentação com seu conteúdo, aparência, preferências e chatbot.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCriando(true)}>
            <Plus className="size-4" /> Nova documentação
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {docs.map((d) => {
          const vis = VISIBILIDADE[d.visibility];
          return (
            <Surface key={d.id} elevation={1} padding="lg" className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-tight">{d.name}</h2>
                  <p className="mt-0.5 truncate text-xs text-text-muted">/docs/{d.slug}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {d.type === "client" && <Badge tone="accent">Cliente</Badge>}
                  <Badge tone="neutral" className="inline-flex items-center gap-1">
                    <vis.Icon className="size-3" /> {vis.rotulo}
                  </Badge>
                </div>
              </div>

              <dl className="grid grid-cols-4 gap-2">
                {(
                  [
                    ["Publicados", d.publicados],
                    ["Rascunhos", d.rascunhos],
                    ["Em revisão", d.emRevisao],
                    ["Pastas", d.pastas],
                  ] as const
                ).map(([rotulo, n]) => (
                  <div key={rotulo} className="rounded-lg border border-border px-2.5 py-2">
                    <dt className="truncate text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted">
                      {rotulo}
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">{n}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5">
                <Sparkles className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 text-sm">
                  <strong className="font-medium tabular-nums">{d.chunksIndexados}</strong>{" "}
                  <span className="text-text-muted">
                    trecho(s) indexado(s) para busca semântica e IA
                  </span>
                </span>
                {d.canEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={ocupado === d.id}
                    onClick={() => gerarEmbeddings(d)}
                  >
                    {ocupado === d.id ? "Gerando…" : "Gerar embeddings"}
                  </Button>
                )}
              </div>
              {msg[d.id] && (
                <p role="status" className="-mt-2 text-xs text-text-muted">
                  {msg[d.id]}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Atalho href={`/admin/conteudo?space=${d.id}`} icon={FolderTree}>
                  Conteúdo
                </Atalho>
                <Atalho href={`/admin/aparencia?space=${d.id}`} icon={Palette}>
                  Aparência
                </Atalho>
                <Atalho href={`/admin/configuracoes?space=${d.id}`} icon={Settings}>
                  Preferências
                </Atalho>
                <Atalho href={`/admin/base-conhecimento?space=${d.id}`} icon={Database}>
                  Chatbot
                </Atalho>
                <Atalho href={`/admin/previa/${d.id}`} icon={Eye}>
                  Prévia
                </Atalho>
                {d.visibility === "public" && (
                  <a
                    href={d.publicBase}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-text transition-colors hover:border-primary hover:text-primary"
                  >
                    <ExternalLink className="size-4 text-text-muted" /> Abrir página
                  </a>
                )}
                {d.canDelete && (
                  <button
                    type="button"
                    disabled={ocupado === d.id || d.temClientes}
                    title={
                      d.temClientes
                        ? "Há documentações de cliente herdando desta — exclua-as primeiro."
                        : "Excluir esta documentação e TODOS os seus dados"
                    }
                    onClick={() => excluir(d)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-sm text-text-muted transition-colors hover:border-brand-pink-700/40 hover:text-brand-pink-700 disabled:opacity-40"
                  >
                    <Trash2 className="size-4" /> Excluir
                  </button>
                )}
              </div>
            </Surface>
          );
        })}
      </div>

      {criando && <NewSpaceDialog spaces={spaces} onClose={() => setCriando(false)} />}
    </div>
  );
}
