"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, ThumbsUp, ThumbsDown, FileText } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { submitPortalChatFeedback } from "@/app/(portal)/actions";

type Citation = { n: number; title: string; url: string; heading_path?: string | null };
type Msg = { role: "user" | "assistant"; content: string; citations?: Citation[]; feedback?: 1 | -1 };

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const askedRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `kb.portal.sid.${spaceSlug}`;
    let sid = localStorage.getItem(key);
    if (!sid) {
      sid = "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(key, sid);
    }
    sidRef.current = sid;
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

  async function ask(question: string) {
    const q = question.trim();
    if (!q || streaming) return;
    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
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
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const chunk of parts) {
          const line = chunk.replace(/^data:\s?/, "").trim();
          if (!line) continue;
          let evt: { type: string; value?: string; citations?: Citation[]; conversationId?: string };
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.type === "citations") cites = evt.citations ?? [];
          else if (evt.type === "token") {
            full += evt.value ?? "";
            updateLast((m) => ({ ...m, content: full }));
            scrollDown();
          } else if (evt.type === "done") {
            convRef.current = evt.conversationId || convRef.current;
            updateLast((m) => ({ ...m, citations: cites }));
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
    void submitPortalChatFeedback(convRef.current ?? "", value);
    setMessages((prev) => prev.map((m, idx) => (idx === i ? { ...m, feedback: value } : m)));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Perguntar à IA">
      <div
        className="absolute inset-0 bg-black/40 motion-safe:animate-[fade_150ms_ease-out]"
        onClick={onClose}
      />
      <div className="relative flex h-dvh w-full max-w-md flex-col border-l border-border bg-bg shadow-2xl motion-safe:animate-[slidein_200ms_ease-out]">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Sparkles className="size-4 text-primary" />
          <span className="font-semibold">Perguntar à IA</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="ml-auto rounded p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-auto p-4">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">
              Faça uma pergunta sobre esta documentação. As respostas citam as fontes.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-fg"
                    : "max-w-full"
                }
              >
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                ) : m.content ? (
                  <Markdown content={m.content} />
                ) : (
                  <span className="inline-flex gap-1">
                    <Dot /> <Dot /> <Dot />
                  </span>
                )}
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                    <p className="text-xs font-medium text-text-muted">Fontes</p>
                    {m.citations.map((c) => (
                      <a
                        key={c.n}
                        href={c.url}
                        className="flex items-start gap-2 rounded-lg border border-border p-2 text-sm no-underline transition-colors hover:border-primary"
                      >
                        <FileText className="mt-0.5 size-4 shrink-0 text-text-muted" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-primary">
                            [{c.n}] {c.title}
                          </span>
                          {c.heading_path && (
                            <span className="block truncate text-[11px] text-text-muted">
                              {c.heading_path}
                            </span>
                          )}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
                {m.role === "assistant" && m.content && i === messages.length - 1 && !streaming && (
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-xs text-text-muted">Útil?</span>
                    <button
                      type="button"
                      aria-label="Útil"
                      onClick={() => giveFeedback(i, 1)}
                      className={`rounded p-1 hover:bg-surface-2 ${m.feedback === 1 ? "text-primary" : "text-text-muted"}`}
                    >
                      <ThumbsUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Não útil"
                      onClick={() => giveFeedback(i, -1)}
                      className={`rounded p-1 hover:bg-surface-2 ${m.feedback === -1 ? "text-brand-pink-700" : "text-text-muted"}`}
                    >
                      <ThumbsDown className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2 border-t border-border p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva sua pergunta…"
            aria-label="Pergunta"
            className="h-11 flex-1 rounded-lg border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            aria-label="Enviar"
            className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-fg disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="inline-block size-1.5 animate-bounce rounded-full bg-text-muted" />;
}
