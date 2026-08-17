"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  BookText,
  Database,
  ExternalLink,
  Eye,
  FilePlus2,
  FolderTree,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  MoreHorizontal,
  Palette,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import type { SpaceInfo } from "@/lib/content/spaces";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { NewSpaceDialog } from "@/components/content/new-space-dialog";
import { useKbUpload } from "@/components/admin/kb-upload-button";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { deleteSpace } from "./actions";

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
  /** Arquivos na base de conhecimento do chatbot. */
  arquivosBot: number;
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

/** Um número + rótulo, com bolinha de cor — leitura rápida do estado da doc. */
function Metrica({ n, label, dot }: { n: number; label: string; dot: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", dot)} />
      <strong className="font-semibold tabular-nums">{n}</strong>
      <span className="text-text-muted">{label}</span>
    </span>
  );
}

function DocCard({ doc: d, index }: { doc: DocResumo; index: number }) {
  const router = useRouter();
  const { confirmar } = useConfirm();
  const toast = useToast();
  const [excluindo, startTransition] = useTransition();
  const { abrir: enviarAoBot, enviando, progresso } = useKbUpload(d.id, (resumo) => {
    toast.success(resumo);
    router.refresh();
  });
  const vis = VISIBILIDADE[d.visibility];

  async function excluir() {
    const ok = await confirmar({
      title: `Excluir "${d.name}"`,
      description:
        `Exclusão DEFINITIVA e irreversível: ${d.publicados + d.rascunhos + d.emRevisao} artigo(s) com todas as versões, ` +
        `${d.pastas} pasta(s), ${d.chunksIndexados} trecho(s) indexado(s) (embeddings), os chatbots (chaves de widget), ` +
        "os arquivos da base do chatbot, as conversas e as imagens do Storage. A página pública sai do ar agora. " +
        "Só a trilha de auditoria permanece.",
      tone: "danger",
      confirmLabel: "Excluir definitivamente",
      typeToConfirm: d.name,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteSpace(d.id);
      if (!r.ok) toast.error(r.error);
      else toast.success(`"${d.name}" excluída.`);
      router.refresh();
    });
  }

  return (
    <Surface
      elevation={1}
      padding="lg"
      style={{ animationDelay: `${index * 60}ms` }}
      className="animate-fade-up flex flex-col gap-4 transition-shadow hover:shadow-2"
    >
      {/* Cabeçalho: identidade + menu de ações (kebab). */}
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40"
        >
          {d.type === "client" ? <Users className="size-5" /> : <BookText className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold tracking-tight">{d.name}</h2>
            {d.type === "client" && <Badge tone="accent">Cliente</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-text-muted">
            <span className="truncate">/docs/{d.slug}</span>
            <span className="inline-flex items-center gap-1">
              <vis.Icon className="size-3.5" /> {vis.rotulo}
            </span>
          </div>
        </div>
        {enviando && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-primary" title="Enviando à base do chatbot">
            <Loader2 className="size-3.5 animate-spin" /> {progresso ?? "…"}
          </span>
        )}
        <DropdownMenu
          icon={MoreHorizontal}
          chevron={false}
          variant="ghost"
          size="icon"
          align="end"
          panelWidth={248}
          title="Mais ações"
        >
          {(close) => (
            <>
              <MenuLabel>Configurar</MenuLabel>
              <MenuItem icon={Palette} onClick={() => { close(); router.push(`/admin/aparencia?space=${d.id}`); }}>
                Aparência
              </MenuItem>
              <MenuItem icon={Settings} onClick={() => { close(); router.push(`/admin/configuracoes?space=${d.id}`); }}>
                Preferências
              </MenuItem>
              <MenuItem icon={Bot} onClick={() => { close(); router.push(`/admin/chatbot?space=${d.id}`); }}>
                Chatbot
              </MenuItem>
              {d.canEdit && (
                <>
                  <MenuSeparator />
                  <MenuLabel>IA e base do chatbot</MenuLabel>
                  <MenuItem
                    icon={Sparkles}
                    onClick={() => { close(); router.push(`/admin/importar?aba=embeddings&space=${d.id}`); }}
                  >
                    Gerar embeddings
                  </MenuItem>
                  <MenuItem icon={FilePlus2} disabled={enviando} onClick={() => { close(); enviarAoBot(); }}>
                    Adicionar documentos ao chatbot
                  </MenuItem>
                </>
              )}
              {d.canDelete && (
                <>
                  <MenuSeparator />
                  <MenuItem
                    icon={Trash2}
                    danger
                    disabled={d.temClientes || excluindo}
                    hint={d.temClientes ? "tem clientes" : undefined}
                    onClick={() => { close(); void excluir(); }}
                  >
                    Excluir documentação
                  </MenuItem>
                </>
              )}
            </>
          )}
        </DropdownMenu>
      </div>

      {/* Métricas escaneáveis (conteúdo + prontidão de IA), sem caixas pesadas. */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          <Metrica n={d.publicados} label="publicados" dot="bg-emerald-500" />
          <Metrica n={d.rascunhos} label="rascunhos" dot="bg-brand-gray-400" />
          <Metrica n={d.emRevisao} label="em revisão" dot="bg-amber-500" />
          <Metrica n={d.pastas} label="pastas" dot="bg-slate-400" />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <strong className="font-semibold tabular-nums text-text">{d.chunksIndexados}</strong> trechos indexados p/ busca e IA
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Database className="size-3.5" />
            <strong className="font-semibold tabular-nums text-text">{d.arquivosBot}</strong> arquivos no chatbot
          </span>
        </div>
      </div>

      {/* Ação primária + acessos rápidos; o resto vive no menu ⋯. */}
      <div className="mt-auto flex items-center gap-1.5 border-t border-border pt-3">
        <Button asChild size="sm">
          <Link href={`/admin/conteudo?space=${d.id}`}>
            <FolderTree className="size-4" /> Conteúdo
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" title="Prévia interna da documentação">
          <Link href={`/admin/previa/${d.id}`}>
            <Eye className="size-4" /> Prévia
          </Link>
        </Button>
        {d.visibility === "public" && (
          <Button asChild size="icon" variant="ghost" title="Abrir a página pública em uma nova aba" className="ml-auto">
            <a href={d.publicBase} target="_blank" rel="noopener noreferrer" aria-label="Abrir a página pública">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
      </div>
    </Surface>
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
  const [criando, setCriando] = useState(false);

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
        {docs.map((d, i) => (
          <DocCard key={d.id} doc={d} index={i} />
        ))}
      </div>

      {criando && <NewSpaceDialog spaces={spaces} onClose={() => setCriando(false)} />}
    </div>
  );
}
