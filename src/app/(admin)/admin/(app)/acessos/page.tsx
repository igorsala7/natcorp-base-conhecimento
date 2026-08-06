import type { Metadata } from "next";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { pickSpace } from "@/lib/content/current-space";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { TrackingTabs } from "@/components/admin/tracking-tabs";
import { AcessosList, type Acesso } from "./acessos-list";
import { comBase } from "@/lib/base-path";

export const metadata: Metadata = { title: "Acessos" };

const LIMITE = 500;

type SP = {
  space?: string;
  empresa?: string;
  usuario?: string;
  matricula?: string;
  portal?: string;
  base?: string;
  perfil?: string;
  kind?: string;
  de?: string;
  ate?: string;
  q?: string;
};

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus-ring/40";

function Campo({ label, name, value, type = "text", placeholder }: {
  label: string; name: string; value?: string; type?: string; placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <input className={inputClass} name={name} defaultValue={value} type={type} placeholder={placeholder} />
    </label>
  );
}

/**
 * Acessos às páginas do portal (documentações, diretórios e artigos), com os
 * parâmetros de rastreio de quem acessou. Leitura sob RLS (content.view).
 */
export default async function AcessosPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await hasPermission("content.view"))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Acessos</h1>
        <p className="mt-2 text-text-muted">Sem permissão.</p>
      </div>
    );
  }

  const spaces = await listSpaces();
  const sp = await searchParams;
  const atual = await pickSpace(spaces, sp.space);
  if (!atual) return <div className="p-8 text-text-muted">Nenhuma documentação.</div>;

  const supabase = await createClient();

  let query = supabase
    .from("page_views")
    .select("id, created_at, node_id, path, title, kind, session_id, p_base, p_usuario, p_portal, p_empresa, p_matricula, p_perfil")
    .eq("space_id", atual.id)
    .order("created_at", { ascending: false })
    .limit(LIMITE);

  const filtros: [keyof SP, string][] = [
    ["empresa", "p_empresa"], ["usuario", "p_usuario"], ["matricula", "p_matricula"],
    ["portal", "p_portal"], ["base", "p_base"], ["perfil", "p_perfil"],
  ];
  for (const [param, col] of filtros) {
    const v = sp[param]?.trim();
    if (v) query = query.ilike(col, `%${v}%`);
  }
  if (sp.kind === "home" || sp.kind === "folder" || sp.kind === "article") query = query.eq("kind", sp.kind);
  if (sp.q?.trim()) {
    // Remove o que quebraria a sintaxe do `.or()` do PostgREST (vírgula/parênteses).
    const t = sp.q.trim().replace(/[(),]/g, " ");
    query = query.or(`title.ilike.%${t}%,path.ilike.%${t}%`);
  }
  if (sp.de) query = query.gte("created_at", sp.de);
  if (sp.ate) query = query.lte("created_at", `${sp.ate}T23:59:59`);

  const { data } = await query;
  const acessos = (data ?? []) as Acesso[];

  // Resumo.
  const paginas = new Set(acessos.map((a) => a.node_id ?? a.path ?? "?")).size;
  const usuarios = new Set(acessos.map((a) => a.p_usuario).filter(Boolean)).size;

  const temFiltro = Boolean(
    sp.empresa || sp.usuario || sp.matricula || sp.portal || sp.base || sp.perfil || sp.kind || sp.de || sp.ate || sp.q,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Acessos às páginas</h1>
          <p className="mt-1 text-sm text-text-muted">
            Quais documentações, diretórios e artigos cada usuário abriu no portal — registrado quando a
            visita traz os parâmetros de rastreio (<code>p_usuario</code>, <code>p_empresa</code>…).{" "}
            <a href={comBase("/admin/widget")} className="font-medium text-primary hover:underline">
              Como enviar os parâmetros? →
            </a>
          </p>
        </div>
        <div className="ml-auto">
          <SpaceSwitcher spaces={spaces} currentId={atual.id} canCreate={false} canManage={false} />
        </div>
      </div>

      <TrackingTabs current="acessos" spaceId={atual.id} />

      <form method="get" className="mt-6 rounded-xl border border-border bg-surface p-4 shadow-1">
        <input type="hidden" name="space" value={atual.id} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Campo label="Empresa" name="empresa" value={sp.empresa} placeholder="Ex.: ACME" />
          <Campo label="Usuário" name="usuario" value={sp.usuario} placeholder="Ex.: joao" />
          <Campo label="Matrícula" name="matricula" value={sp.matricula} />
          <Campo label="Perfil" name="perfil" value={sp.perfil} />
          <Campo label="Portal" name="portal" value={sp.portal} />
          <Campo label="Base" name="base" value={sp.base} />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">Tipo de página</span>
            <select className={inputClass} name="kind" defaultValue={sp.kind ?? ""}>
              <option value="">Todas</option>
              <option value="home">Documentação</option>
              <option value="folder">Diretório</option>
              <option value="article">Artigo</option>
            </select>
          </label>
          <Campo label="De" name="de" value={sp.de} type="date" />
          <Campo label="Até" name="ate" value={sp.ate} type="date" />
          <label className="col-span-2 flex flex-col gap-1 lg:col-span-2">
            <span className="text-xs font-medium text-text-muted">Buscar por título ou caminho</span>
            <input className={inputClass} name="q" defaultValue={sp.q} placeholder="Ex.: nota fiscal, financeiro…" />
          </label>
          <div className="col-span-2 flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <Search className="size-4" /> Filtrar
            </button>
            {temFiltro && (
              <a
                href={`/admin/acessos?space=${atual.id}`}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:border-primary hover:text-primary"
              >
                Limpar
              </a>
            )}
          </div>
        </div>
      </form>

      <div className="mt-4">
        <AcessosList acessos={acessos} limite={LIMITE} paginasDistintas={paginas} usuariosDistintos={usuarios} />
      </div>
    </div>
  );
}
