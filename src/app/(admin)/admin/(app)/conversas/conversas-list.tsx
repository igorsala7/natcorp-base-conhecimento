"use client";

import { useState } from "react";
import {
  ChevronDown, ChevronRight, ThumbsUp, ThumbsDown, Download, User, Bot, MessageSquare, ArrowUp, ArrowDown,
} from "lucide-react";

export type ConvMsg = {
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  citations: unknown;
  feedback: number | null;
  latency_ms: number | null;
  created_at: string;
  tokens: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
};

export type Conversa = {
  id: string;
  created_at: string;
  session_id: string | null;
  p_base: string | null;
  p_usuario: string | null;
  p_portal: string | null;
  p_empresa: string | null;
  p_matricula: string | null;
  p_perfil: string | null;
  messages: ConvMsg[];
};

const fmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
});
const dataHora = (iso: string) => fmt.format(new Date(iso));

// dd/mm/yyyy hh24:mi:ss — data/hora completa por mensagem (sem a vírgula do Intl).
const fmtSeg = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  timeZone: "America/Sao_Paulo",
});
const dataHoraSeg = (iso: string) => fmtSeg.format(new Date(iso)).replace(",", "");
const numTok = (n: number) => n.toLocaleString("pt-BR");

/**
 * Tokens a exibir por mensagem: o custo do turno é medido na chamada que gera a
 * RESPOSTA (entrada = prompt, saída = resposta). Atribuímos a ENTRADA ao envio
 * do usuário (a resposta seguinte carrega o input_tokens) e a SAÍDA à resposta.
 */
function tokensDaMensagem(msgs: ConvMsg[], i: number): { entrada: number | null; saida: number | null } {
  const m = msgs[i]!;
  if (m.role === "assistant") return { entrada: null, saida: m.output_tokens };
  for (let j = i + 1; j < msgs.length; j++) {
    const n = msgs[j]!;
    if (n.role === "assistant") return { entrada: n.input_tokens, saida: null };
    if (n.role === "user") break; // outra pergunta antes de qualquer resposta
  }
  return { entrada: null, saida: null };
}

const PARAMS: [keyof Conversa, string][] = [
  ["p_empresa", "Empresa"], ["p_usuario", "Usuário"], ["p_matricula", "Matrícula"],
  ["p_portal", "Portal"], ["p_base", "Base"], ["p_perfil", "Perfil"],
];

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs">
      <span className="text-text-muted">{label}:</span>
      <span className="font-medium text-text">{value}</span>
    </span>
  );
}

function citasDe(m: ConvMsg): string[] {
  if (!Array.isArray(m.citations)) return [];
  return (m.citations as Array<{ title?: string }>)
    .map((c) => (c && typeof c === "object" ? c.title ?? "" : ""))
    .filter(Boolean);
}

function primeiraPergunta(c: Conversa): string {
  return c.messages.find((m) => m.role === "user")?.content ?? "(sem pergunta)";
}

