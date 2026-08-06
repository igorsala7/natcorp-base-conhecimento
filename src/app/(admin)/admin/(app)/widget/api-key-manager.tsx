"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Field } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { saveWidgetKey, regenerateWidgetKey, deleteWidgetKey } from "./actions";
import { Select } from "@/components/ui/select";

export type ApiKeyRow = {
  id: string;
  space_id: string;
  name: string;
  public_key: string;
  allowed_origins: string[];
  rate_limit: number;
  active: boolean;
  created_at: string;
};

type Draft = {
  id?: string;
  spaceId: string;
  name: string;
  allowedOrigins: string;
  rateLimit: number;
  active: boolean;
};

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      }}
      title={label}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:border-primary hover:text-primary"
    >
      {copiado ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      {copiado ? "Copiado" : label}
    </button>
  );
}

/**
 * Gestão das CHAVES DE API (kind='api') e documentação dos endpoints REST.
 * A chave é a mesma credencial do widget (pk_), mas aqui o foco é acesso
 * programático: sem visual/persona — só nome, origens permitidas e rate limit.
 */
export function ApiKeyManager({
  keys,
  spaces,
  fixedSpaceId,
  siteUrl,
}: {
  keys: ApiKeyRow[];
  spaces: { id: string; name: string }[];
  /** Quando definido (aba do Chatbot), as chaves ficam presas nesta documentação. */
  fixedSpaceId?: string;
  siteUrl: string;
}) {
  const router = useRouter();
  const { confirmar } = useConfirm();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  const base = `${siteUrl.replace(/\/$/, "")}/api/v1`;
  const nomeEspaco = (id: string) => spaces.find((s) => s.id === id)?.name ?? "documentação";

  function novo() {
    setDraft({
      spaceId: fixedSpaceId ?? spaces[0]?.id ?? "",
      name: "Integração",
      allowedOrigins: "",
      rateLimit: 60,
      active: true,
    });
  }

  function editar(k: ApiKeyRow) {
    setDraft({
      id: k.id,
      spaceId: k.space_id,
      name: k.name,
      allowedOrigins: k.allowed_origins.join("\n"),
      rateLimit: k.rate_limit,
      active: k.active,
    });
  }

  function salvar() {
    if (!draft) return;
    startTransition(async () => {
      const r = await saveWidgetKey({
        id: draft.id,
        spaceId: draft.spaceId,
        name: draft.name,
        allowedOrigins: draft.allowedOrigins.split("\n").map((s) => s.trim()).filter(Boolean),
        rateLimit: Number(draft.rateLimit) || 60,
        active: draft.active,
        config: {},
        kind: "api",
        scopeSpaceIds: [draft.spaceId],
        systemPrompt: null,
      });
      if (!r.ok) toast.error(r.error);
      else {
        setDraft(null);
        toast.success("Chave salva.");
        router.refresh();
      }
    });
  }

  async function regenerar(id: string) {
    if (
      !(await confirmar({
        title: "Gerar nova chave",
        description: "A chave atual para de funcionar imediatamente — toda integração que a usa precisa ser atualizada.",
        tone: "danger",
        confirmLabel: "Gerar nova",
      }))
    )
      return;
    startTransition(async () => {
      const r = await regenerateWidgetKey(id);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Nova chave gerada.");
        router.refresh();
      }
    });
  }

  async function excluir(id: string) {
    if (
      !(await confirmar({
        title: "Excluir chave de API",
        description: "A chave para de funcionar imediatamente. Esta ação não pode ser desfeita.",
        tone: "danger",
        confirmLabel: "Excluir",
      }))
    )
      return;
    startTransition(async () => {
      const r = await deleteWidgetKey(id);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Chave excluída.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Chaves de API</h2>
          <p className="mt-1 text-sm text-text-muted">
            Acesso programático aos endpoints REST desta documentação (chat com IA, busca).
            Autenticação por chave <code className="rounded bg-surface-2 px-1">pk_…</code> + allowlist de
            origem + rate limit.
          </p>
        </div>
        <Button onClick={novo} disabled={pending}>
          <Plus className="size-4" /> Nova chave de API
        </Button>
      </div>

      {/* Formulário de criação/edição */}
      {draft && (
        <Surface elevation={1} padding="lg" className="space-y-4">
          <h3 className="text-sm font-semibold">{draft.id ? "Editar chave" : "Nova chave de API"}</h3>
          {!fixedSpaceId && (
            <Field label="Documentação" htmlFor="api-doc" hint="Qual documentação esta chave consulta (chat e busca).">
              <Select
                id="api-doc"
                value={draft.spaceId}
                onChange={(v) => setDraft({ ...draft, spaceId: v })}
                disabled={!!draft.id}
               
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Nome" htmlFor="api-nome" hint="Só para você identificar (ex.: 'Site institucional', 'Backend').">
            <Input id="api-nome" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} />
          </Field>
          <Field
            label="Origens permitidas (uma por linha)"
            htmlFor="api-origens"
            hint="Deixe VAZIO para uso servidor-a-servidor (sem navegador). Para chamadas do navegador, liste os domínios (ex.: https://app.suaempresa.com)."
          >
            <textarea
              id="api-origens"
              value={draft.allowedOrigins}
              onChange={(e) => setDraft({ ...draft, allowedOrigins: e.target.value })}
              rows={3}
              placeholder={"https://app.suaempresa.com\nhttps://suaempresa.com"}
              className={`${controlClass} resize-none font-mono text-xs`}
            />
          </Field>
          <Field label="Limite de requisições por minuto" htmlFor="api-rate" hint="Por chave e por IP (o menor vale).">
            <Input
              id="api-rate"
              type="number"
              min={1}
              max={600}
              value={draft.rateLimit}
              onChange={(e) => setDraft({ ...draft, rateLimit: Number(e.target.value) })}
              className="w-32"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            Ativa
          </label>
          <div className="flex items-center gap-2">
            <Button onClick={salvar} disabled={pending || !draft.name.trim()}>
              {draft.id ? "Salvar" : "Criar chave"}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </Surface>
      )}

      {/* Lista de chaves */}
      {keys.length === 0 && !draft ? (
        <Surface elevation={1} padding="lg" className="flex flex-col items-center gap-2 text-center">
          <KeyRound className="size-6 text-text-muted" />
          <p className="text-sm text-text-muted">
            Nenhuma chave de API ainda. Crie uma para integrar o chat/busca desta documentação ao seu sistema.
          </p>
        </Surface>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <Surface key={k.id} elevation={1} padding="md" className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{k.name}</span>
                  <Badge tone={k.active ? "success" : "neutral"}>{k.active ? "Ativa" : "Inativa"}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="max-w-full truncate rounded bg-surface-2 px-2 py-1 font-mono text-xs">{k.public_key}</code>
                  <CopyButton text={k.public_key} label="Copiar chave" />
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {!fixedSpaceId && <>{nomeEspaco(k.space_id)} · </>}
                  {k.allowed_origins.length ? `${k.allowed_origins.length} origem(ns) permitida(s)` : "Qualquer origem (servidor-a-servidor)"}
                  {" · "}
                  {k.rate_limit} req/min
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => editar(k)} disabled={pending}>Editar</Button>
                <Button variant="ghost" size="icon" title="Gerar nova chave" onClick={() => regenerar(k.id)} disabled={pending}>
                  <RefreshCw className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Excluir" onClick={() => excluir(k.id)} disabled={pending}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Surface>
          ))}
        </div>
      )}

      {/* Documentação dos endpoints */}
      <ApiDocs base={base} />
    </div>
  );
}

