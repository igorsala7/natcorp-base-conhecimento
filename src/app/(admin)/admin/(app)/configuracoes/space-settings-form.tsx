"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Globe, Lock, KeyRound, Sparkles, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import { updateSpaceSettings, clearSpaceEmbeddings } from "./actions";

type Current = {
  id: string;
  name: string;
  slug: string;
  visibility: "public" | "private" | "password";
  custom_domain: string | null;
};

export function SpaceSettingsForm({
  spaces,
  current,
  hasPassword,
  siteUrl,
}: {
  spaces: { id: string; name: string; slug: string }[];
  current: Current;
  hasPassword: boolean;
  siteUrl: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(current.name);
  const [visibility, setVisibility] = useState(current.visibility);
  const [customDomain, setCustomDomain] = useState(current.custom_domain ?? "");
  const [slug, setSlug] = useState(current.slug);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  function clearEmbeddings() {
    if (
      !window.confirm(
        `Limpar os embeddings de TODO o conteúdo de "${current.name}"?\n\n` +
          "A busca por texto continua funcionando, mas a busca semântica e o assistente " +
          "ficarão sem vetores até você gerar novamente.",
      )
    )
      return;
    setClearing(true);
    setClearMsg(null);
    startTransition(async () => {
      const r = await clearSpaceEmbeddings(current.id);
      setClearing(false);
      setClearMsg(
        r.ok
          ? `Embeddings limpos: ${r.count} trecho(s). Gere novamente pela árvore de conteúdo.`
          : r.error,
      );
      if (r.ok) router.refresh();
    });
  }

  function save() {
    if (visibility === "password" && !hasPassword && !password) {
      setMsg("Defina uma senha para proteger este espaço.");
      return;
    }
    startTransition(async () => {
      const r = await updateSpaceSettings({ spaceId: current.id, name, slug, visibility, customDomain, password });
      setMsg(r.ok ? "Configurações salvas." : r.error);
      if (r.ok) {
        setPassword("");
        router.refresh();
      }
    });
  }

  const VIS = [
    { key: "public", label: "Pública", desc: "Qualquer um acessa pela URL.", icon: Globe },
    { key: "private", label: "Privada", desc: "Só usuários autenticados do espaço.", icon: Lock },
    { key: "password", label: "Com senha", desc: "Exige senha para abrir.", icon: KeyRound },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
          <p className="mt-1 text-sm text-text-muted">Nome, visibilidade e domínio do espaço.</p>
        </div>
        <select
          value={current.id}
          onChange={(e) => {
            // Mantém `from`: sem ele o botão de voltar perde o destino.
            const params = new URLSearchParams(searchParams.toString());
            params.set("space", e.target.value);
            router.push(`/admin/configuracoes?${params.toString()}`);
          }}
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          aria-label="Espaço"
        >
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {msg && <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm">{msg}</p>}

      <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-muted">Nome</span>
          <input className={controlClass} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-muted">Endereço público</span>
          <div className="flex items-center gap-1">
            <span className="shrink-0 text-sm text-text-muted">/docs/</span>
            <input
              className={controlClass}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="minha-documentacao"
            />
          </div>
          <span className="mt-1 block text-xs leading-relaxed text-text-muted">
            {slug !== current.slug ? (
              <strong className="font-medium text-primary">
                Ao salvar, <code>/docs/{current.slug}</code> passa a redirecionar (301) para o novo
                endereço — os links já compartilhados continuam funcionando.
              </strong>
            ) : (
              <>Trocar o endereço não quebra links antigos: eles passam a redirecionar.</>
            )}
          </span>
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-text-muted">Visibilidade</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {VIS.map((v) => {
              const Icon = v.icon;
              const active = visibility === v.key;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setVisibility(v.key)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    active ? "border-primary bg-brand-purple-50 dark:bg-brand-purple-950/30" : "border-border hover:border-primary/50"
                  }`}
                >
                  <Icon className={`size-4 ${active ? "text-primary" : "text-text-muted"}`} />
                  <div className="mt-1 text-sm font-medium">{v.label}</div>
                  <div className="text-xs text-text-muted">{v.desc}</div>
                </button>
              );
            })}
          </div>
          {visibility === "password" && (
            <div className="mt-3 rounded-lg border border-border bg-bg p-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-text-muted">
                  {hasPassword ? "Nova senha (deixe em branco para manter)" : "Definir senha"}
                </span>
                <input
                  type="password"
                  className={controlClass}
                  placeholder={hasPassword ? "••••••••" : "mínimo 4 caracteres"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <p className="mt-1.5 text-xs text-text-muted">
                O portal pedirá esta senha antes de mostrar a documentação deste espaço.
                {hasPassword && " Uma senha já está definida."}
              </p>
            </div>
          )}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-muted">Domínio personalizado (opcional)</span>
          <input
            className={controlClass}
            placeholder="docs.cliente.com"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
          />
          <span className="mt-1 block text-xs text-text-muted">
            Sem domínio, a URL pública é <code>{siteUrl}/docs/{current.slug}</code>. O apontamento DNS do domínio é configurado à parte.
          </span>
        </label>

        <div className="flex justify-end">
          <Button onClick={save} disabled={pending}>
            {pending ? "Salvando…" : "Salvar configurações"}
          </Button>
        </div>

        {/* Manutenção do índice semântico */}
        <div className="mt-2 rounded-lg border border-border p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-text-muted" /> Índice semântico (embeddings)
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Remove os vetores de <strong>todo o conteúdo de “{current.name}”</strong>. A busca por
            texto continua funcionando; a busca semântica e o assistente ficam sem vetores até você
            gerar de novo (botão <em>Gerar embeddings</em> na pasta, dentro da árvore de conteúdo).
            Use ao trocar de modelo/provedor de embedding.
          </p>
          {clearMsg && <p className="mt-2 text-xs text-text-muted">{clearMsg}</p>}
          <div className="mt-3">
            <Button variant="secondary" onClick={clearEmbeddings} disabled={clearing}>
              <Eraser /> {clearing ? "Limpando…" : "Limpar embeddings"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
