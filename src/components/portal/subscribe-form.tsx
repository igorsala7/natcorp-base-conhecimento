"use client";

import { useState } from "react";
import { BellRing, Loader2, MailCheck } from "lucide-react";
import { Select } from "@/components/ui/select";

const FREQUENCIAS = [
  { value: "instant", label: "Assim que publicar" },
  { value: "daily", label: "Resumo diário" },
  { value: "weekly", label: "Resumo semanal" },
] as const;

/**
 * Região "Receber novidades" da home pública: e-mail + frequência → double
 * opt-in por e-mail. Sem conta, sem senha — o token do e-mail confirma e
 * descadastra.
 */
export function SubscribeForm({ spaceSlug }: { spaceSlug: string }) {
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<string>("weekly");
  const [estado, setEstado] = useState<"idle" | "enviando" | "pendente" | "ok" | "erro">("idle");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    setErro(null);
    try {
      const res = await fetch("/api/portal/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceSlug, email, frequency }),
      });
      const data = (await res.json()) as { ok: boolean; pending?: boolean; error?: string };
      if (!data.ok) {
        setErro(data.error ?? "Falha ao inscrever.");
        setEstado("erro");
        return;
      }
      setEstado(data.pending ? "pendente" : "ok");
    } catch {
      setErro("Falha de rede. Tente novamente.");
      setEstado("erro");
    }
  }

  if (estado === "pendente" || estado === "ok") {
    return (
      <section aria-label="Receber novidades" className="mt-14 rounded-xl border border-border bg-surface p-6">
        <p className="flex items-center gap-2.5 text-sm">
          <MailCheck className="size-5 shrink-0 text-primary" />
          {estado === "pendente"
            ? "Quase lá — confirme a inscrição pelo link que enviamos ao seu e-mail."
            : "Inscrição ativa. Você receberá as novidades desta documentação."}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Receber novidades" className="mt-14 rounded-xl border border-border bg-surface p-6">
      <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold">
        <BellRing className="size-4 text-primary" /> Receba as novidades
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Artigos novos e atualizações desta documentação, direto no seu e-mail.
      </p>
      <form onSubmit={enviar} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com.br"
          aria-label="Seu e-mail"
          className="h-10 min-w-52 flex-1 rounded-md border border-border-strong bg-bg px-3 text-sm focus:border-primary focus:outline-none"
        />
        <Select
          value={frequency}
          onChange={(v) => setFrequency(v)}
          aria-label="Frequência"
          className="h-10 rounded-md border border-border-strong bg-bg px-2 text-sm focus:border-primary focus:outline-none"
        >
          {FREQUENCIAS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <button
          type="submit"
          disabled={estado === "enviando"}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg shadow-1 transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {estado === "enviando" && <Loader2 className="size-4 animate-spin" />}
          Inscrever
        </button>
      </form>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-brand-pink-700">
          {erro}
        </p>
      )}
      <p className="mt-2 text-xs text-text-muted">
        Confirmação por e-mail; descadastro em um clique em qualquer envio.
      </p>
    </section>
  );
}