// ── Documentação ─────────────────────────────────────────────────────────────

function ApiDocs({ base }: { base: string }) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">Endpoints da API</h3>
        <p className="mt-1 text-sm text-text-muted">
          Base: <code className="rounded bg-surface-2 px-1 font-mono">{base}</code>. Autenticação em todas as
          rotas: envie a chave no cabeçalho <code className="rounded bg-surface-2 px-1">X-Widget-Key: pk_…</code>{" "}
          ou <code className="rounded bg-surface-2 px-1">Authorization: Bearer pk_…</code> (ou{" "}
          <code className="rounded bg-surface-2 px-1">?key=</code> na query, ou <code className="rounded bg-surface-2 px-1">key</code> no corpo).
          As respostas ficam restritas às documentações no escopo da chave.
        </p>
      </div>

      <Endpoint
        metodo="POST"
        rota="/chat"
        objetivo="Conversar com a IA (RAG) usando a documentação como base. Toda resposta cita as fontes; sem contexto suficiente, o assistente diz que não encontrou (nunca responde por conhecimento geral)."
        comoUsar="Envie o histórico da conversa. A resposta é um stream SSE (text/event-stream): consuma os eventos à medida que chegam para mostrar a digitação em tempo real."
        request={`{
  "messages": [
    { "role": "user", "content": "Como emito uma nota fiscal?" }
  ],
  "conversationId": "opcional — para continuar uma conversa",
  "sessionId": "opcional — identifica o visitante"
}`}
        response={`event: message  (text/event-stream)
{"type":"citations","citations":[{"n":1,"title":"Emitir NF","url":"/docs/..."}]}
{"type":"token","value":"Para "}
{"type":"token","value":"emitir…"}
{"type":"done","conversationId":"..."}
// em caso de erro: {"type":"error","message":"..."}`}
        curl={`curl -N -X POST ${base}/chat \\
  -H "Content-Type: application/json" \\
  -H "X-Widget-Key: pk_sua_chave" \\
  -d '{"messages":[{"role":"user","content":"Como emito uma nota fiscal?"}]}'`}
      />

      <Endpoint
        metodo="POST"
        rota="/search"
        objetivo="Busca híbrida (texto + semântica) nos trechos da documentação — SEM IA generativa. Útil para uma barra de busca própria ou para recuperar contexto."
        comoUsar="Envie a consulta e, opcionalmente, o limite de resultados (1–20, padrão 8). Resposta JSON imediata."
        request={`{ "query": "nota fiscal", "limit": 8 }`}
        response={`{
  "results": [
    {
      "title": "Emitir Nota Fiscal",
      "heading_path": "Financeiro > Faturamento > Emitir NF",
      "snippet": "…trecho com o termo destacado…",
      "url": "/docs/global/financeiro/faturamento/emitir-nota-fiscal",
      "score": 0.87
    }
  ]
}`}
        curl={`curl -X POST ${base}/search \\
  -H "Content-Type: application/json" \\
  -H "X-Widget-Key: pk_sua_chave" \\
  -d '{"query":"nota fiscal","limit":8}'`}
      />

      <Endpoint
        metodo="GET"
        rota="/config"
        objetivo="Configuração pública do assistente (persona/visual): título, mensagem de boas-vindas, cor, sugestões de perguntas. É o que o widget lê para se montar."
        comoUsar="Chamada GET com a chave. Retorna JSON com a configuração da chave."
        response={`{
  "title": "Assistente",
  "welcome": "Olá! Como posso ajudar?",
  "primaryColor": "#511C76",
  "suggestions": ["Como começar?", "..."]
}`}
        curl={`curl "${base}/config?key=pk_sua_chave"`}
      />

      <Endpoint
        metodo="POST"
        rota="/feedback"
        objetivo="Registrar se a resposta do chat foi útil (👍/👎). Alimenta as análises de qualidade das conversas."
        comoUsar="Envie o id da conversa (retornado no evento 'done' do /chat) e o valor: 1 (útil) ou -1 (não útil)."
        request={`{ "conversationId": "...", "value": 1 }`}
        response={`{ "ok": true }`}
        curl={`curl -X POST ${base}/feedback \\
  -H "Content-Type: application/json" \\
  -H "X-Widget-Key: pk_sua_chave" \\
  -d '{"conversationId":"...","value":1}'`}
      />

      <p className="text-xs text-text-muted">
        Códigos de erro comuns: <b>401</b> chave inválida/inativa · <b>403</b> origem não autorizada ·
        <b> 429</b> rate limit excedido · <b>503</b> IA não configurada no servidor.
      </p>
    </section>
  );
}

