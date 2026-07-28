"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Check,
  Download,
  Eye,
  FileText,
  Folder,
  ImagePlus,
  Loader2,
  Paperclip,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, MenuItem } from "@/components/ui/menu";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClass } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { Markdown } from "@/components/ui/markdown";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { createClient } from "@/lib/supabase/client";
import { uploadToAssets } from "@/lib/content/upload";
import { ACCEPT_ATTR } from "@/lib/importer/file-guard";
import { RenderBlocks } from "@/lib/blocks/render";
import { EmbeddedBlockEditor } from "@/components/editor/blocks/embedded-editor";
import {
  LayoutQuestionsForm,
  diretivasEscolhidas,
} from "@/components/editor/layout-questions";
import type { LayoutQuestion } from "@/lib/importer/question-schema";
import { acharNo, aplicarPatch, type ProposalNode, type ProposalPatch } from "@/lib/studio/proposal";
import { CaptureDialog } from "@/components/capture/capture-dialog";
import {
  getStudioSession,
  materializeStudio,
  saveStudioState,
  studioAttach,
  studioAttachMedia,
  studioGenerateBody,
  studioTurn,
  type StudioMsg,
  type StudioSessionData,
} from "../actions";
import { createCaptureStudio } from "../capture-actions";
import { sugerirCaminhoCaptura } from "../../importar/capture-actions";

type MsgView = StudioMsg | { role: "system"; text: string };

/**
 * Estúdio IA: chat com o "editor sênior" à esquerda; proposta ao vivo à
 * direita (árvore + artigo aberto no editor embutido OU prévia renderizada).
 * A conversa e a proposta são persistidas na sessão — dá para sair e voltar.
 */
