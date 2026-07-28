"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Copy, RefreshCw, Check, KeyRound, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Input, controlClass } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { eyebrowLabel } from "@/components/ui/field";
import {
  createExtensionToken,
  listExtensionTokens,
  revokeExtensionToken,
  listExtensionSessions,
  type ExtTokenRow,
  type ExtSessionRow,
} from "./extension-actions";

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso)) : "—";

/** Sistema → Extensão (Fase 5.0): tokens pessoais + sessões recentes. */
export function ExtensionPanel() {
  const toast = useToast();
  const { confirmar } = useConfirm();
  const [tokens, setTokens] = useState<ExtTokenRow[]>([]);
  const [sessions, setSessions] = useState<ExtSessionRow[]>([]);
  const [label, setLabel] = useState("");
  const [novo, setNovo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(() => {
    void listExtensionTokens().then(setTokens);
    void listExtensionSessions().then(setSessions);
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function gerar() {
    setGerando(true);
    const r = await createExtensionToken(label);
    setGerando(false);
    if (r.ok) {
      setNovo(r.token);
      setCopiado(false);
      setLabel("");
      carregar();
    } else toast.error(r.error);
  }

  async function copiar() {
    if (!novo) return;
    try {
      await navigator.clipboard.writeText(novo);
      setCopiado(true);
      toast.success("Token copiado.");
    } catch {
      toast.error("Não foi possível copiar — selecione e copie manualmente.");
    }
  }

  async function revogar(t: ExtTokenRow) {
    const ok = await confirmar({
      title: "Revogar token?",
      description: `O token ${t.token_prefix} deixa de funcionar imediatamente. Esta ação não pode ser desfeita.`,
      confirmLabel: "Revogar",
      tone: "danger",
    });
    if (!ok) return;
    const r = await revokeExtensionToken(t.id);
    if (r.ok) {
      toast.success("Token revogado.");
      carregar();
    } else toast.error(r.error ?? "Falhou.");
  }

  return (
    <div className="mt-6 space-y-6">
      <Surface elevation={1} padding="lg">
        <div className="flex items-center gap-2">
          <Puzzle className="size-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Extensão de navegador</h2>
            <p className="text-sm text-text-muted">
              Documente enquanto navega. Gere um token pessoal e cole-o na extensão.
            </p>
          </div>
        </div>

        {/* Gerar token */}
        <div className="mt-5 flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[12rem]">
            <span className={eyebrowLabel}>Rótulo (opcional)</span>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Meu notebook"
              className="mt-1"
            />
          </label>
          <Button onClick={() => void gerar()} disabled={gerando}>
            <Plus className="size-4" /> Gerar token
          </Button>
        </div>

        {/* Token recém-criado (mostrado uma vez) */}
        {novo && (
          <div className="mt-4 rounded-lg border border-brand-purple-200 bg-brand-purple-50/60 p-3 dark:border-brand-purple-900 dark:bg-brand-purple-950/40">
            <p className="text-xs font-medium text-primary">
              Copie agora — por segurança, o token não será mostrado de novo.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className={`${controlClass} flex-1 select-all overflow-x-auto whitespace-nowrap font-mono text-xs`}>
                {novo}
              </code>
              <Button size="sm" variant="secondary" onClick={() => void copiar()}>
                {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copiado ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>
        )}

        {/* Lista de tokens */}
        <div className="mt-5">
          <span className={eyebrowLabel}>Tokens</span>
          {tokens.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">Nenhum token ainda.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {tokens.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                  <KeyRound className="size-4 shrink-0 text-text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t.label || "Sem rótulo"}{" "}
                      <span className="font-mono text-xs text-text-muted">{t.token_prefix}</span>
                    </p>
                    <p className="text-xs text-text-muted">
                      Criado {fmt(t.created_at)} · Último uso {fmt(t.last_used_at)}
                    </p>
                  </div>
                  {t.revoked_at ? (
                    <Badge tone="neutral">Revogado</Badge>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void revogar(t)}
                      className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-danger"
                      title="Revogar"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Surface>

      {/* Como instalar */}
      <Surface elevation={1} padding="lg">
        <span className={eyebrowLabel}>Como instalar a extensão</span>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-text">
          <li>
            Abra <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">chrome://extensions</code> e ligue o{" "}
            <strong>Modo do desenvolvedor</strong>.
          </li>
          <li>
            Clique em <strong>Carregar sem compactação</strong> e escolha a pasta{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">apps/extension</code> do projeto.
          </li>
          <li>
            Abra a extensão, informe o endereço da plataforma abaixo e{" "}
            <strong>entre com seu e-mail e senha</strong> (os tokens acima são só uma alternativa avançada):
          </li>
        </ol>
        <code
          suppressHydrationWarning
          className={`${controlClass} mt-2 block select-all overflow-x-auto whitespace-nowrap font-mono text-xs`}
        >
          {typeof window !== "undefined" ? window.location.origin : "…"}
        </code>
        <p className="mt-3 text-xs text-text-muted">
          <strong>Privacidade:</strong> prints e áudios ficam em armazenamento privado; segredos na
          querystring das URLs são redigidos. Revise cada captura antes de gerar o rascunho e exclua o
          que tiver dados sensíveis — abra uma sessão para revisar/descartar/excluir.
        </p>
      </Surface>

      {/* Sessões recentes */}
      <Surface elevation={1} padding="lg">
        <div className="flex items-center justify-between">
          <span className={eyebrowLabel}>Sessões recentes</span>
          <button
            type="button"
            onClick={carregar}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <RefreshCw className="size-3.5" /> Atualizar
          </button>
        </div>
        {sessions.length === 0 ? (
          <EmptyState
            className="mt-3"
            title="Nenhuma sessão ainda"
            description="Inicie uma sessão pela extensão para vê-la aparecer aqui."
          />
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                <Link href={`/admin/extensao/${s.id}`} className="min-w-0 flex-1 rounded-md hover:opacity-80">
                  <p className="truncate text-sm font-medium">{s.title || "Sessão sem título"}</p>
                  <p className="font-mono text-xs text-text-muted">
                    {s.id.slice(0, 8)} · {s.event_count} evento(s) · {fmt(s.started_at)}
                  </p>
                </Link>
                {s.node_id && (
                  <Link href="/admin/conteudo" className="shrink-0 text-xs font-medium text-primary hover:underline">
                    Rascunho →
                  </Link>
                )}
                <Badge tone={s.status === "active" ? "success" : "neutral"}>
                  {s.status === "active" ? "Ativa" : s.status === "finalized" ? "Finalizada" : "Cancelada"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}
