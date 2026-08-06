"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { comBase } from "@/lib/base-path";

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Liste o esquema atual das integrações.",
  "Crie uma ferramenta externa que consulta um CEP na BrasilAPI (GET https://brasilapi.com.br/api/cep/v2/{cep}) e vincule ao agente nati_rh.",
  "Quais ferramentas o agente nati_gestor tem hoje?",
];

export function BuilderChat() {
  const router = useRouter();
  const toast = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(texto?: string) {
    const q = (texto ?? input).trim();
    if (!q || streaming) return;
    setInput("");
    const base: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...base, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const res = await fetch(comBase("/api/integrations/builder"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: base }),
      });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Falha na resposta do construtor.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((prev) => {
          const c = prev.slice();
          c[c.length - 1] = { role: "assistant", content: acc };
          return c;
        });
      }
      if (!acc.trim()) {
        setMessages((prev) => {
          const c = prev.slice();
          c[c.length - 1] = { role: "assistant", content: "_(sem resposta — verifique a IA em Sistema → IA)_" };
          return c;
        });
      }
      router.refresh(); // reflete as mudanças no esquema (canvas e demais abas)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao falar com o construtor.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-text">Construtor de IA</h2>
        <p className="mt-1 text-xs text-text-muted">
          Converse para montar e editar o esquema: ferramentas/APIs, agentes e vínculos. O assistente
          <strong> não apaga nada</strong> nem mexe em credenciais/segredos — isso continua manual nas abas.
        </p>
      </div>

      <div className="flex h-[64vh] flex-col rounded-xl border border-border bg-surface">
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col justify-center">
              <EmptyState
                icon={Sparkles}
                title="O que vamos construir?"
                description="Peça para criar uma ferramenta, montar um agente ou ligar tools a um agente."
              />
              <div className="mx-auto mt-4 flex max-w-xl flex-col gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-left text-sm text-text hover:border-[var(--color-primary)]/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {messages.map((m, i) => (
                <li key={i} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                      m.role === "user" ? "bg-[var(--color-primary)]/12 text-[var(--color-primary)]" : "bg-surface-2 text-text-muted",
                    )}
                  >
                    {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
                  </span>
                  <div
                    className={cn(
                      "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      m.role === "user" ? "bg-[var(--color-primary)] text-white" : "bg-surface-2/60 text-text",
                    )}
                  >
                    {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
                  </div>
                </li>
              ))}
              <div ref={endRef} />
            </ul>
          )}
        </div>

        <div className="border-t border-border p-2.5">
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ex.: crie a tool consultar_cep e vincule ao nati_rh"
              className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:border-[var(--color-primary)]"
            />
            <Button onClick={() => void send()} disabled={streaming || !input.trim()} title="Enviar">
              <Send />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
