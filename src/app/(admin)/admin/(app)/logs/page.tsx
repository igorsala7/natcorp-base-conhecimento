import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/auth/permissions";
import { LogsList, type ChatTraceRow } from "./logs-list";

export const metadata: Metadata = { title: "Logs do chat" };

/** Teto de turnos trazidos por consulta (os mais recentes que batem no filtro). */
const LIMITE = 200;

type SP = {
  base?: string;
  usuario?: string;
  portal?: string;
  empresa?: string;
  matricula?: string;
  perfil?: string;
  desfecho?: string;
  de?: string;
  ate?: string;
};

/** Dia seguinte (só a data, UTC) — limite superior exclusivo para incluir o dia todo. */
function proximoDia(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

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
 * Log do FLUXO do chat: o passo a passo de cada turno (classificação, RAG, ontologia,
 * roteador de fonte, coleta, ferramentas montadas, chamadas de tool, resposta) — para
 * rastrear onde a lógica falha. Filtrável por base/cliente, data e os p_* de rastreio.
 */
export default async function LogsPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await hasPermission("ai.configure", null))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Logs do chat</h1>
        <p className="mt-2 text-text-muted">Sem permissão.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const admin = createAdminClient();
  let q = admin
    .from("ai_chat_traces")
    .select("id, created_at, conversation_id, base_code, p_usuario, p_portal, p_empresa, p_matricula, p_perfil, pergunta, fonte, desfecho, duracao_ms, passos")
    .order("created_at", { ascending: false })
    .limit(LIMITE);
  if (sp.de?.trim()) q = q.gte("created_at", `${sp.de}T00:00:00`);
  if (sp.ate?.trim()) q = q.lt("created_at", `${proximoDia(sp.ate)}T00:00:00`);
  if (sp.base?.trim()) q = q.ilike("base_code", `%${sp.base.trim()}%`);
  if (sp.usuario?.trim()) q = q.ilike("p_usuario", `%${sp.usuario.trim()}%`);
  if (sp.portal?.trim()) q = q.ilike("p_portal", `%${sp.portal.trim()}%`);
  if (sp.empresa?.trim()) q = q.ilike("p_empresa", `%${sp.empresa.trim()}%`);
  if (sp.matricula?.trim()) q = q.ilike("p_matricula", `%${sp.matricula.trim()}%`);
  if (sp.perfil?.trim()) q = q.ilike("p_perfil", `%${sp.perfil.trim()}%`);
  if (sp.desfecho?.trim()) q = q.ilike("desfecho", `%${sp.desfecho.trim()}%`);
  const { data, error } = await q;
  const rows = (error ? [] : (data ?? [])) as ChatTraceRow[];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center gap-2">
        <ScrollText className="size-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Logs do chat</h1>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        Passo a passo de cada turno — do envio à resposta. Use para rastrear onde o roteamento/ferramentas falharam.
      </p>

      <form className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3 lg:grid-cols-5">
        <Campo label="Base / cliente" name="base" value={sp.base} placeholder="ex.: natcorp" />
        <Campo label="Usuário" name="usuario" value={sp.usuario} />
        <Campo label="Painel" name="portal" value={sp.portal} />
        <Campo label="Empresa" name="empresa" value={sp.empresa} />
        <Campo label="Matrícula" name="matricula" value={sp.matricula} />
        <Campo label="Perfil" name="perfil" value={sp.perfil} />
        <Campo label="Desfecho" name="desfecho" value={sp.desfecho} placeholder="ex.: resposta, clarify_fonte" />
        <Campo label="De" name="de" value={sp.de} type="date" />
        <Campo label="Até" name="ate" value={sp.ate} type="date" />
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            Filtrar
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          Falha ao carregar: {error.message}
        </p>
      )}

      <div className="mt-5">
        <LogsList rows={rows} limite={LIMITE} />
      </div>
    </div>
  );
}