function csvCell(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function exportarCsv(conversas: Conversa[]) {
  const head = [
    "conversa_id", "data_hora", "empresa", "usuario", "matricula", "portal", "base", "perfil",
    "sessao", "papel", "feedback", "latencia_ms", "tokens_entrada", "tokens_saida", "conteudo",
  ];
  const linhas = [head.map(csvCell).join(",")];
  for (const c of conversas) {
    c.messages.forEach((m, i) => {
      const { entrada, saida } = tokensDaMensagem(c.messages, i);
      linhas.push([
        c.id, dataHoraSeg(m.created_at), c.p_empresa, c.p_usuario, c.p_matricula, c.p_portal, c.p_base, c.p_perfil,
        c.session_id, m.role === "user" ? "usuário" : "assistente",
        m.feedback === 1 ? "positivo" : m.feedback === -1 ? "negativo" : "",
        m.latency_ms, entrada, saida, m.content,
      ].map(csvCell).join(","));
    });
  }
  const blob = new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `conversas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ConversasList({
  conversas, limite, totalTrazido,
}: {
  conversas: Conversa[];
  limite: number;
  totalTrazido: number;
}) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (conversas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
        <MessageSquare className="mx-auto size-6 text-text-muted" />
        <p className="mt-2 text-sm text-text-muted">Nenhuma conversa encontrada para este filtro.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          <span className="font-semibold text-text">{conversas.length}</span> conversa(s)
          {totalTrazido >= limite && ` · mostrando as ${limite} mais recentes — refine os filtros para ver anteriores`}
        </p>
        <button
          type="button"
          onClick={() => exportarCsv(conversas)}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:border-primary hover:text-primary"
          title="Baixar as conversas listadas (uma linha por mensagem)"
        >
          <Download className="size-4" /> Exportar CSV
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {conversas.map((c) => {
          const aberta = abertas.has(c.id);
          const chips = PARAMS.filter(([k]) => c[k]).map(([k, label]) => (
            <Chip key={k} label={label} value={c[k] as string} />
          ));
          const nUser = c.messages.filter((m) => m.role === "user").length;
          const votos = c.messages.reduce(
            (a, m) => (m.feedback === 1 ? { ...a, up: a.up + 1 } : m.feedback === -1 ? { ...a, down: a.down + 1 } : a),
            { up: 0, down: 0 },
          );
          return (
            <div key={c.id} className="overflow-hidden rounded-xl border border-border bg-surface shadow-1">
              <button
                type="button"
                onClick={() => toggle(c.id)}
                className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-surface-2/60"
                aria-expanded={aberta}
              >
                <span className="mt-0.5 text-text-muted">
                  {aberta ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {chips.length ? chips : <span className="text-xs text-text-muted">sem parâmetros de rastreio</span>}
                  </span>
                  <span className="mt-1.5 block truncate text-sm text-text">{primeiraPergunta(c)}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                    <span>{dataHora(c.created_at)}</span>
                    <span>{nUser} pergunta(s)</span>
                    {votos.up > 0 && (
                      <span className="inline-flex items-center gap-1 text-emerald-600"><ThumbsUp className="size-3" />{votos.up}</span>
                    )}
                    {votos.down > 0 && (
                      <span className="inline-flex items-center gap-1 text-rose-600"><ThumbsDown className="size-3" />{votos.down}</span>
                    )}
                    {c.session_id && <span className="font-mono opacity-70">{c.session_id.slice(0, 12)}</span>}
                  </span>
                </span>
              </button>

              {aberta && (
                <div className="flex flex-col gap-3 border-t border-border bg-surface-2/40 p-4">
                  {c.messages.length === 0 && (
                    <p className="text-sm text-text-muted">Sem mensagens registradas.</p>
                  )}
                  {c.messages.map((m, i) => {
                    const citas = citasDe(m);
                    const usuario = m.role === "user";
                    const { entrada, saida } = tokensDaMensagem(c.messages, i);
                    return (
                      <div key={i} className={`flex gap-2.5 ${usuario ? "" : "flex-row"}`}>
                        <span
                          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                            usuario ? "bg-brand-purple-100 text-brand-purple-700" : "bg-brand-blue-100 text-brand-blue-700"
                          }`}
                          aria-hidden
                        >
                          {usuario ? <User className="size-4" /> : <Bot className="size-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                            <span className="font-semibold text-text">{usuario ? "Usuário" : "Assistente"}</span>
                            {m.feedback === 1 && <ThumbsUp className="size-3 text-emerald-600" />}
                            {m.feedback === -1 && <ThumbsDown className="size-3 text-rose-600" />}
                            <span className="font-mono tabular-nums opacity-80">{dataHoraSeg(m.created_at)}</span>
                            {typeof m.latency_ms === "number" && <span>{m.latency_ms} ms</span>}
                            {entrada != null && (
                              <span className="inline-flex items-center gap-0.5 text-brand-purple-700" title="Tokens de entrada (envio do usuário)">
                                <ArrowUp className="size-3" />{numTok(entrada)} tok
                              </span>
                            )}
                            {saida != null && (
                              <span className="inline-flex items-center gap-0.5 text-brand-blue-700" title="Tokens de saída (resposta do chatbot)">
                                <ArrowDown className="size-3" />{numTok(saida)} tok
                              </span>
                            )}
                            {!usuario && saida == null && m.tokens != null && (
                              <span className="opacity-80" title="Total de tokens (registro antigo, sem separação entrada/saída)">
                                {numTok(m.tokens)} tok (total)
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-text">{m.content}</p>
                          {citas.length > 0 && (
                            <p className="mt-1 text-xs text-text-muted">
                              Fontes: {citas.join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
