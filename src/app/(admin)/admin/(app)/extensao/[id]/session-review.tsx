"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImageIcon, Navigation, MessageSquareText, LayoutGrid, Trash2, RotateCcw, Sparkles, Wand2, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, controlClass } from "@/components/ui/input";
import { eyebrowLabel } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { RenderBlocks } from "@/lib/blocks/render";
import { newId, type Block } from "@/lib/blocks/schema";
import {
  getSessionReview,
  toggleExtEvent,
  finalizeSessionAdmin,
  deleteExtensionSession,
  previewSecoesCaptura,
  escreverSecaoCaptura,
  finalizarComDocIA,
  type SessionReview as Review,
  type ReviewEvent,
} from "../../sistema/extension-actions";

const EMPTY_SNIPPETS: Map<string, Block[]> = new Map();
const INTRO_PREVIA =
  "Rascunho gerado a partir da captura da extensão. Revise a redação, complete os detalhes e publique quando estiver pronto.";
const headingBlock = (text: string): Block => ({ id: newId(), type: "heading", text: [{ text }], data: { level: 2 } });
const paraBlock = (text: string): Block => ({ id: newId(), type: "paragraph", text: [{ text }] });

export function SessionReview({
  initial,
  spaces,
}: {
  initial: Review;
  spaces: { id: string; name: string; type: string }[];
}) {
  const toast = useToast();
  const { confirmar } = useConfirm();
  const router = useRouter();
  const [review, setReview] = useState<Review>(initial);
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const [title, setTitle] = useState(initial.title || "Rascunho da captura");
  const [busy, setBusy] = useState(false);
  // Prévia por IA (req. 4a): monta o artigo seção a seção, ao vivo.
  const [previaBlocks, setPreviaBlocks] = useState<Block[] | null>(null);
  const [previaStatus, setPreviaStatus] = useState("");
  const [previaBusy, setPreviaBusy] = useState(false);
  const [previaPronta, setPreviaPronta] = useState(false);

  const refresh = useCallback(async () => {
    const r = await getSessionReview(initial.id);
    if (r) setReview(r);
  }, [initial.id]);

  // Preview ao vivo: Realtime + polling de reserva (só enquanto a sessão grava).
  useEffect(() => {
    if (review.status !== "active") return;
    const supabase = createClient();
    const channel = supabase
      .channel(`ext-session-${initial.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "extension_events", filter: `session_id=eq.${initial.id}` },
        () => void refresh(),
      )
      .subscribe();
    const timer = setInterval(() => void refresh(), 3000);
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [initial.id, review.status, refresh]);

  async function toggle(ev: ReviewEvent) {
    const novo = !ev.discarded;
    setReview((r) => ({ ...r, events: r.events.map((e) => (e.id === ev.id ? { ...e, discarded: novo } : e)) }));
    const res = await toggleExtEvent(ev.id, novo);
    if (!res.ok) {
      toast.error(res.error ?? "Falhou.");
      setReview((r) => ({ ...r, events: r.events.map((e) => (e.id === ev.id ? { ...e, discarded: ev.discarded } : e)) }));
    }
  }

  async function gerar() {
    if (!spaceId) return toast.error("Escolha a documentação.");
    setBusy(true);
    const r = await finalizeSessionAdmin(review.id, spaceId, title);
    setBusy(false);
    if (r.ok) {
      toast.success("Rascunho criado.");
      await refresh();
      router.refresh();
    } else toast.error(r.error);
  }

  /** Monta a prévia SEÇÃO A SEÇÃO — cada tela aparece assim que a IA termina. */
  async function preverComIA() {
    if (!spaceId) return toast.error("Escolha a documentação.");
    setPreviaBusy(true);
    setPreviaPronta(false);
    setPreviaStatus("Lendo a captura…");
    const plano = await previewSecoesCaptura(review.id, spaceId);
    if (!plano.ok) {
      setPreviaBusy(false);
      setPreviaStatus("");
      return toast.error(plano.error);
    }
    const acc: Block[] = [paraBlock(INTRO_PREVIA)];
    setPreviaBlocks(acc.slice());
    let passo = 0;
    for (const sec of plano.secoes) {
      setPreviaStatus(`Escrevendo ${sec.idx + 1} de ${plano.secoes.length}: ${sec.titulo}…`);
      const r = await escreverSecaoCaptura(review.id, spaceId, sec.idx);
      if (!r.ok) {
        setPreviaBusy(false);
        setPreviaStatus("");
        return toast.error(r.error);
      }
      const cabecalho = sec.url ? `${++passo}. ${sec.titulo}` : sec.titulo;
      acc.push(headingBlock(cabecalho), ...r.blocks);
      setPreviaBlocks(acc.slice()); // nova referência → re-render incremental
    }
    setPreviaBusy(false);
    setPreviaPronta(true);
    setPreviaStatus(`Prévia pronta — ${plano.secoes.length} seção(ões).`);
  }

  /** Salva a versão pré-visualizada pela IA (em vez do rascunho determinístico). */
  async function salvarPrevia() {
    if (!previaBlocks || !previaPronta) return;
    setBusy(true);
    const r = await finalizarComDocIA(review.id, spaceId, title, { version: 2, blocks: previaBlocks });
    setBusy(false);
    if (r.ok) {
      toast.success("Rascunho da IA criado.");
      await refresh();
      router.refresh();
    } else toast.error(r.error);
  }

  async function excluir() {
    const ok = await confirmar({
      title: "Excluir esta captura?",
      description: "Remove a sessão e os arquivos brutos (prints e áudios). O rascunho já gerado NÃO é afetado. Não pode ser desfeito.",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    const r = await deleteExtensionSession(review.id);
    if (r.ok) {
      toast.success("Captura excluída.");
      router.push("/admin/sistema");
    } else toast.error(r.error ?? "Falhou.");
  }

  const mantidos = review.events.filter((e) => !e.discarded).length;
  const finalizada = review.status !== "active";

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/sistema" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
          <ArrowLeft className="size-4" /> Extensão
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{review.title || "Captura"}</h1>
          <Badge tone={review.status === "active" ? "success" : "neutral"}>
            {review.status === "active" ? "Gravando" : review.status === "finalized" ? "Finalizada" : "Cancelada"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {review.events.length} evento(s) · {mantidos} mantido(s) para o rascunho.
          {review.status === "active" && " Atualiza ao vivo enquanto você captura."}
        </p>
      </div>

      {/* Eventos capturados */}
      <Surface elevation={1} padding="none" className="overflow-hidden">
        {review.events.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">
            Nenhum evento ainda. Capture telas e navegue pelo sistema com a extensão.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {review.events.map((e) => (
              <li key={e.id} className={`flex items-start gap-3 p-3 ${e.discarded ? "opacity-45" : ""}`}>
                <EventBody ev={e} />
                {!finalizada && (
                  <button
                    type="button"
                    onClick={() => void toggle(e)}
                    title={e.discarded ? "Restaurar" : "Descartar"}
                    className="shrink-0 rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                  >
                    {e.discarded ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Surface>

      {/* Gerar rascunho, ou link se já finalizada */}
      {finalizada ? (
        review.node_id ? (
          <Surface elevation={1} padding="lg">
            <p className="text-sm">
              Rascunho criado.{" "}
              <Link href="/admin/conteudo" className="font-medium text-primary hover:underline">
                Abrir no conteúdo →
              </Link>
            </p>
          </Surface>
        ) : null
      ) : (
        <Surface elevation={1} padding="lg" className="space-y-3">
          <span className={eyebrowLabel}>Gerar rascunho</span>
          {spaces.length === 0 ? (
            <p className="text-sm text-text-muted">Você não tem permissão para criar conteúdo em nenhuma documentação.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={eyebrowLabel}>Documentação</span>
                  <select
                    value={spaceId}
                    onChange={(e) => setSpaceId(e.target.value)}
                    className={`${controlClass} mt-1`}
                  >
                    {spaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.type === "global" ? "🌐 " : "👤 "}
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={eyebrowLabel}>Título</span>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="md" onClick={() => void gerar()} disabled={busy || previaBusy || mantidos === 0}>
                  <Sparkles className="size-4" /> Gerar rascunho ({mantidos})
                </Button>
                <Button onClick={() => void preverComIA()} disabled={busy || previaBusy || mantidos === 0}>
                  {previaBusy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                  Pré-visualizar com IA
                </Button>
              </div>
              <p className="text-xs text-text-muted">
                <strong>Gerar rascunho</strong> monta a versão direta (prints e narração na ordem).{" "}
                <strong>Pré-visualizar com IA</strong> escreve o artigo tela a tela e mostra aqui antes de salvar.
              </p>

              {previaBlocks && (
                <div className="space-y-3 rounded-lg border border-border bg-surface-1 p-4">
                  <div className="flex items-center gap-2 text-sm">
                    {previaPronta ? (
                      <Check className="size-4 text-primary" />
                    ) : (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    )}
                    <span className="text-text-muted">{previaStatus}</span>
                  </div>
                  <div className="max-h-[32rem] overflow-y-auto rounded-md border border-border bg-surface-0 p-4">
                    <div className="prose prose-neutral prose-portal max-w-none dark:prose-invert">
                      <RenderBlocks blocks={previaBlocks} snippets={EMPTY_SNIPPETS} />
                    </div>
                  </div>
                  {previaPronta && (
                    <Button onClick={() => void salvarPrevia()} disabled={busy}>
                      <Check className="size-4" /> Salvar esta versão (IA)
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </Surface>
      )}

      {/* Privacidade + excluir */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="max-w-md text-xs text-text-muted">
          Prints e áudios ficam em armazenamento privado. Segredos na querystring das URLs são
          redigidos automaticamente; <strong>descarte acima</strong> o que contiver dados sensíveis na imagem.
        </p>
        <button
          type="button"
          onClick={() => void excluir()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-brand-pink-700 transition-colors hover:bg-brand-pink-50 dark:hover:bg-brand-pink-950/40"
        >
          <Trash2 className="size-4" /> Excluir captura
        </button>
      </div>
    </div>
  );
}

function EventBody({ ev }: { ev: ReviewEvent }) {
  if (ev.kind === "shot") {
    return (
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {ev.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ev.thumbUrl} alt="" className="h-16 w-24 shrink-0 rounded-md border border-border object-cover" />
        ) : (
          <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md bg-surface-2 text-text-muted">
            <ImageIcon className="size-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium">Print de tela</p>
          {ev.title && <p className="truncate text-xs text-text-muted">{ev.title}</p>}
        </div>
      </div>
    );
  }
  if (ev.kind === "transcript") {
    return (
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Narração transcrita</p>
          <p className="line-clamp-3 text-xs text-text-muted">{ev.label || "(sem texto — transcrição não configurada)"}</p>
        </div>
      </div>
    );
  }
  if (ev.kind === "scan") {
    return (
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <LayoutGrid className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Dados da tela (contexto p/ a IA)</p>
          <p className="line-clamp-2 text-xs text-text-muted">{ev.label || ""}</p>
        </div>
      </div>
    );
  }
  // nav
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <Navigation className="mt-0.5 size-4 shrink-0 text-text-muted" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{ev.title || "Tela"}</p>
        {ev.url && <p className="truncate text-xs text-text-muted">{ev.url}</p>}
      </div>
    </div>
  );
}
