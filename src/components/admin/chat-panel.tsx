"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronRight, FileText, Send, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import { controlClass } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { submitChatFeedback } from "@/app/(admin)/admin/(app)/assistente/actions";
import type { SpaceInfo } from "@/lib/content/spaces";

/** Decodifica base64 preservando UTF-8 (atob sozinho corrompe acentos). */
function decodeB64Utf8(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Espelha `RetrievedSource`. `url` nulo = fonte de arquivo, sem página. */
type Citation = {
  n: number;
  title: string;
  url: string | null;
  image?: string | null;
  heading_path?: string | null;
};
const FALHA_RESPOSTA =
  "Não foi possível gerar a resposta agora. As fontes encontradas estão abaixo — tente de novo em instantes ou avise a equipe.";

type Msg = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  feedback?: 1 | -1;
};

export function ChatPanel({
  spaces = [],
  aiReady,
  fixedSpaceId,
  promptOverride,
}: {
  spaces?: SpaceInfo[];
  aiReady: boolean;
  /** Quando vem, a documentação é controlada pela página (esconde o seletor). */
  fixedSpaceId?: string;
  /** Persona de rascunho a testar (página Assistente) — vai no body do /api/chat. */
  promptOverride?: string;
}) {
  const [internalSpaceId, setInternalSpaceId] = useState(spaces[0]?.id ?? "");
  const spaceId = fixedSpaceId ?? internalSpaceId;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const convRef = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Nova conversa (sessão limpa): descarta histórico e o id da conversa. */
  function resetConversation() {
    convRef.current = undefined;
    setMessages([]);
  }

  /** Trocar de espaço isola a sessão por base de cliente: começa do zero. */
  function changeSpace(id: string) {
    if (id === spaceId) return;
    setInternalSpaceId(id);
    resetConversation();
  }

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
          // Só manda quando a página forneceu um rascunho (a página Assistente).
          ...(promptOverride !== undefined ? { promptOverride } : {}),
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
        // Stream vazio = a chamada ao provedor falhou (chave, crédito,
        // timeout). Sem esta mensagem o usuário vê só as fontes e conclui que
        // o produto está quebrado, sem saber o porquê.
        updateLast((m) => ({
          ...m,
          citations,
          content: acc || FALHA_RESPOSTA,
        }));
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

  function giveFeedback(i: number, value: 1 | -1) {
    submitChatFeedback(convRef.current ?? "", value);
    setMessages((prev) => prev.map((m, idx) => (idx === i ? { ...m, feedback: value } : m)));
  }

  return (
    <Surface elevation={1} padding="none" className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border p-2">
        {!fixedSpaceId && (
          <select
            value={spaceId}
            onChange={(e) => changeSpace(e.target.value)}
            className={`${controlClass} h-8 w-auto px-2`}
            aria-label="Espaço"
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.type === "global" ? "🌐 " : "👤 "}
                {s.name}
              </option>
            ))}
          </select>
        )}
        <span className="hidden text-xs text-text-muted sm:inline">
          Só responde com o conteúdo deste espaço.
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="ml-auto"
          onClick={resetConversation}
          disabled={messages.length === 0}
          title="Começar uma conversa nova (limpa o histórico)"
        >
          Nova conversa
        </Button>
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
                // Sanfona FECHADA por padrão: a lista de fontes ocupava mais
                // espaço que a própria resposta e empurrava a leitura para
                // fora da tela.
                <details className="group mt-3 border-t border-border pt-2">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text">
                    <ChevronRight className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                    Fontes
                    <span className="tabular-nums">({m.citations.length})</span>
                  </summary>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {m.citations.map((c) => {
                      // Fonte de arquivo não tem página: vira cartão sem link.
                      const Tag = c.url ? "a" : "div";
                      return (
                      <Tag
                        key={c.n}
                        {...(c.url ? { href: c.url, target: "_blank", rel: "noreferrer" } : {})}
                        className={`flex items-center gap-2 rounded-lg border border-border bg-surface p-2 ${
                          c.url ? "transition-colors hover:border-primary" : ""
                        }`}
                      >
                        {c.image ? (
                          /\.supabase\.co\//.test(c.image) ? (
                            <Image
                              src={c.image}
                              alt=""
                              width={40}
                              height={40}
                              className="size-10 shrink-0 rounded object-cover"
                            />
                          ) : (
                            // Host externo (raro): não passa pelo next/image.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.image}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="size-10 shrink-0 rounded object-cover"
                            />
                          )
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
                      </Tag>
                      );
                    })}
                  </div>
                </details>
              )}
              {m.role === "assistant" && m.content && i === messages.length - 1 && !streaming && (
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-xs text-text-muted">Resposta útil?</span>
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
    </Surface>
  );
}
