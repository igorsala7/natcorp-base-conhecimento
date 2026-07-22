"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Eye,
  FileText,
  FileUp,
  Folder,
  Loader2,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { controlClass } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { RenderBlocks } from "@/lib/blocks/render";
import { EmbeddedBlockEditor } from "@/components/editor/blocks/embedded-editor";
import {
  LayoutQuestionsForm,
  diretivasEscolhidas,
} from "@/components/editor/layout-questions";
import type { LayoutQuestion } from "@/lib/importer/question-schema";
import { acharNo, aplicarPatch, type ProposalNode, type ProposalPatch } from "@/lib/studio/proposal";
import {
  materializeStudio,
  saveStudioState,
  studioAttach,
  studioGenerateBody,
  studioTurn,
  type StudioMsg,
  type StudioSessionData,
} from "../actions";

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
  const fimRef = useRef<HTMLDivElement>(null);
  const criada = sessao.status === "created";

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, perguntas]);

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

  function anexar() {
    const el = document.createElement("input");
    el.type = "file";
    el.accept = ".pdf,.docx,.md,.markdown,.html,.txt,.sql,.pks,.pkb,.js,.ts,.css,.json,.xml";
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
      void enviar(`Anexei o material "${r.data.nome}". Considere-o na proposta.`);
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
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
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
        <section className="flex w-[26rem] shrink-0 flex-col rounded-lg border border-border bg-surface">
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
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
                <span className="whitespace-pre-wrap">{m.text}</span>
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
              <p className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 className="size-4 animate-spin text-primary" /> {ocupado}
              </p>
            )}
            <div ref={fimRef} />
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
            <button
              type="button"
              title="Anexar arquivo (PDF, DOCX, código…)"
              onClick={anexar}
              disabled={anexando || !!ocupado}
              className="rounded-md border border-border p-2 text-text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {anexando ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar(input);
                }
              }}
              rows={2}
              placeholder="Descreva, cole código, peça mudanças… (Enter envia)"
              className={`${controlClass} max-h-40 min-h-10 flex-1 resize-y`}
              disabled={!!ocupado}
            />
            <Button type="submit" size="sm" disabled={!input.trim() || !!ocupado} title="Enviar">
              <Send className="size-4" />
            </Button>
          </form>
        </section>

        {/* PROPOSTA */}
        <section className="flex min-w-0 flex-1 flex-col rounded-lg border border-border bg-surface">
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
                <p className="p-3 text-xs leading-relaxed text-text-muted">
                  Nada proposto ainda.
                </p>
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
        </section>
      </div>
    </div>
  );
}
