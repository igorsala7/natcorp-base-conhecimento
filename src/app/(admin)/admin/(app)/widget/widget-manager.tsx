"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  saveWidgetKey,
  regenerateWidgetKey,
  deleteWidgetKey,
} from "./actions";

export type WidgetKeyRow = {
  id: string;
  space_id: string;
  name: string;
  public_key: string;
  allowed_origins: string[];
  rate_limit: number;
  active: boolean;
  config: {
    primaryColor?: string;
    title?: string;
    welcome?: string;
    avatarUrl?: string;
    suggestions?: string[];
    position?: "right" | "left";
  } | null;
  created_at: string;
};

type SpaceOpt = { id: string; name: string; slug: string };

const INP =
  "w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-sm focus:border-primary focus:outline-none";

type Draft = {
  id?: string;
  spaceId: string;
  name: string;
  allowedOrigins: string;
  rateLimit: number;
  active: boolean;
  primaryColor: string;
  title: string;
  welcome: string;
  avatarUrl: string;
  suggestions: string;
  position: "right" | "left";
};

function rowToDraft(k: WidgetKeyRow): Draft {
  const c = k.config ?? {};
  return {
    id: k.id,
    spaceId: k.space_id,
    name: k.name,
    allowedOrigins: (k.allowed_origins ?? []).join("\n"),
    rateLimit: k.rate_limit,
    active: k.active,
    primaryColor: c.primaryColor ?? "#511C76",
    title: c.title ?? "Assistente",
    welcome: c.welcome ?? "Olá! Como posso ajudar com a documentação?",
    avatarUrl: c.avatarUrl ?? "",
    suggestions: (c.suggestions ?? []).join("\n"),
    position: c.position ?? "right",
  };
}

