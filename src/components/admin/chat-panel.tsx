"use client";

import { useRef, useState } from "react";
import { FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import type { SpaceInfo } from "@/lib/content/spaces";

/** Decodifica base64 preservando UTF-8 (atob sozinho corrompe acentos). */
function decodeB64Utf8(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

type Citation = {
  n: number;
  title: string;
  url: string;
  image?: string | null;
  heading_path?: string | null;
};
type Msg = { role: "user" | "assistant"; content: string; citations?: Citation[] };

export function ChatPanel({
  spaces,
  aiReady,
}: {
  spaces: SpaceInfo[];
  aiReady: boolean;
}) {
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const convRef = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send() {
    const q = input.trim();
    if (!q || streaming || !spaceId) return;
    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          conversationId: convRef.current,
        }),
      });
      convRef.current = res.headers.get("X-Conversation-Id") || convRef.current;
      let citations: Citation[] = [];
      try {
        citations = JSON.parse(decodeB64Utf8(res.headers.get("X-Citations") || "W10="));
      } catch {
        citations = [];
      }

      if (!res.body) {
        const err = await res.json().catch(() => ({}));
        updateLast((m) => ({ ...m, content: err.error ?? "Falha." }));
      } else {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          updateLast((m) => ({ ...m, content: acc }));
        }
        updateLast((m) => ({ ...m, citations }));
      }
    } catch (e) {
      updateLast((m) => ({ ...m, content: "Erro: " + (e instanceof Error ? e.message : String(e)) }));
    } finally {
      setStreaming(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));
    }
  }

  function updateLast(fn: (m: Msg) => Msg) {
    setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)));
    requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <select
          value={spaceId}
          onChange={(e) => setSpaceId(e.target.value)}
          className="h-8 rounded-md border border-border bg-surface px-2 text-sm"
          aria-label="Espaço"
        >
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.type === "global" ? "🌐 " : "👤 "}
              {s.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-text-muted">
          O assistente só responde com o conteúdo deste espaço.
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-auto p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">
            Faça uma pergunta sobre a documentação.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-fg"
                  : "max-w-[85%]"
              }
            >
              {m.role === "user" ? (
                <p className="whitespace-pre-wrap text-sm">{m.content || "…"}</p>
              ) : m.content ? (
                <Markdown content={m.content} />
              ) : (
                <p className="text-sm text-text-muted">…</p>
              )}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-2 text-xs font-medium text-text-muted">Fontes</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {m.citations.map((c) => (
                      <a
                        key={c.n}
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2 transition-colors hover:border-primary"
                      >
                        {c.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.image}
                            alt=""
                            className="size-10 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="flex size-10 shrink-0 items-center justify-center rounded bg-surface-2 text-text-muted">
                            <FileText className="size-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-medium text-primary">
                            [{c.n}] {c.title}
                          </span>
                          {c.heading_path && (
                            <span className="block truncate text-[11px] text-text-muted">
                              {c.heading_path}
                            </span>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-border p-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={aiReady ? "Pergunte algo…" : "Configure AI_API_KEY para usar"}
          disabled={streaming || !aiReady}
        />
        <Button size="icon" onClick={send} disabled={streaming || !aiReady}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
