"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Folder, Loader2, MessageSquareText, Send, Sparkles, X } from "lucide-react";
import type { Block } from "@/lib/blocks/schema";
import { blocksToText } from "@/lib/blocks/serialize";
import { aplicarOpsNoDoc, resumoDoDoc } from "@/lib/studio/chat-ops";
import {
  editorChatTurn,
  applyChatStructure,
  type ChatStructureItem,
} from "@/app/(admin)/admin/(app)/conteudo/chat-actions";
import type { LayoutQuestion } from "@/lib/importer/question-schema";
import {
  LayoutQuestionsForm,
  diretivasEscolhidas,
} from "./layout-questions";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { Markdown } from "@/components/ui/markdown";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

type Msg = { role: "user" | "assistant" | "system"; text: string };

/**
 * Chat do editor: instruções viram OPERAÇÕES aplicadas EM TEMPO REAL no
 * canvas (o desfazer do editor cobre — decisão do produto); pedidos de
 * "melhorar layout/texto" abrem as ferramentas existentes; e a IA pergunta
 * quando falta contexto — mesmo mecanismo do Estúdio.
 */
export function EditorChat({
  nodeId,
  blocks,
  onApplyBlocks,
  onMelhorarLayout,
  temBlocoDeTextoSelecionado,
  acoesTexto,
  onAcaoTexto,
  onClose,
}: {
  nodeId: string;
  blocks: Block[];
  /** Aplica o doc novo no canvas (setBlocks — entra no undo). */
  onApplyBlocks: (blocks: Block[]) => void;
  onMelhorarLayout: () => void;
  temBlocoDeTextoSelecionado: boolean;
  acoesTexto: { rotulo: string; onClick: () => void }[];
  onAcaoTexto: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [perguntas, setPerguntas] = useState<LayoutQuestion[] | null>(null);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [mostrarAcoesTexto, setMostrarAcoesTexto] = useState(false);
  const [estrutura, setEstrutura] = useState<ChatStructureItem[] | null>(null);
  const [criandoEstrutura, setCriandoEstrutura] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, perguntas, mostrarAcoesTexto, estrutura]);

  async function enviar(texto: string) {
    const t = texto.trim();
    if (!t || ocupado) return;
    setInput("");
    setPerguntas(null);
    setRespostas({});
    setMostrarAcoesTexto(false);
    setEstrutura(null);
    const historico = msgs
      .filter((m): m is Msg & { role: "user" | "assistant" } => m.role !== "system")
      .map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setOcupado(true);
    const r = await editorChatTurn({
      nodeId,
      instrucao: t,
      historico,
      resumoDoc: resumoDoDoc(blocks).slice(0, 16_000),
      textoDoc: blocksToText(blocks).slice(0, 16_000),
    });
    setOcupado(false);
    if (!r.ok) {
      setMsgs((m) => [...m, { role: "system", text: r.error }]);
      return;
    }
    setMsgs((m) => [...m, { role: "assistant", text: r.data.mensagem }]);

    if (r.data.ops?.length) {
      const res = aplicarOpsNoDoc(blocks, r.data.ops);
      if (res.aplicadas > 0) onApplyBlocks(res.blocks);
      for (const ig of res.ignoradas) {
        setMsgs((m) => [...m, { role: "system", text: `Ignorado: ${ig}` }]);
      }
      if (res.aplicadas > 0) {
        setMsgs((m) => [
          ...m,
          {
            role: "system",
            text: `${res.aplicadas} alteração(ões) aplicada(s) — Ctrl+Z desfaz.`,
          },
        ]);
      }
    }

    if (r.data.ferramenta === "melhorar_layout") {
      onMelhorarLayout();
    } else if (r.data.ferramenta === "melhorar_texto") {
      if (temBlocoDeTextoSelecionado) setMostrarAcoesTexto(true);
      else
        setMsgs((m) => [
          ...m,
          {
            role: "system",
            text: "Clique no bloco de texto que quer melhorar e peça de novo — ou use os subtipos abaixo após selecionar.",
          },
        ]);
    }

    if (r.data.perguntas?.length) setPerguntas(r.data.perguntas);
    if (r.data.estrutura?.length) setEstrutura(r.data.estrutura);
  }

  function responderPerguntas() {
    if (!perguntas) return;
    const escolhas = diretivasEscolhidas(perguntas, respostas);
    if (!escolhas.length) return;
    void enviar(`Minhas escolhas:\n${escolhas.map((d) => `- ${d}`).join("\n")}`);
  }

  async function criarEstrutura() {
    if (!estrutura?.length) return;
    setCriandoEstrutura(true);
    const r = await applyChatStructure(nodeId, estrutura);
    setCriandoEstrutura(false);
    setEstrutura(null);
    if (!r.ok) {
      setMsgs((m) => [...m, { role: "system", text: r.error }]);
      return;
    }
    setMsgs((m) => [
      ...m,
      { role: "system", text: `${r.criados} item(ns) criado(s) na árvore.` },
    ]);
    router.refresh(); // atualiza a árvore lateral
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <MessageSquareText className="size-4 text-primary" /> Chat IA
          </h3>
          <p className="text-xs text-text-muted">Altera o artigo em tempo real — Ctrl+Z desfaz.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded p-1 text-text-muted hover:bg-surface-2"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {msgs.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-3 text-xs leading-relaxed text-text-muted">
            Peça mudanças (&ldquo;adicione uma seção sobre pré-requisitos&rdquo;, &ldquo;transforme
            os status em tabela&rdquo;), cole código para eu explicar, ou peça &ldquo;melhorar
            layout/texto&rdquo; — abro a ferramenta certa.
          </p>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-4 rounded-lg bg-brand-purple-50 px-2.5 py-1.5 text-[0.8125rem] dark:bg-brand-purple-950/40"
                : m.role === "assistant"
                  ? "mr-4 rounded-lg border border-border px-2.5 py-1.5 text-[0.8125rem]"
                  : "rounded-md bg-surface-2 px-2.5 py-1 text-[0.6875rem] text-text-muted"
            }
          >
            {m.role === "assistant" ? (
              <Markdown content={m.text} />
            ) : (
              <span className="whitespace-pre-wrap">{m.text}</span>
            )}
          </div>
        ))}

        {mostrarAcoesTexto && (
          <div className="rounded-lg border border-primary/40 p-2.5">
            <p className="mb-2 text-xs font-medium">Como melhorar o bloco selecionado?</p>
            <div className="flex flex-wrap gap-1.5">
              {acoesTexto.map((a) => (
                <button
                  key={a.rotulo}
                  type="button"
                  onClick={() => {
                    setMostrarAcoesTexto(false);
                    a.onClick();
                    onAcaoTexto();
                  }}
                  className="rounded-md border border-border px-2 py-1 text-xs transition-colors hover:border-primary hover:text-primary"
                >
                  {a.rotulo}
                </button>
              ))}
            </div>
          </div>
        )}

        {perguntas && (
          <div className="rounded-lg border border-primary/40 p-2.5">
            <LayoutQuestionsForm perguntas={perguntas} respostas={respostas} onChange={setRespostas} />
            <div className="mt-2.5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setPerguntas(null)}>
                Depois
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

        {estrutura && estrutura.length > 0 && (
          <div className="rounded-lg border border-primary/40 p-2.5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
              <Sparkles className="size-3.5 text-primary" /> Sugestão de organização
            </p>
            <ul className="space-y-1 text-[0.8125rem]">
              {estrutura.map((it) => {
                const filho = !!it.pai && estrutura.some((x) => x.tmp === it.pai);
                const Icone = it.tipo === "folder" ? Folder : FileText;
                return (
                  <li key={it.tmp} className={`flex items-center gap-1.5 ${filho ? "pl-5" : ""}`}>
                    <Icone className="size-3.5 shrink-0 text-text-muted" />
                    <span className="truncate">{it.titulo}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 text-[0.6875rem] text-text-muted">
              Os artigos nascem vazios, prontos para preencher.
            </p>
            <div className="mt-2.5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEstrutura(null)} disabled={criandoEstrutura}>
                Agora não
              </Button>
              <Button size="sm" onClick={criarEstrutura} disabled={criandoEstrutura}>
                {criandoEstrutura ? <Loader2 className="size-4 animate-spin" /> : null}
                Criar estrutura
              </Button>
            </div>
          </div>
        )}

        {ocupado && (
          <div className="flex w-fit items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-text-muted">
            <TypingIndicator /> <span>Pensando…</span>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      <form
        className="flex items-end gap-1.5 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(input);
        }}
      >
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
          placeholder="Instrução… (Enter envia)"
          disabled={ocupado}
          className={`${controlClass} min-h-9 flex-1 text-sm`}
        />
        <Button type="submit" size="sm" disabled={!input.trim() || ocupado} title="Enviar">
          <Send className="size-4" />
        </Button>
      </form>
    </aside>
  );
}
