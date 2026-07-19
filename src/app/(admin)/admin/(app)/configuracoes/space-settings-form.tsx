"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Lock, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateSpaceSettings } from "./actions";

type Current = {
  id: string;
  name: string;
  slug: string;
  visibility: "public" | "private" | "password";
  custom_domain: string | null;
};

const INP =
  "w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-sm focus:border-primary focus:outline-none";

export function SpaceSettingsForm({
  spaces,
  current,
  siteUrl,
}: {
  spaces: { id: string; name: string; slug: string }[];
  current: Current;
  siteUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(current.name);
  const [visibility, setVisibility] = useState(current.visibility);
  const [customDomain, setCustomDomain] = useState(current.custom_domain ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    startTransition(async () => {
      const r = await updateSpaceSettings({ spaceId: current.id, name, visibility, customDomain });
      setMsg(r.ok ? "Configurações salvas." : r.error);
      if (r.ok) router.refresh();
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
          onChange={(e) => router.push(`/admin/configuracoes?space=${e.target.value}`)}
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
          <input className={INP} value={name} onChange={(e) => setName(e.target.value)} />
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
            <p className="mt-1.5 text-xs text-text-muted">
              A proteção por senha do portal será aplicada; defina a senha na gestão de acessos do espaço.
            </p>
          )}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-muted">Domínio personalizado (opcional)</span>
          <input
            className={INP}
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
      </div>
    </div>
  );
}
