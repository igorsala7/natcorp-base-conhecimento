import type { Metadata } from "next";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { pickSpace } from "@/lib/content/current-space";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { TrackingTabs } from "@/components/admin/tracking-tabs";
import { ConversasList, type Conversa, type ConvMsg } from "./conversas-list";
import { comBase } from "@/lib/base-path";

export const metadata: Metadata = { title: "Conversas" };

/** Teto de conversas trazidas por consulta (as mais recentes que batem no filtro). */
const LIMITE = 300;

type SP = {
  space?: string;
  empresa?: string;
  usuario?: string;
  matricula?: string;
  portal?: string;
  base?: string;
  perfil?: string;
  de?: string;
  ate?: string;
  q?: string;
  feedback?: string;
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
 * Conversas do chatbot/portal, com os parâmetros de rastreio (base, usuário,
 * portal, empresa, matrícula) e a leitura da thread (pergunta + resposta).
 * Leitura sob RLS: só aparecem conversas de documentações onde o usuário tem
 * `content.view`.
 */
export default async function ConversasPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await hasPermission("content.view"))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Conversas</h1>
        <p className="mt-2 text-text-muted">Sem permissão.</p>
      </div>
    );
  }

  const spaces = await listSpaces();
  const sp = await searchParams;
  const atual = await pickSpace(spaces, sp.space);
  if (!atual) return <div className="p-8 text-text-muted">Nenhuma documentação.</div>;

  const supabase = await createClient();

  let q = supabase
    .from("conversations")
    .select("id, created_at, session_id, p_base, p_usuario, p_portal, p_empresa, p_matricula, p_perfil")
    .eq("space_id", atual.id)
    .order("created_at", { ascending: false })
    .limit(LIMITE);

  const filtros: [keyof SP, string][] = [
    ["empresa", "p_empresa"], ["usuario", "p_usuario"], ["matricula", "p_matricula"],
    ["portal", "p_portal"], ["base", "p_base"], ["perfil", "p_perfil"],
  ];
  for (const [param, col] of filtros) {
    const v = sp[param]?.trim();
    if (v) q = q.ilike(col, `%${v}%`);
  }
  if (sp.de) q = q.gte("created_at", sp.de);
  if (sp.ate) q = q.lte("created_at", `${sp.ate}T23:59:59`);

  const { data: convRows } = await q;
  const convs = convRows ?? [];
  const ids = convs.map((c) => c.id);

  // Mensagens de todas as conversas listadas, em ordem cronológica.
  //
  // PAGINADO, e não é detalhe: 300 conversas passam de 1000 mensagens, e o
  // PostgREST corta nesse teto SEM avisar. Como a ordenação é `created_at`
  // ASCENDENTE, o que sobrevivia ao corte eram as mensagens MAIS ANTIGAS —
  // enquanto a lista mostra as conversas mais RECENTES primeiro. Resultado
  // medido: 1745 mensagens no banco, 1000 devolvidas, e as 10 conversas do topo
  // da tela apareciam TODAS vazias. Mesma armadilha da árvore de nós, mesmo
  // remédio (ver fetchAllPaged).
  //
  // O desempate por `id` é obrigatório: sem uma chave única na ordenação, duas
  // mensagens com o mesmo `created_at` podem pular ou repetir na fronteira das
  // fatias.
  let msgs: ConvMsg[] = [];
  if (ids.length) {
    msgs = await fetchAllPaged<ConvMsg>(async (from, to) => {
      const r = await supabase
        .from("messages")
        .select("conversation_id, role, content, citations, feedback, latency_ms, created_at, tokens, input_tokens, output_tokens")
        .in("conversation_id", ids)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      return { data: (r.data ?? []) as ConvMsg[], error: r.error };
    });
  }

  // Agrupa mensagens por conversa.
  const porConversa = new Map<string, ConvMsg[]>();
  for (const m of msgs) {
    const arr = porConversa.get(m.conversation_id) ?? [];
    arr.push(m);
    porConversa.set(m.conversation_id, arr);
  }

  // Filtros que dependem das mensagens (texto e feedback) aplicados em memória.
  const texto = sp.q?.trim().toLowerCase();
  const fb = sp.feedback; // "up" | "down"
  let lista: Conversa[] = convs.map((c) => ({ ...c, messages: porConversa.get(c.id) ?? [] }));
  if (texto) {
    lista = lista.filter((c) => c.messages.some((m) => (m.content ?? "").toLowerCase().includes(texto)));
  }
  if (fb === "up" || fb === "down") {
    const alvo = fb === "up" ? 1 : -1;
    lista = lista.filter((c) => c.messages.some((m) => m.feedback === alvo));
  }

  const temFiltro = Boolean(
    sp.empresa || sp.usuario || sp.matricula || sp.portal || sp.base || sp.perfil || sp.de || sp.ate || sp.q || sp.feedback,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Conversas</h1>
          <p className="mt-1 text-sm text-text-muted">
            O que os usuários perguntaram ao chatbot e ao portal — com os parâmetros de rastreio
            (base, usuário, portal, empresa, matrícula, perfil) que a conversa carregou.{" "}
            <a href={comBase("/admin/widget")} className="font-medium text-primary hover:underline">
              Como enviar os parâmetros? →
            </a>
          </p>
        </div>
        <div className="ml-auto">
          <SpaceSwitcher spaces={spaces} currentId={atual.id} canCreate={false} canManage={false} />
        </div>
      </div>

      <TrackingTabs current="conversas" spaceId={atual.id} />

      {/* Filtros — GET, para o estado viver na URL (compartilhável). */}
      <form method="get" className="mt-6 rounded-xl border border-border bg-surface p-4 shadow-1">
        <input type="hidden" name="space" value={atual.id} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Campo label="Empresa" name="empresa" value={sp.empresa} placeholder="Ex.: ACME" />
          <Campo label="Usuário" name="usuario" value={sp.usuario} placeholder="Ex.: joao" />
          <Campo label="Matrícula" name="matricula" value={sp.matricula} />
          <Campo label="Portal" name="portal" value={sp.portal} />
          <Campo label="Base" name="base" value={sp.base} />
          <Campo label="Perfil" name="perfil" value={sp.perfil} />
          <Campo label="De" name="de" value={sp.de} type="date" />
          <Campo label="Até" name="ate" value={sp.ate} type="date" />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">Feedback</span>
            <select className={inputClass} name="feedback" defaultValue={sp.feedback ?? ""}>
              <option value="">Todos</option>
              <option value="up">👍 Positivo</option>
              <option value="down">👎 Negativo</option>
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-1 lg:col-span-2">
            <span className="text-xs font-medium text-text-muted">Buscar no texto (pergunta ou resposta)</span>
            <input className={inputClass} name="q" defaultValue={sp.q} placeholder="Ex.: férias, nota fiscal…" />
          </label>
          <div className="col-span-2 flex items-end gap-2 lg:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <Search className="size-4" /> Filtrar
            </button>
            {temFiltro && (
              <a
                href={`/admin/conversas?space=${atual.id}`}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:border-primary hover:text-primary"
              >
                Limpar
              </a>
            )}
          </div>
        </div>
      </form>

      <div className="mt-4">
        <ConversasList conversas={lista} limite={LIMITE} totalTrazido={convs.length} />
      </div>
    </div>
  );
}
