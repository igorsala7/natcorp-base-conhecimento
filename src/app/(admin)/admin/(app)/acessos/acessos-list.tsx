"use client";

import { Download, FileText, Folder, Home, MousePointerClick } from "lucide-react";

export type Acesso = {
  id: string;
  created_at: string;
  node_id: string | null;
  path: string | null;
  title: string | null;
  kind: "home" | "folder" | "article" | string;
  session_id: string | null;
  p_base: string | null;
  p_usuario: string | null;
  p_portal: string | null;
  p_empresa: string | null;
  p_matricula: string | null;
  p_perfil: string | null;
};

const fmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
});
const dataHora = (iso: string) => fmt.format(new Date(iso));

const KIND = {
  home: { label: "Documentação", Icon: Home, cls: "bg-brand-purple-100 text-brand-purple-700" },
  folder: { label: "Diretório", Icon: Folder, cls: "bg-brand-blue-100 text-brand-blue-700" },
  article: { label: "Artigo", Icon: FileText, cls: "bg-success-soft text-success" },
} as const;

const PARAMS: [keyof Acesso, string][] = [
  ["p_empresa", "Empresa"], ["p_usuario", "Usuário"], ["p_matricula", "Matrícula"],
  ["p_perfil", "Perfil"], ["p_portal", "Portal"], ["p_base", "Base"],
];

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs">
      <span className="text-text-muted">{label}:</span>
      <span className="font-medium text-text">{value}</span>
    </span>
  );
}

function csvCell(v: string | null): string {
  return `"${(v ?? "").replace(/"/g, '""')}"`;
}

function exportarCsv(acessos: Acesso[]) {
  const head = ["data", "tipo", "titulo", "caminho", "empresa", "usuario", "matricula", "perfil", "portal", "base", "sessao"];
  const linhas = [head.map((h) => `"${h}"`).join(",")];
  for (const a of acessos) {
    const tipo = (KIND[a.kind as keyof typeof KIND]?.label) ?? a.kind;
    linhas.push([
      dataHora(a.created_at), tipo, a.title, a.path, a.p_empresa, a.p_usuario,
      a.p_matricula, a.p_perfil, a.p_portal, a.p_base, a.session_id,
    ].map(csvCell).join(","));
  }
  const blob = new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = `acessos-${new Date().toISOString().slice(0, 10)}.csv`;
  el.click();
  URL.revokeObjectURL(url);
}

export function AcessosList({
  acessos, limite, paginasDistintas, usuariosDistintos,
}: {
  acessos: Acesso[];
  limite: number;
  paginasDistintas: number;
  usuariosDistintos: number;
}) {
  if (acessos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
        <MousePointerClick className="mx-auto size-6 text-text-muted" />
        <p className="mt-2 text-sm text-text-muted">
          Nenhum acesso registrado para este filtro. Os acessos aparecem quando a visita ao portal traz os
          parâmetros de rastreio (ex.: <code>?p_usuario=joao&amp;p_empresa=ACME</code>).
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          <span className="font-semibold text-text">{acessos.length}</span> acesso(s) ·{" "}
          <span className="font-semibold text-text">{paginasDistintas}</span> página(s) ·{" "}
          <span className="font-semibold text-text">{usuariosDistintos}</span> usuário(s)
          {acessos.length >= limite && ` · mostrando os ${limite} mais recentes`}
        </p>
        <button
          type="button"
          onClick={() => exportarCsv(acessos)}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:border-primary hover:text-primary"
        >
          <Download className="size-4" /> Exportar CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-1">
        <ul className="divide-y divide-border">
          {acessos.map((a) => {
            const k = KIND[a.kind as keyof typeof KIND] ?? KIND.article;
            const Icon = k.Icon;
            const chips = PARAMS.filter(([key]) => a[key]).map(([key, label]) => (
              <Chip key={key} label={label} value={a[key] as string} />
            ));
            return (
              <li key={a.id} className="flex items-start gap-3 p-3.5">
                <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${k.cls}`} aria-hidden>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-text">{a.title || "(sem título)"}</span>
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-text-muted">{k.label}</span>
                  </div>
                  {a.path && <p className="truncate font-mono text-xs text-text-muted">/{a.path}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{chips}</div>
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-text-muted">{dataHora(a.created_at)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
