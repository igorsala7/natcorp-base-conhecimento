"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Sparkles, Send, X, ThumbsUp, ThumbsDown, FileText } from "lucide-react";
import { controlClass } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { submitPortalChatFeedback } from "@/app/(portal)/actions";
import { readPortalIdentity } from "@/lib/portal/track-client";
import type { ClarifyOption, ClarifyScope } from "@/lib/ai/disambiguation";

/** Espelha `RetrievedSource` do servidor. `url` é nulo quando a fonte é um
 *  arquivo da base de conhecimento, que não tem página no portal. */
type Citation = { n: number; title: string; url: string | null; heading_path?: string | null };
const FALHA_RESPOSTA =
  "Não foi possível gerar a resposta agora. As fontes encontradas estão abaixo — tente de novo em instantes ou avise a equipe.";

/** Gradiente da marca (roxo→azul) — cabeçalho, avatar, balão do usuário, enviar. */
const GRAD = "bg-gradient-to-br from-brand-purple-600 to-brand-blue-700";

type Msg = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  feedback?: 1 | -1;
  /** Pergunta de desambiguação: botões para o usuário escolher o tema. */
  options?: ClarifyOption[];
};

/** Painel "Perguntar à IA" do leitor — responde com base na doc do espaço. */
export function AskAiPanel({
  spaceSlug,
  open,
  onClose,
  initialQuestion,
}: {
  spaceSlug: string;
  open: boolean;
  onClose: () => void;
  initialQuestion?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const convRef = useRef<string | undefined>(undefined);
  const sidRef = useRef<string>("");
  // Rastreio (p_base/p_usuario/…): quando a página do portal é aberta com esses
  // parâmetros na URL, seguem junto para a conversa. Só DADO, nunca vai ao prompt.
  const trackRef = useRef<Record<string, string> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const askedRef = useRef<string | null>(null);
  // Tema em foco (eco do servidor via evento SSE `theme`) — evita perguntar de
  // novo enquanto o usuário segue no mesmo assunto.
  const contextScopeRef = useRef<ClarifyScope | undefined>(undefined);

  useEffect(() => {
    const key = `kb.portal.sid.${spaceSlug}`;
    let sid = localStorage.getItem(key);
    if (!sid) {
      sid = "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(key, sid);
    }
    sidRef.current = sid;
    // Identidade da visita (URL `p_*` ou o que ficou salvo desta sessão).
    trackRef.current = readPortalIdentity();
  }, [spaceSlug]);

  // Fecha com Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Pergunta inicial (vinda da busca sem resultado).
  useEffect(() => {
    if (open && initialQuestion && askedRef.current !== initialQuestion) {
      askedRef.current = initialQuestion;
      void ask(initialQuestion);
    }
    if (!open) askedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuestion]);

  function scrollDown() {
    requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));
  }

  /**
   * Envia a pergunta. Sem `scope`: pergunta nova. Com `scope` (clique num botão
   * de desambiguação): reusa a última pergunta filtrando pelo tema, substituindo
   * a bolha de opções pela resposta.
   */
  async function ask(question: string, scope?: ClarifyScope) {
    if (streaming) return;
    let history: Msg[];
    if (scope) {
      const semClarify = messages[messages.length - 1]?.options ? messages.slice(0, -1) : messages;
      if (!semClarify.some((m) => m.role === "user")) return;
      history = semClarify;
      setMessages([...semClarify, { role: "assistant", content: "" }]);
    } else {
      const q = question.trim();
      if (!q) return;
      history = [...messages, { role: "user", content: q }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setInput("");
    }
    setStreaming(true);
    try {
      const res = await fetch("/api/portal/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceSlug,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          conversationId: convRef.current,
          sessionId: sidRef.current,
          ...(trackRef.current ? { track: trackRef.current } : {}),
          ...(scope ? { scope } : {}),
          ...(contextScopeRef.current ? { contextScope: contextScopeRef.current } : {}),
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        updateLast((m) => ({ ...m, content: err.error ?? "Falha ao responder." }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let full = "";
      let cites: Citation[] = [];
      let clarified = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const chunk of parts) {
          const line = chunk.replace(/^data:\s?/, "").trim();
          if (!line) continue;
          let evt: {
            type: string;
            value?: string;
            citations?: Citation[];
            conversationId?: string;
            scope?: ClarifyScope;
            question?: string;
            options?: ClarifyOption[];
          };
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.type === "citations") cites = evt.citations ?? [];
          else if (evt.type === "theme") contextScopeRef.current = evt.scope;
          else if (evt.type === "clarify") {
            clarified = true;
            updateLast((m) => ({ ...m, content: evt.question ?? "", options: evt.options ?? [] }));
            scrollDown();
          } else if (evt.type === "token") {
            full += evt.value ?? "";
            updateLast((m) => ({ ...m, content: full }));
            scrollDown();
          } else if (evt.type === "done") {
            convRef.current = evt.conversationId || convRef.current;
            // Resposta vazia = falha na chamada ao modelo (mas não quando foi
            // desambiguação — aí a bolha já tem a pergunta + botões).
            if (!clarified) {
              updateLast((m) => ({ ...m, citations: cites, content: m.content || FALHA_RESPOSTA }));
            }
          }
        }
      }
    } catch (e) {
      updateLast((m) => ({ ...m, content: "Erro: " + (e instanceof Error ? e.message : String(e)) }));
    } finally {
      setStreaming(false);
      scrollDown();
    }
  }

  function updateLast(fn: (m: Msg) => Msg) {
    setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)));
  }
  function giveFeedback(i: number, value: 1 | -1) {
    void submitPortalChatFeedback(
      convRef.current ?? "",
      value,
      spaceSlug,
      sidRef.current ?? "",
    );
    setMessages((prev) => prev.map((m, idx) => (idx === i ? { ...m, feedback: value } : m)));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Perguntar à IA">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm motion-safe:animate-[fade_150ms_ease-out]"
        onClick={onClose}
      />
      <div className="relative flex h-dvh w-full max-w-md flex-col overflow-hidden bg-surface shadow-3 motion-safe:animate-[slidein_200ms_ease-out] sm:m-3 sm:h-[calc(100dvh-1.5rem)] sm:rounded-3xl">
        {/* Cabeçalho com gradiente da marca */}
        <div className={`flex items-center gap-3 px-4 py-4 text-white ${GRAD}`}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 shadow-sm">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight">Assistente de IA</p>
            <p className="truncate text-xs text-white/80">Respostas com base na documentação</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
          >
            <X className="size-4" />
          </button>
        </div>

        <div ref={scrollRef} className="slim-scroll flex-1 space-y-4 overflow-auto bg-surface-2/50 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <span className={`mb-4 flex size-14 items-center justify-center rounded-2xl text-white shadow-2 ${GRAD}`}>
                <Sparkles className="size-7" />
              </span>
              <p className="text-base font-semibold text-text">Como posso ajudar?</p>
              <p className="mt-1.5 max-w-[17rem] text-sm leading-relaxed text-text-muted">
                Faça uma pergunta sobre esta documentação — as respostas citam as fontes.
              </p>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className={`max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm text-white shadow-1 ${GRAD}`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-white shadow-1 ${GRAD}`}>
                  <Sparkles className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="inline-block max-w-full rounded-2xl rounded-tl-md border border-border bg-surface px-3.5 py-2.5 text-sm shadow-1">
                    {m.content ? <Markdown content={m.content} /> : <TypingIndicator className="py-0.5" />}
                  </div>
                  {m.options && m.options.length > 0 && (
                    <div className="mt-2.5 flex flex-col gap-2">
                      {m.options.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => ask("", o.scope)}
                          disabled={streaming}
                          className="rounded-xl border-[1.5px] border-brand-purple-200 bg-surface px-3 py-2 text-left text-xs transition-colors hover:border-primary hover:bg-brand-purple-50/60 disabled:opacity-50 dark:border-brand-purple-900 dark:hover:bg-brand-purple-950/40"
                        >
                          <span className="block font-semibold text-primary">{o.label}</span>
                          {o.sublabel && <span className="mt-0.5 block leading-snug text-text-muted">{o.sublabel}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.citations && m.citations.length > 0 && (
                    // Fechada por padrão: no painel estreito do portal a lista de
                    // fontes empurrava a resposta para fora da vista.
                    <details className="group mt-2.5">
                      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-text-muted shadow-sm transition-colors hover:text-text">
                        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                        Fontes
                        <span className="tabular-nums">({m.citations.length})</span>
                      </summary>
                      <div className="mt-2 space-y-1.5">
                        {m.citations.map((c) => {
                          // Sem URL (fonte de arquivo) a citação não pode ser link:
                          // um <a href=""> recarrega a página ao ser clicado.
                          const Tag = c.url ? "a" : "div";
                          return (
                            <Tag
                              key={c.n}
                              {...(c.url ? { href: c.url } : {})}
                              className={`flex items-start gap-2 rounded-xl border border-border bg-surface p-2.5 text-sm no-underline shadow-sm ${
                                c.url ? "transition-colors hover:border-primary" : ""
                              }`}
                            >
                              <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-semibold text-primary">
                                  [{c.n}] {c.title}
                                </span>
                                {c.heading_path && (
                                  <span className="block truncate text-[11px] text-text-muted">
                                    {c.heading_path}
                                  </span>
                                )}
                              </span>
                            </Tag>
                          );
                        })}
                      </div>
                    </details>
                  )}
                  {m.role === "assistant" && m.content && i === messages.length - 1 && !streaming && (
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-xs text-text-muted">Útil?</span>
                      <button
                        type="button"
                        aria-label="Útil"
                        onClick={() => giveFeedback(i, 1)}
                        className={`rounded-md p-1 transition-colors hover:bg-surface-2 ${m.feedback === 1 ? "text-primary" : "text-text-muted"}`}
                      >
                        <ThumbsUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Não útil"
                        onClick={() => giveFeedback(i, -1)}
                        className={`rounded-md p-1 transition-colors hover:bg-surface-2 ${m.feedback === -1 ? "text-brand-pink-700" : "text-text-muted"}`}
                      >
                        <ThumbsDown className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-end gap-2 border-t border-border bg-surface p-3"
        >
          <AutoGrowTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={1}
            placeholder="Escreva sua pergunta… (Enter envia)"
            aria-label="Pergunta"
            className={`${controlClass} min-h-11 flex-1 rounded-2xl`}
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            aria-label="Enviar"
            className={`flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-1 transition-transform hover:enabled:scale-105 disabled:opacity-40 ${GRAD}`}
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

