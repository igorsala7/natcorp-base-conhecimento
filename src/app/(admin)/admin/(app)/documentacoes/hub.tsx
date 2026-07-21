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
} from "lucide-react";
import type { SpaceInfo } from "@/lib/content/spaces";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { NewSpaceDialog } from "@/components/content/new-space-dialog";
import { reindexSpaceEmbeddings } from "./actions";

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
  const [criando, setCriando] = useState(false);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function gerarEmbeddings(doc: DocResumo) {
    const total = doc.publicados + doc.rascunhos + doc.emRevisao;
    if (!confirm(`Gerar embeddings dos ${total} artigo(s) de "${doc.name}"? Pode levar minutos.`))
      return;
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
              </div>
            </Surface>
          );
        })}
      </div>

      {criando && <NewSpaceDialog spaces={spaces} onClose={() => setCriando(false)} />}
    </div>
  );
}