export function Studio({
  sessao,
  folders,
  snippets,
}: {
  sessao: StudioSessionData;
  folders: { id: string; title: string; depth: number }[];
  snippets: { key: string; title: string }[];
}) {
  const router = useRouter();
  const { pedirTexto } = useConfirm();
  const [msgs, setMsgs] = useState<MsgView[]>(sessao.messages);
  const [proposal, setProposal] = useState<ProposalNode[]>(sessao.proposal);
  const [materiais, setMateriais] = useState(sessao.materiais);
  const [parentId, setParentId] = useState<string>(sessao.parentId ?? "__root__");
  const [input, setInput] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [perguntas, setPerguntas] = useState<LayoutQuestion[] | null>(null);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [diretivas, setDiretivas] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [modoPrevia, setModoPrevia] = useState(false);
  const [criando, setCriando] = useState(false);
  const [anexando, setAnexando] = useState(false);
  const [capturaAlvo, setCapturaAlvo] = useState<string | null>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const criada = sessao.status === "created";

  // Rola SÓ o container do chat (nunca a janela). O `scrollIntoView` antigo
  // mexia na página e abria uma área vazia enquanto a IA "pensava".
  useEffect(() => {
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, perguntas, ocupado]);

  const artigoSel = selecionado ? acharNo(proposal, selecionado) : null;

  // Persistência debounced do doc editado manualmente (patch granular: o
  // servidor mescla — um escritor só por campo).
  const pendentes = useRef<Map<string, ProposalPatch>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function agendarPatch(patch: ProposalPatch) {
    pendentes.current.set(`${patch.kind}:${"tmpId" in patch ? patch.tmpId : ""}`, patch);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const lote = [...pendentes.current.values()];
      pendentes.current.clear();
      void saveStudioState(sessao.id, lote);
    }, 800);
  }

  function sistema(texto: string) {
    setMsgs((m) => [...m, { role: "system", text: texto }]);
  }

  async function gerarCorpos(tmpIds: string[], dir: string | null) {
    for (const tmpId of tmpIds) {
      const no = acharNo(proposal, tmpId);
      setOcupado(`Escrevendo “${no?.titulo ?? tmpId}”…`);
      const r = await studioGenerateBody(sessao.id, tmpId, dir);
      if (r.ok) {
        setProposal(r.data);
        if (!selecionado) setSelecionado(tmpId);
      } else {
        sistema(`Não consegui escrever "${no?.titulo}": ${r.error}`);
      }
    }
  }

  async function enviar(texto: string) {
    const t = texto.trim();
    if (!t || ocupado) return;
    setInput("");
    setPerguntas(null);
    setRespostas({});
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setOcupado("O editor está pensando…");
    const r = await studioTurn(sessao.id, t);
    if (!r.ok) {
      setOcupado(null);
      sistema(r.error);
      return;
    }
    setMsgs((m) => [...m, { role: "assistant", text: r.data.mensagem }]);
    setProposal(r.data.proposal);
    for (const aviso of r.data.avisos) sistema(aviso);
    if (r.data.perguntas?.length) setPerguntas(r.data.perguntas);
    const dir = r.data.diretivasCorpo ?? diretivas;
    if (r.data.diretivasCorpo) setDiretivas(r.data.diretivasCorpo);
    if (r.data.gerarCorpo.length) await gerarCorpos(r.data.gerarCorpo, dir);
    setOcupado(null);
  }

  function responderPerguntas() {
    if (!perguntas) return;
    const escolhas = diretivasEscolhidas(perguntas, respostas);
    if (!escolhas.length) return;
    void enviar(`Minhas escolhas:\n${escolhas.map((d) => `- ${d}`).join("\n")}`);
  }

  /** Documento/código para a IA LER como base (vira texto em `materiais`). */
  function anexarBase() {
    const el = document.createElement("input");
    el.type = "file";
    el.accept = ACCEPT_ATTR;
    el.onchange = async () => {
      const file = el.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        sistema("Arquivo acima de 10 MB — use a Importação para documentos grandes.");
        return;
      }
      setAnexando(true);
      const supabase = createClient();
      const path = `${sessao.spaceId}/estudio-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("imports").upload(path, file);
      if (error) {
        sistema(`Falha no upload: ${error.message}`);
        setAnexando(false);
        return;
      }
      const r = await studioAttach({
        sessionId: sessao.id,
        path,
        name: file.name,
        mime: file.type || null,
      });
      setAnexando(false);
      if (!r.ok) {
        sistema(r.error);
        return;
      }
      setMateriais((m) => [...m, r.data]);
      // NÃO dispara a IA sozinho: o material fica anexado à sessão (o servidor o
      // considera no PRÓXIMO envio). O usuário escreve a mensagem e clica em
      // enviar — aí a conversa segue já com o anexo em conta.
      sistema(
        `Material "${r.data.nome}" anexado. Escreva sua mensagem e clique em enviar — vou considerá-lo na proposta.`,
      );
    };
    el.click();
  }

  /** Artigo da proposta que vai receber a mídia: o selecionado, ou o único. */
  function alvoArtigo(): string | null {
    if (selecionado) {
      const n = acharNo(proposal, selecionado);
      if (n?.tipo === "article") return n.tmpId;
    }
    const artigos: string[] = [];
    const walk = (ns: ProposalNode[]) =>
      ns.forEach((n) => {
        if (n.tipo === "article") artigos.push(n.tmpId);
        walk(n.children);
      });
    walk(proposal);
    return artigos.length === 1 ? artigos[0]! : null;
  }

  /** Abre o diálogo de captura de telas, mirando o artigo-alvo da proposta. */
  function abrirCaptura() {
    const alvo = alvoArtigo();
    if (!alvo) {
      sistema("Selecione na proposta (à direita) o artigo que vai receber os prints e tente de novo.");
      return;
    }
    setCapturaAlvo(alvo);
  }

  /** Imagem no corpo OU arquivo para download, dentro do artigo alvo. */
  function anexarMidia(kind: "image" | "file") {
    const alvo = alvoArtigo();
    if (!alvo) {
      sistema(
        `Selecione na proposta (à direita) o artigo que vai receber ${kind === "image" ? "a imagem" : "o arquivo"} e anexe de novo.`,
      );
      return;
    }
    const el = document.createElement("input");
    el.type = "file";
    el.accept = kind === "image" ? "image/*" : "*/*";
    el.onchange = async () => {
      const file = el.files?.[0];
      if (!file) return;
      const limiteMb = kind === "image" ? 10 : 25;
      if (file.size > limiteMb * 1024 * 1024) {
        sistema(`Arquivo acima de ${limiteMb} MB.`);
        return;
      }
      setAnexando(true);
      const url = await uploadToAssets(file, sessao.spaceId);
      if (!url) {
        sistema("Falha no upload do arquivo.");
        setAnexando(false);
        return;
      }
      const r = await studioAttachMedia({
        sessionId: sessao.id,
        kind,
        url,
        name: file.name,
        size: file.size,
        targetTmpId: alvo,
      });
      setAnexando(false);
      if (!r.ok) {
        sistema(r.error);
        return;
      }
      setProposal(r.data.proposal);
      setSelecionado(alvo);
      const no = acharNo(r.data.proposal, alvo);
      sistema(
        kind === "image"
          ? `Imagem "${file.name}" adicionada ao artigo "${no?.titulo ?? ""}". A IA a posiciona ao (re)gerar o corpo; senão fica ao fim.`
          : `Arquivo "${file.name}" disponibilizado para download no artigo "${no?.titulo ?? ""}".`,
      );
    };
    el.click();
  }

  async function criar() {
    setCriando(true);
    const r = await materializeStudio(sessao.id, parentId === "__root__" ? null : parentId);
    setCriando(false);
    if (!r.ok) {
      sistema(r.error);
      return;
    }
    router.push(r.data.rootId ? `/admin/conteudo/${r.data.rootId}` : "/admin/conteudo");
  }

  // ── Árvore da proposta (renomear/remover/selecionar) ──────────────────────
  function linhaNo(n: ProposalNode, nivel: number): React.ReactNode {
    const ativo = selecionado === n.tmpId;
    return (
      <div key={n.tmpId}>
        <div
          style={{ paddingLeft: nivel * 14 + 4 }}
          className={`group flex items-center gap-1.5 rounded-md py-1 pr-1 text-[0.8125rem] ${
            ativo ? "bg-brand-purple-50 dark:bg-brand-purple-950/40" : "hover:bg-surface-2"
          }`}
        >
          {n.tipo === "folder" ? (
            <Folder className="size-4 shrink-0 text-text-muted" />
          ) : (
            <FileText className="size-4 shrink-0 text-text-muted" />
          )}
          <button
            type="button"
            onClick={() => n.tipo === "article" && setSelecionado(n.tmpId)}
            className="min-w-0 flex-1 text-left [overflow-wrap:anywhere]"
            title={n.tipo === "article" ? "Abrir na prévia/edição" : undefined}
          >
            {n.titulo}
            {n.tipo === "article" && !n.doc?.blocks.length && (
              <span className="ml-1.5 text-[0.6875rem] text-text-muted">(sem corpo)</span>
            )}
          </button>
          <button
            type="button"
            title="Renomear"
            className="rounded p-1 text-text-muted opacity-0 hover:text-text group-hover:opacity-100"
            onClick={async () => {
              const titulo = (
                await pedirTexto({ title: "Renomear", label: "Título", initial: n.titulo })
              )?.trim();
              if (!titulo || titulo === n.titulo) return;
              const patch: ProposalPatch = { kind: "titulo", tmpId: n.tmpId, titulo };
              setProposal((p) => aplicarPatch(p, patch));
              agendarPatch(patch);
            }}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            title="Remover da proposta"
            className="rounded p-1 text-text-muted opacity-0 hover:text-brand-pink-700 group-hover:opacity-100"
            onClick={() => {
              const patch: ProposalPatch = { kind: "remover", tmpId: n.tmpId };
              setProposal((p) => aplicarPatch(p, patch));
              agendarPatch(patch);
              if (selecionado === n.tmpId) setSelecionado(null);
            }}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
        {n.children.map((c) => linhaNo(c, nivel + 1))}
      </div>
    );
  }

  const podecriar = useMemo(() => proposal.length > 0 && !criada, [proposal, criada]);

  return (
    <div className="flex h-full flex-col">
      {/* Barra superior: destino + criar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
        <Link
          href="/admin/estudio"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Conversas
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
          <Wand2 className="mr-1.5 inline size-4 text-primary" />
          {sessao.title}
        </h1>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          Criar em:
          <select
            value={parentId}
            onChange={(e) => {
              setParentId(e.target.value);
              void saveStudioState(sessao.id, [], e.target.value === "__root__" ? null : e.target.value);
            }}
            disabled={criada}
            className={`${controlClass} h-9 w-auto`}
          >
            <option value="__root__">Raiz da documentação</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {"— ".repeat(f.depth)}
                {f.title}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={criar} disabled={!podecriar || criando || !!ocupado}>
          {criando ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Criando…
            </>
          ) : criada ? (
            <>
              <Check className="size-4" /> Já criada
            </>
          ) : (
            "Criar na documentação"
          )}
        </Button>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 gap-3">
        {/* CHAT */}
        <Surface elevation={1} padding="none" className="flex min-h-0 w-[26rem] shrink-0 flex-col">
          <div ref={msgsRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {msgs.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm leading-relaxed text-text-muted">
                Explique o que você precisa documentar — cole texto, código (PL/SQL, JavaScript…)
                ou anexe arquivos. Eu interpreto, pergunto o que faltar e monto a proposta ao lado.
              </p>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-6 rounded-lg bg-brand-purple-50 px-3 py-2 text-sm dark:bg-brand-purple-950/40"
                    : m.role === "assistant"
                      ? "mr-6 rounded-lg border border-border px-3 py-2 text-sm"
                      : "rounded-md bg-surface-2 px-3 py-1.5 text-xs text-text-muted"
                }
              >
                {m.role === "assistant" ? (
                  <Markdown content={m.text} />
                ) : (
                  <span className="whitespace-pre-wrap">{m.text}</span>
                )}
              </div>
            ))}
            {perguntas && (
              <div className="mr-2 rounded-lg border border-primary/40 p-3">
                <LayoutQuestionsForm
                  perguntas={perguntas}
                  respostas={respostas}
                  onChange={setRespostas}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setPerguntas(null)}>
                    Responder depois
                  </Button>
                  <Button
                    size="sm"
                    disabled={Object.keys(respostas).length === 0}
                    onClick={responderPerguntas}
                  >
                    Enviar respostas
                  </Button>
                </div>
              </div>
            )}
            {ocupado && (
              <div className="flex w-fit items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm text-text-muted">
                <TypingIndicator />
                <span>{ocupado}</span>
              </div>
            )}
          </div>

          {materiais.length > 0 && (
            <p className="border-t border-border px-3 py-1.5 text-[0.6875rem] text-text-muted">
              Materiais: {materiais.map((m) => m.nome).join(" · ")}
            </p>
          )}

          <form
            className="flex items-end gap-2 border-t border-border p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(input);
            }}
          >
            <DropdownMenu
              icon={Paperclip}
              chevron={false}
              variant="secondary"
              size="icon"
              placement="top"
              panelWidth={260}
              disabled={anexando || !!ocupado}
              title="Anexar: base para a IA · imagem no corpo · arquivo para download"
            >
              {(close) => (
                <>
                  <MenuItem icon={FileText} onClick={() => { close(); anexarBase(); }}>
                    Documento base (a IA lê)
                  </MenuItem>
                  <MenuItem icon={ImagePlus} onClick={() => { close(); anexarMidia("image"); }}>
                    Imagem no corpo do artigo
                  </MenuItem>
                  <MenuItem icon={Download} onClick={() => { close(); anexarMidia("file"); }}>
                    Arquivo para download
                  </MenuItem>
                  <MenuItem icon={Camera} onClick={() => { close(); abrirCaptura(); }}>
                    Capturar telas de uma URL
                  </MenuItem>
                </>
              )}
            </DropdownMenu>
            <AutoGrowTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar(input);
                }
              }}
              rows={1}
              placeholder="Descreva, cole código, peça mudanças… (Enter envia)"
              className={`${controlClass} min-h-10 flex-1`}
              disabled={!!ocupado}
            />
            <Button type="submit" size="sm" disabled={!input.trim() || !!ocupado} title="Enviar">
              <Send className="size-4" />
            </Button>
          </form>
        </Surface>

        {/* PROPOSTA */}
        <Surface elevation={1} padding="none" className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Proposta</h2>
            <span className="text-xs text-text-muted">
              {proposal.length === 0 ? "aparece aqui conforme a conversa" : ""}
            </span>
            {artigoSel && (
              <button
                type="button"
                onClick={() => setModoPrevia((v) => !v)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:border-primary hover:text-primary"
                title={modoPrevia ? "Voltar a editar" : "Ver como o leitor verá"}
              >
                {modoPrevia ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
                {modoPrevia ? "Editar" : "Prévia"}
              </button>
            )}
          </div>

          <div className="flex min-h-0 flex-1">
            <div className="w-64 shrink-0 overflow-y-auto border-r border-border p-2">
              {proposal.length === 0 ? (
                <EmptyState className="px-3 py-8" title="Nada proposto ainda" />
              ) : (
                proposal.map((n) => linhaNo(n, 0))
              )}
            </div>
            <div className="min-w-0 flex-1 overflow-y-auto p-4">
              {!artigoSel ? (
                <p className="p-4 text-sm text-text-muted">
                  Selecione um artigo na proposta para ver e editar o conteúdo.
                </p>
              ) : modoPrevia ? (
                <div className="leitura prose prose-neutral prose-portal max-w-none dark:prose-invert" data-size="normal">
                  <h1>{artigoSel.titulo}</h1>
                  <RenderBlocks
                    blocks={artigoSel.doc?.blocks ?? []}
                    snippets={new Map()}
                    headingShift={2}
                  />
                </div>
              ) : (
                <div className="leitura" data-size="normal">
                  <p className="mb-2 text-xs text-text-muted">
                    Edição direta — mudanças são salvas na proposta. Peça ajustes também pelo chat.
                  </p>
                  <EmbeddedBlockEditor
                    key={`${artigoSel.tmpId}:${artigoSel.doc?.blocks.length ?? 0}`}
                    instanceId={artigoSel.tmpId}
                    spaceId={sessao.spaceId}
                    initialBlocks={artigoSel.doc?.blocks ?? []}
                    snippets={snippets}
                    onChange={(blocks) =>
                      agendarPatch({
                        kind: "doc",
                        tmpId: artigoSel.tmpId,
                        doc: { version: 2, blocks },
                      })
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </Surface>
      </div>

      {capturaAlvo && (
        <CaptureDialog
          open
          onClose={() => setCapturaAlvo(null)}
          spaceId={sessao.spaceId}
          submit={(i) => createCaptureStudio({ sessionId: sessao.id, targetTmpId: capturaAlvo, ...i })}
          sugerir={(i) => sugerirCaminhoCaptura({ spaceId: sessao.spaceId, ...i })}
          onDone={async () => {
            const fresh = await getStudioSession(sessao.id);
            if (fresh) {
              setProposal(fresh.proposal);
              setMateriais(fresh.materiais);
              setSelecionado(capturaAlvo);
            }
            sistema("Prints capturados e anexados ao artigo. Gere o corpo para posicioná-los (senão entram ao fim).");
            setCapturaAlvo(null);
          }}
        />
      )}
    </div>
  );
}
