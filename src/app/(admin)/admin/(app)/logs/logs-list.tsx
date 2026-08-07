"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, ScrollText, Wrench, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { CopyButton } from "@/components/ui/copy-button";
import { Segmented } from "@/components/ui/segmented";
import {
  agruparPassos,
  alvoDoCurl,
  chamadaFalhou,
  todosOsCurls,
  verboDoCurl,
  type ChamadaFerramenta,
  type ItemLog,
  type TracePasso,
} from "@/lib/chat/trace-group";

export type { TracePasso };
export type ChatTraceRow = {
  id: string;
  created_at: string;
  conversation_id: string | null;
  base_code: string | null;
  p_usuario: string | null;
  p_portal: string | null;
  p_empresa: string | null;
  p_matricula: string | null;
  p_perfil: string | null;
  pergunta: string | null;
  fonte: string | null;
  desfecho: string | null;
  duracao_ms: number | null;
  passos: TracePasso[];
};

const fmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  timeZone: "America/Sao_Paulo",
});
const dataHora = (iso: string) => fmt.format(new Date(iso)).replace(",", "");

/**
 * Cor da barra lateral do passo. Os passos de DADOS são os que explicam por que uma
 * resposta veio errada — e uma PERDA (dataset não encontrado, poda de emergência,
 * teto de passos estourado) precisa saltar aos olhos no meio de dezenas de linhas.
 */
function corDoPasso(p: TracePasso): string {
  const i = p.info ?? {};
  const perdeu = i.encontrado === false || i.poda_agressiva === true || i.parou_por_teto === true || i.sem_dados === true;
  // `danger` não existe como cor do tema (só como tom de Badge) — usar a paleta
  // direta, como o resto do admin faz.
  if (perdeu) return "border-l-rose-500 bg-rose-500/5";
  if (/^(dataset|query_tool|visual_|integracoes)/.test(p.passo)) return "border-l-primary";
  return "border-l-transparent";
}

/** Cor do "desfecho" para leitura rápida: verde = resposta; âmbar = pergunta/coleta; vermelho = recusa/erro. */
function corDesfecho(d: string | null): string {
  if (!d) return "bg-surface-2 text-text-muted";
  if (d === "resposta") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (d.startsWith("clarify") || d === "coleta") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200";
  if (d.startsWith("recusa") || d.startsWith("erro") || d.startsWith("aviso")) return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200";
  return "bg-brand-blue-100 text-brand-blue-700 dark:bg-brand-blue-900/40 dark:text-brand-blue-200";
}

const CHIPS: [keyof ChatTraceRow, string][] = [
  ["base_code", "Base"], ["p_usuario", "Usuário"], ["p_portal", "Painel"],
  ["p_empresa", "Empresa"], ["p_matricula", "Matrícula"], ["p_perfil", "Perfil"],
];

/** Tom do verbo HTTP: leitura × escrita se distinguem à primeira vista. */
function corVerbo(v: string): string {
  return v === "GET"
    ? "bg-brand-blue-100 text-brand-blue-800 dark:bg-brand-blue-900/40 dark:text-brand-blue-200"
    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
}

/** Pares `chave=valor` dos parâmetros, para o resumo na linha fechada. */
function paresDeParams(params: unknown): [string, string][] {
  if (!params || typeof params !== "object" || Array.isArray(params)) return [];
  return Object.entries(params as Record<string, unknown>)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => {
      const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return [k, s.length > 24 ? s.slice(0, 24) + "…" : s] as [string, string];
    });
}

/**
 * Por que não há cURL. Antes esta linha dizia sempre "veja o erro acima" — e
 * mentia nos dois casos mais comuns de ausência (cache e ferramenta local), onde
 * erro nenhum existe.
 */
function motivoSemCurl(c: ChamadaFerramenta): string {
  if (c.dedup) return "Repetição idêntica no mesmo turno — devolveu o resultado já obtido, sem ir à rede.";
  if (c.cache) return "Servida do cache — a requisição não foi refeita neste turno.";
  if (c.guard) return "Bloqueada antes de chegar à rede (veja a regra de acesso abaixo).";
  if (c.familia && c.familia !== "integracao") return "Ferramenta local — não faz chamada HTTP, então não há cURL.";
  if (c.erro) return "Nenhuma requisição chegou a ser feita (veja o erro acima).";
  return "Nenhuma requisição HTTP foi registrada nesta chamada.";
}

const pretty = (v: unknown) => {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};

/**
 * Cartão de UMA chamada de ferramenta.
 *
 * A linha fechada responde as três perguntas do turno — qual ferramenta, com
 * quais parâmetros, e deu certo? — sem exigir clique nenhum. O cURL, que é
 * volumoso e só interessa quando já se escolheu a chamada suspeita, fica atrás
 * do expansor.
 */
