"use client";

import { useState } from "react";
import { Surface } from "@/components/ui/surface";
import { Copy, Check, ExternalLink, Globe, Lock, KeyRound, Download } from "lucide-react";

/**
 * Mostra a URL pública do espaço para compartilhar com o cliente.
 * - Espaço global → "URL geral" (todos os clientes acessam).
 * - Espaço-cliente → URL específica daquele cliente (documentação customizada).
 * Deixa claro se o espaço está público (compartilhável) ou não.
 */
export function SpacePublicUrl({
  siteUrl,
  spaceId,
  slug,
  name,
  type,
  visibility,
  customDomain,
  canExport,
}: {
  siteUrl: string;
  spaceId: string;
  slug: string;
  name: string;
  type: "global" | "client";
  visibility: "public" | "private" | "password";
  customDomain: string | null;
  canExport?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const url = customDomain
    ? `https://${customDomain}`
    : `${siteUrl}/docs/${slug}`;

  const vis =
    visibility === "public"
      ? { icon: Globe, label: "Pública", cls: "text-primary" }
      : visibility === "password"
        ? { icon: KeyRound, label: "Com senha", cls: "text-brand-pink-700" }
        : { icon: Lock, label: "Privada", cls: "text-brand-pink-700" };
  const VisIcon = vis.icon;

  return (
    <Surface elevation={1} padding="sm" className="mb-3 text-xs">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium text-text-muted">
          {type === "global"
            ? "URL geral — todos os clientes"
            : `URL do cliente · ${name}`}
        </span>
        <span className={`inline-flex items-center gap-1 ${vis.cls}`} title="Visibilidade do espaço">
          <VisIcon className="size-3" />
          {vis.label}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <code className="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1">{url}</code>
        <button
          type="button"
          title="Copiar link"
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded p-1 text-text-muted hover:bg-surface-2 hover:text-text"
        >
          {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          title="Abrir em nova aba"
          className="rounded p-1 text-text-muted hover:bg-surface-2 hover:text-text"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
      {visibility !== "public" && (
        <p className="mt-1.5 text-[11px] text-brand-pink-700">
          Este espaço não é público — só ficará acessível após torná-lo público nas configurações.
        </p>
      )}
      {canExport && (
        <a
          href={`/api/admin/export?space=${spaceId}`}
          className="mt-2 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-text-muted hover:border-primary hover:text-primary"
          title="Exportar este espaço em Markdown + manifest.json (.zip)"
        >
          <Download className="size-3" /> Exportar (.zip)
        </a>
      )}
    </Surface>
  );
}