export function WidgetManager({
  spaces,
  initialKeys,
  siteUrl,
}: {
  spaces: SpaceOpt[];
  initialKeys: WidgetKeyRow[];
  siteUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const spaceName = useMemo(
    () => new Map(spaces.map((s) => [s.id, s.name])),
    [spaces],
  );

  function newDraft() {
    setMsg(null);
    setDraft({
      spaceId: spaces[0]?.id ?? "",
      name: "Widget",
      allowedOrigins: "",
      rateLimit: 30,
      active: true,
      primaryColor: "#511C76",
      title: "Assistente",
      welcome: "Olá! Como posso ajudar com a documentação?",
      avatarUrl: "",
      suggestions: "",
      position: "right",
    });
  }

  function save() {
    if (!draft) return;
    const payload = {
      id: draft.id,
      spaceId: draft.spaceId,
      name: draft.name,
      allowedOrigins: draft.allowedOrigins.split("\n").map((s) => s.trim()).filter(Boolean),
      rateLimit: Number(draft.rateLimit) || 30,
      active: draft.active,
      config: {
        primaryColor: draft.primaryColor,
        title: draft.title,
        welcome: draft.welcome,
        avatarUrl: draft.avatarUrl || undefined,
        suggestions: draft.suggestions.split("\n").map((s) => s.trim()).filter(Boolean),
        position: draft.position,
      },
    };
    startTransition(async () => {
      const r = await saveWidgetKey(payload);
      if (!r.ok) setMsg(r.error);
      else {
        setDraft(null);
        setMsg("Chave salva.");
        router.refresh();
      }
    });
  }

  function regenerate(id: string) {
    if (!confirm("Gerar uma nova chave? A chave atual para de funcionar imediatamente.")) return;
    startTransition(async () => {
      const r = await regenerateWidgetKey(id);
      setMsg(r.ok ? "Nova chave gerada." : r.error);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Excluir esta chave? O widget que a usa deixará de funcionar.")) return;
    startTransition(async () => {
      const r = await deleteWidgetKey(id);
      setMsg(r.ok ? "Chave excluída." : r.error);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Widget e API</h1>
          <p className="mt-1 text-sm text-text-muted">
            Chaves públicas para embutir o chat da documentação em qualquer site.
          </p>
        </div>
        <Button onClick={newDraft}>Nova chave</Button>
      </div>

      {msg && (
        <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm">{msg}</p>
      )}

      {/* Lista de chaves */}
      <div className="space-y-3">
        {initialKeys.length === 0 && !draft && (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
            Nenhuma chave ainda. Crie uma para gerar o snippet de embed.
          </p>
        )}
        {initialKeys.map((k) => (
          <div key={k.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium">{k.name}</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
                {spaceName.get(k.space_id) ?? "?"}
              </span>
              {k.active ? (
                <span className="rounded-full bg-brand-purple-50 px-2 py-0.5 text-xs text-primary dark:bg-brand-purple-950/40">
                  Ativa
                </span>
              ) : (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
                  Inativa
                </span>
              )}
              <span className="text-xs text-text-muted">{k.rate_limit}/min</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setDraft(rowToDraft(k))}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => regenerate(k.id)}>
                  Nova chave
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(k.id)}>
                  Excluir
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-surface-2 px-2 py-1 text-xs">
                {k.public_key}
              </code>
              <CopyButton text={k.public_key} label="Copiar chave" />
            </div>
            <EmbedSnippet siteUrl={siteUrl} publicKey={k.public_key} />
            {(k.allowed_origins?.length ?? 0) === 0 && (
              <p className="mt-2 text-xs text-brand-pink-700">
                ⚠ Sem allowlist de origem: qualquer site pode usar esta chave. Restrinja em produção.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Editor */}
      {draft && (
        <div className="rounded-lg border border-primary/40 bg-surface p-5">
          <h2 className="mb-4 text-lg font-semibold">
            {draft.id ? "Editar chave" : "Nova chave"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <input className={INP} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Espaço (o widget só acessa este espaço)">
              <select
                className={INP}
                value={draft.spaceId}
                disabled={!!draft.id}
                onChange={(e) => setDraft({ ...draft, spaceId: e.target.value })}
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Origens permitidas (uma por linha; vazio = qualquer)">
              <textarea
                className={`${INP} h-20 font-mono text-xs`}
                placeholder="https://app.cliente.com"
                value={draft.allowedOrigins}
                onChange={(e) => setDraft({ ...draft, allowedOrigins: e.target.value })}
              />
            </Field>
            <div className="space-y-4">
              <Field label="Limite (requisições/min por chave)">
                <input
                  type="number"
                  className={INP}
                  value={draft.rateLimit}
                  onChange={(e) => setDraft({ ...draft, rateLimit: Number(e.target.value) })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Ativa
              </label>
            </div>
          </div>

          <h3 className="mb-3 mt-6 text-sm font-semibold text-text-muted">Aparência</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cor primária">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-12 rounded border border-border"
                  value={draft.primaryColor}
                  onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })}
                />
                <input className={`${INP} flex-1`} value={draft.primaryColor} onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })} />
              </div>
            </Field>
            <Field label="Título do widget">
              <input className={INP} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Posição inicial">
              <select
                className={INP}
                value={draft.position}
                onChange={(e) => setDraft({ ...draft, position: e.target.value as "right" | "left" })}
              >
                <option value="right">Direita</option>
                <option value="left">Esquerda</option>
              </select>
            </Field>
            <Field label="Avatar (URL, opcional)">
              <input className={INP} value={draft.avatarUrl} onChange={(e) => setDraft({ ...draft, avatarUrl: e.target.value })} />
            </Field>
            <Field label="Mensagem de boas-vindas">
              <textarea className={`${INP} h-16`} value={draft.welcome} onChange={(e) => setDraft({ ...draft, welcome: e.target.value })} />
            </Field>
            <Field label="Perguntas sugeridas (uma por linha)">
              <textarea className={`${INP} h-16`} value={draft.suggestions} onChange={(e) => setDraft({ ...draft, suggestions: e.target.value })} />
            </Field>
          </div>

          <div className="mt-5 flex gap-2">
            <Button onClick={save} disabled={pending || !draft.spaceId}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      <ApiDocs siteUrl={siteUrl} />

      <style jsx>{`
        :global(.inp) {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--color-border);
          background: var(--color-bg);
          padding: 0.5rem 0.65rem;
          font-size: 0.875rem;
        }
        :global(.inp:focus) {
          outline: none;
          border-color: var(--color-primary);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copiado!" : label}
    </Button>
  );
}

function EmbedSnippet({ siteUrl, publicKey }: { siteUrl: string; publicKey: string }) {
  const snippet = `<script src="${siteUrl}/widget.js" data-key="${publicKey}" async></script>`;
  return (
    <div className="mt-3">
      <span className="mb-1 block text-xs font-medium text-text-muted">
        Cole antes de <code>&lt;/body&gt;</code> no site do cliente:
      </span>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-surface-2 px-2 py-1.5 text-xs">
          {snippet}
        </code>
        <CopyButton text={snippet} label="Copiar" />
      </div>
    </div>
  );
}

function ApiDocs({ siteUrl }: { siteUrl: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 text-sm">
      <h2 className="text-lg font-semibold">API REST</h2>
      <p className="mt-1 text-text-muted">
        Integre do seu jeito. Autentique com a chave pública no header{" "}
        <code>X-Widget-Key</code> (ou <code>Authorization: Bearer pk_…</code>). A
        origem é validada pela allowlist; há rate limit por chave e por IP.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="font-medium">POST {siteUrl}/api/v1/chat <span className="text-text-muted">— chat RAG (streaming SSE)</span></p>
          <pre className="mt-1 overflow-x-auto rounded bg-surface-2 p-3 text-xs">{`curl -N ${siteUrl}/api/v1/chat \\
  -H "X-Widget-Key: pk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Como emito uma nota fiscal?"}]}'

# Resposta: text/event-stream, eventos JSON:
#   data: {"type":"citations","citations":[{"n":1,"title":"…","url":"/docs/…"}]}
#   data: {"type":"token","value":"…"}
#   data: {"type":"done","conversationId":"…"}`}</pre>
        </div>
        <div>
          <p className="font-medium">POST {siteUrl}/api/v1/search <span className="text-text-muted">— busca híbrida (JSON)</span></p>
          <pre className="mt-1 overflow-x-auto rounded bg-surface-2 p-3 text-xs">{`curl ${siteUrl}/api/v1/search \\
  -H "X-Widget-Key: pk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"nota fiscal","limit":8}'

# Resposta: {"results":[{"title","heading_path","snippet","url"}]}`}</pre>
        </div>
      </div>
    </div>
  );
}