function CartaoFerramenta({ c }: { c: ChamadaFerramenta }) {
  const [aberto, setAberto] = useState(false);
  const falhou = chamadaFalhou(c);
  const verbo = verboDoCurl(c.curl);
  const alvo = alvoDoCurl(c.curl);
  const pares = paresDeParams(c.params);
  const visiveis = pares.slice(0, 4);
  const resto = pares.length - visiveis.length;
  const relato = c.relato ?? {};

  return (
    <div
      className={`rounded-lg border ${falhou ? "border-rose-300 bg-rose-500/5 dark:border-rose-900/60" : "border-border bg-surface"}`}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-start gap-2 px-2.5 py-2 text-left"
        aria-expanded={aberto}
      >
        <span className="mt-0.5 shrink-0">
          {falhou ? (
            <XCircle className="size-4 text-rose-600 dark:text-rose-300" />
          ) : (
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            {verbo && (
              <span className={`rounded px-1 py-0.5 font-mono text-[10px] font-bold ${corVerbo(verbo)}`}>{verbo}</span>
            )}
            <span className="font-mono text-sm font-medium text-text">{c.tool}</span>
            {c.familia && c.familia !== "integracao" && <Badge tone="neutral">{c.familia}</Badge>}
            {c.dedup && <Badge tone="warning">repetida</Badge>}
            {typeof c.requisicoes === "number" && c.requisicoes > 1 && (
              <Badge tone="info">{c.requisicoes} req</Badge>
            )}
            {c.status !== undefined && c.status !== null && (
              <Badge tone={falhou ? "danger" : "info"}>
                HTTP {Array.isArray(c.status) ? c.status.join("/") : String(c.status)}
              </Badge>
            )}
            {c.cache ? <Badge tone="neutral">cache</Badge> : null}
            {c.guard && <Badge tone="danger">bloqueada</Badge>}
            {c.podado?.length ? <Badge tone="warning">log cortado</Badge> : null}
            {typeof c.duracaoMs === "number" && (
              <span className="font-mono text-[11px] tabular-nums text-text-muted">{c.duracaoMs} ms</span>
            )}
          </span>

          {alvo && (
            <span className="mt-0.5 block truncate font-mono text-[11px] text-text-muted" title={alvo.completo}>
              {alvo.curto}
            </span>
          )}

          {visiveis.length > 0 && (
            <span className="mt-1 flex flex-wrap items-center gap-1">
              {visiveis.map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-0.5 rounded bg-surface-2 px-1.5 py-0.5 text-[11px]">
                  <span className="text-text-muted">{k}=</span>
                  <span className="font-medium text-text">{v || "—"}</span>
                </span>
              ))}
              {resto > 0 && <span className="text-[11px] text-text-muted">+{resto}</span>}
            </span>
          )}

          {c.erro && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-300">{c.erro}</span>}

          {relato.sem_dados === true ? (
            <span className="mt-1 block text-[11px] text-text-muted">Nenhum registro retornado.</span>
          ) : relato.dataset ? (
            <span className="mt-1 block text-[11px] text-text-muted">
              {String(relato.total ?? "?")} registro(s)
              {relato.amostra_enviada !== undefined && ` · ${String(relato.amostra_enviada)} enviados ao modelo`}
              {` · ${String(relato.dataset)}`}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 shrink-0 text-text-muted">
          {aberto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
      </button>

      {aberto && (
        <div className="flex flex-col gap-3 border-t border-border px-2.5 py-2.5">
          {c.curl ? (
            <CodeBlock
              titulo={
                c.podado?.includes("curl")
                  ? "cURL CORTADO pelo limite do log — não executa como está"
                  : "cURL da chamada (segredos redigidos — substitua antes de executar)"
              }
              codigo={c.curl}
            />
          ) : (
            <p className="text-xs text-text-muted">{motivoSemCurl(c)}</p>
          )}

          {c.guard && (
            <div className="rounded-lg border border-rose-300 bg-rose-500/5 p-2.5 dark:border-rose-900/60">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">
                Bloqueada pela regra de acesso
              </p>
              <p className="mt-1 text-xs text-text">
                <span className="font-mono">{c.guard.nome}</span>
                {c.guard.erro ? ` — ${c.guard.erro}` : ""}
              </p>
            </div>
          )}

          {c.valores && c.valores.length > 0 && (
            <div>
              <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">
                Valores consultados
              </p>
              <p className="font-mono text-xs text-text">{c.valores.join(", ")}</p>
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">
                Parâmetros enviados
              </span>
              <CopyButton text={pretty(c.params)} />
            </div>
            <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-surface-2 p-2.5 text-xs text-text">
              {pretty(c.params ?? {})}
            </pre>
          </div>

          {c.relato && Object.keys(c.relato).length > 0 && (
            <div>
              <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">
                O que o modelo recebeu
              </p>
              <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-surface-2 p-2.5 text-xs text-text">
                {pretty(c.relato)}
              </pre>
            </div>
          )}

          <p className="text-[11px] text-text-muted">
            A resposta da API não fica aqui — ela é registrada em{" "}
            <a className="text-primary hover:underline" href="/admin/integracoes">
              Integrações › Execuções
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}

type Filtro = "tudo" | "ferramentas" | "falhas";

function PassosDoTurno({ passos }: { passos: TracePasso[] }) {
  const itens = useMemo(() => agruparPassos(passos), [passos]);
  const [filtro, setFiltro] = useState<Filtro>("tudo");

  const chamadas = itens.filter((i): i is Extract<ItemLog, { tipo: "ferramenta" }> => i.tipo === "ferramenta");
  const curls = todosOsCurls(itens);

  // Numera ANTES de filtrar: o índice precisa ser da lista completa para servir de
  // chave estável do React quando o recorte muda.
  const visiveis = itens
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => {
      if (filtro === "tudo") return true;
      if (item.tipo !== "ferramenta") return false;
      return filtro === "ferramentas" || chamadaFalhou(item.chamada);
    });

  return (
    <div className="border-t border-border bg-surface-2 p-4">
      {chamadas.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Segmented<Filtro>
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: "tudo", label: `Todos os passos (${itens.length})` },
              { value: "ferramentas", label: `Ferramentas (${chamadas.length})` },
              { value: "falhas", label: `Falhas (${chamadas.filter((c) => chamadaFalhou(c.chamada)).length})` },
            ]}
          />
          {curls && <CopyButton text={curls} label="Copiar todos os cURLs" />}
        </div>
      )}

      {visiveis.length === 0 ? (
        <p className="text-sm text-text-muted">Nada neste recorte.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {/* Chave estável, NUNCA o índice da lista filtrada: com `key={i}` o React
              reaproveita a instância por posição e o cartão que estava expandido
              passa a mostrar outra chamada quando o filtro muda. */}
          {visiveis.map(({ item, idx }) =>
            item.tipo === "ferramenta" ? (
              <li key={`f${idx}`} className="flex gap-3">
                <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-text-muted">
                  +{item.chamada.ms}ms
                </span>
                <span className="min-w-0 flex-1">
                  <CartaoFerramenta c={item.chamada} />
                </span>
              </li>
            ) : (
              <li key={`p${idx}`} className={`flex gap-3 border-l-2 pl-2 text-sm ${corDoPasso(item.passo)}`}>
                <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-text-muted">
                  +{item.passo.ms}ms
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-text">{item.passo.passo}</span>
                  {item.passo.info && Object.keys(item.passo.info).length > 0 && (
                    <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap break-words rounded bg-surface px-2 py-1 text-xs text-text">
                      {JSON.stringify(item.passo.info, null, 2)}
                    </pre>
                  )}
                </span>
              </li>
            ),
          )}
        </ol>
      )}
    </div>
  );
}

export function LogsList({ rows, limite }: { rows: ChatTraceRow[]; limite: number }) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
        <ScrollText className="mx-auto size-6 text-text-muted" />
        <p className="mt-2 text-sm text-text-muted">Nenhum registro de fluxo para este filtro.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-text-muted">
        <span className="font-semibold text-text">{rows.length}</span> turno(s)
        {rows.length >= limite && ` · mostrando os ${limite} mais recentes — refine os filtros para ver anteriores`}
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const aberta = abertas.has(r.id);
          const chips = CHIPS.filter(([k]) => r[k]).map(([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-text-muted">
              <span className="font-medium">{label}:</span>
              <span className="text-text">{String(r[k])}</span>
            </span>
          ));
          // Contagem no cabeçalho: o dev decide se vale abrir o turno SEM abri-lo.
          // Deriva da MESMA primitiva do painel — contar "tool_call" solto divergia do
          // que a lista mostra e zerava em trace antigo (que só tem integracoes:curl).
          const cartoes = agruparPassos(r.passos ?? []).filter(
            (i): i is Extract<ItemLog, { tipo: "ferramenta" }> => i.tipo === "ferramenta",
          );
          const chamadas = cartoes.length;
          const falhas = cartoes.filter((i) => chamadaFalhou(i.chamada)).length;
          return (
            <div key={r.id} className="overflow-hidden rounded-xl border border-border bg-surface shadow-1">
              <button
                type="button"
                onClick={() => toggle(r.id)}
                className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-surface-2"
                aria-expanded={aberta}
              >
                <span className="mt-0.5 text-text-muted">
                  {aberta ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${corDesfecho(r.desfecho)}`}>
                      {r.desfecho ?? "—"}
                    </span>
                    {chips}
                  </span>
                  <span className="mt-1.5 block truncate text-sm text-text">{r.pergunta || "(sem pergunta)"}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                    <span>{dataHora(r.created_at)}</span>
                    <span>{r.passos?.length ?? 0} passo(s)</span>
                    {r.duracao_ms != null && <span>{r.duracao_ms} ms</span>}
                    {r.fonte && <span>fonte: {r.fonte}</span>}
                    {chamadas > 0 && (
                      <span className="inline-flex items-center gap-1 text-text">
                        <Wrench className="size-3" />
                        {chamadas} chamada(s)
                      </span>
                    )}
                    {falhas > 0 && <Badge tone="danger">{falhas} com falha</Badge>}
                  </span>
                </span>
              </button>

              {aberta && <PassosDoTurno passos={r.passos ?? []} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