function Endpoint({
  metodo,
  rota,
  objetivo,
  comoUsar,
  request,
  response,
  curl,
}: {
  metodo: string;
  rota: string;
  objetivo: string;
  comoUsar: string;
  request?: string;
  response: string;
  curl: string;
}) {
  const tomMetodo = metodo === "GET" ? "bg-brand-blue-100 text-brand-blue-800 dark:bg-brand-blue-950/50 dark:text-brand-blue-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
  return (
    <Surface elevation={1} padding="lg" className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${tomMetodo}`}>{metodo}</span>
        <code className="font-mono text-sm font-semibold">/api/v1{rota}</code>
      </div>
      <p className="text-sm">
        <span className="font-semibold">Objetivo. </span>
        {objetivo}
      </p>
      <p className="text-sm text-text-muted">
        <span className="font-semibold text-text">Como usar. </span>
        {comoUsar}
      </p>
      {request && <Bloco titulo="Corpo da requisição" codigo={request} />}
      <Bloco titulo="Resposta" codigo={response} />
      <Bloco titulo="Exemplo (cURL)" codigo={curl} />
    </Surface>
  );
}

function Bloco({ titulo, codigo }: { titulo: string; codigo: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">{titulo}</span>
        <CopyButton text={codigo} />
      </div>
      <pre className="overflow-x-auto rounded-lg border border-brand-gray-800 bg-brand-gray-950 p-3 font-mono text-xs leading-relaxed text-brand-gray-100">
        {codigo}
      </pre>
    </div>
  );
}
