"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Sparkles, Send, X, Eraser, Paperclip, ThumbsUp, ThumbsDown, FileText, Image as ImageIcon, Mic, Square, Loader2 } from "lucide-react";
import { useVoiceInput } from "@/components/chat/use-voice";
import { controlClass } from "@/components/ui/input";
import { useFocoPreso } from "@/components/ui/use-foco-preso";
import { Markdown } from "@/components/ui/markdown";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import {
  submitPortalChatFeedback,
  listPortalPrompts,
  savePortalPrompt,
  deletePortalPrompt,
  getPortalChatHistory,
  uploadPortalAttachment,
} from "@/app/(portal)/actions";
import { readPortalIdentity } from "@/lib/portal/track-client";
import { PromptLibrary, SavePromptButton, type PromptBackend } from "@/components/chat/prompt-library";
import { ToastProvider } from "@/components/ui/toast";
import { AskAiChart } from "./ask-ai-chart";
import type { ChartSpec } from "@/lib/chat/chart-spec";
import type { ClarifyOption, ClarifyScope } from "@/lib/ai/disambiguation";
import { comBase } from "@/lib/base-path";
import { ehFalhaDeRede } from "@/components/ui/use-online";

/** Espelha `RetrievedSource` do servidor. `url` é nulo quando a fonte é um
 *  arquivo da base de conhecimento, que não tem página no portal. */
type Citation = { n: number; title: string; url: string | null; heading_path?: string | null };
const FALHA_RESPOSTA =
  "Não foi possível gerar a resposta agora. As fontes encontradas estão abaixo — tente de novo em instantes ou avise a equipe.";

/** Gradiente da marca (roxo→azul) — cabeçalho, avatar, balão do usuário, enviar. */
const GRAD = "bg-gradient-to-br from-brand-purple-600 to-brand-blue-700";

/** Metadado leve do anexo (chip). */
type AttMeta = { id: string; name: string; mime: string; size: number };
/** Anexo pendente (ainda subindo ou já pronto) antes de enviar. */
type Pending = { tmpId: string; name: string; att?: AttMeta };

type Msg = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  feedback?: 1 | -1;
  /** Pergunta de desambiguação: botões para o usuário escolher o tema. */
  options?: ClarifyOption[];
  /** Documentos anexados a esta mensagem do usuário. */
  attachments?: AttMeta[];
  /** Arquivos retornados por APIs (base64) — links de download. */
  files?: { filename: string; mimeType: string; dataUrl: string }[];
  /** Gráficos montados pela IA — cards interativos (trocar tipo + exportar). */
  charts?: ChartSpec[];
  /** Esta bolha é um AVISO DE FALHA, não uma resposta: não pede avaliação. */
  falhou?: boolean;
};

/** Painel "Perguntar à IA" do leitor — responde com base na doc do espaço. */
type AskAiPanelProps = {
  spaceSlug: string;
  open: boolean;
  onClose: () => void;
  initialQuestion?: string;
  /**
   * Perguntas de partida do estado vazio. Vêm do TEMA DO ESPAÇO
   * (`spaces.theme.ia.sugestoes`) — e não da config da chave de widget, que é
   * por chave e não existe para o portal. Ver `src/lib/portal/theme.ts`.
   */
  sugestoes?: string[];
};

/**
 * O portal não tem `ToastProvider` no layout (só o admin tem), mas componentes
 * compartilhados usados aqui (PromptLibrary/SavePromptButton) chamam `useToast`.
 * Fornecemos o provider localmente ao redor do painel para o Ask-AI ter toasts.
 */
export function AskAiPanel(props: AskAiPanelProps) {
  return (
    <ToastProvider>
      <AskAiPanelInner {...props} />
    </ToastProvider>
  );
}

function AskAiPanelInner({
  spaceSlug,
  open,
  onClose,
  initialQuestion,
  sugestoes = [],
}: AskAiPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  // Voz: grava do microfone, transcreve (/api/portal/transcribe) e pergunta —
  // ou preenche o campo se já estiver respondendo.
  const voice = useVoiceInput("/api/portal/transcribe", (text) => {
    if (streaming) setInput((p) => (p ? `${p} ${text}` : text));
    else void ask(text);
  });
  // Anexos (documentos) deste turno + erro de upload.
  const [pending, setPending] = useState<Pending[]>([]);
  const [attError, setAttError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const convRef = useRef<string | undefined>(undefined);
  const sidRef = useRef<string>("");
  // Rastreio (p_base/p_usuario/…): quando a página do portal é aberta com esses
  // parâmetros na URL, seguem junto para a conversa. Só DADO, nunca vai ao prompt.
  const trackRef = useRef<Record<string, string> | null>(null);
  // Espelho em estado do rastreio — a biblioteca de prompts do leitor só existe
  // quando há identidade (p_base + p_usuario); é a chave por visitante.
  const [track, setTrack] = useState<Record<string, string> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  /** Turno em curso — o botão "Parar" o cancela. */
  const abortRef = useRef<AbortController | null>(null);
  /**
   * Citação clicada: `{ msg, n }`. Abre a sanfona de fontes DAQUELA resposta e
   * destaca o cartão. Antes, a ligação entre o `[1]` do texto e o cartão era só
   * visual — numa resposta com seis fontes, conferir a terceira era trabalho
   * manual de quem lê, com a sanfona ainda por cima fechada.
   */
  const [citacaoAtiva, setCitacaoAtiva] = useState<{ msg: number; n: number } | null>(null);
  const askedRef = useRef<string | null>(null);
  // Histórico relido por identidade (3B) — carregado uma vez ao montar.
  const historyLoadedRef = useRef(false);
  // Tema em foco (eco do servidor via evento SSE `theme`) — evita perguntar de
  // novo enquanto o usuário segue no mesmo assunto.
  const contextScopeRef = useRef<ClarifyScope | undefined>(undefined);

  useEffect(() => {
    const key = `kb.portal.sid.${spaceSlug}`;
    let sid = localStorage.getItem(key);
    if (!sid) {
      sid = "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(key, sid);
    }
    sidRef.current = sid;
    // Identidade da visita (URL `p_*` ou o que ficou salvo desta sessão).
    const ident = readPortalIdentity();
    trackRef.current = ident;
    /**
     * A identidade vem da URL e do `localStorage` — fonte EXTERNA, legível só
     * depois da montagem. É o mesmo caso legítimo que o projeto já marca em
     * dez outros arquivos.
     *
     * A regra não reclamava aqui até agora, e não porque o código mudou: as
     * regras do React Compiler desistem da análise de um componente ao topar
     * com certos construtos, e passam a reportar quando ele volta a ser
     * analisável. Uma alteração noutro ponto desta função tornou o componente
     * legível para o analisador, e ele acusou um padrão que já estava aqui.
     * Vale registrar: "o lint passou ontem" não significa "o lint olhou".
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrack(ident);
    // Relê o histórico desta identidade (respeitando o "Limpar" anterior).
    let cleared: string | null = null;
    try {
      cleared = localStorage.getItem(`kb.portal.cleared.${spaceSlug}`);
    } catch {
      /* storage indisponível */
    }
    void loadHistory(ident, sid, cleared);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceSlug]);

  /** Carrega, uma única vez, a última conversa desta identidade. Nunca
   *  sobrescreve uma pergunta inicial (busca sem resultado) nem conversa em curso. */
  async function loadHistory(
    ident: Record<string, string> | null,
    sessionId: string,
    afterIso: string | null,
  ) {
    if (historyLoadedRef.current || initialQuestion || askedRef.current) return;
    historyLoadedRef.current = true;
    const h = await getPortalChatHistory(spaceSlug, sessionId, ident ?? {}, afterIso);
    if (!h) return;
    setMessages((prev) => {
      if (prev.length) return prev; // já começou a conversar nesse meio-tempo
      convRef.current = h.conversationId;
      return h.messages.map((m) => ({
        role: m.role,
        content: m.content,
        citations: m.citations as Citation[] | undefined,
        feedback: m.feedback,
        attachments: m.attachments as AttMeta[] | undefined,
      }));
    });
  }

  /** Sobe os arquivos escolhidos; cada um vira um chip (subindo → pronto). */
  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAttError(null);
    for (const file of Array.from(files)) {
      const tmpId = Math.random().toString(36).slice(2);
      setPending((p) => [...p, { tmpId, name: file.name }]);
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadPortalAttachment(spaceSlug, fd);
      setPending((p) =>
        p.flatMap((x) => {
          if (x.tmpId !== tmpId) return [x];
          return r.ok ? [{ ...x, att: r.attachment }] : [];
        }),
      );
      if (!r.ok) setAttError(`Não consegui anexar “${file.name}”: ${r.error}`);
    }
  }

  /** Envia a pergunta com os anexos prontos (usado pelo form e pelo Enter). */
  function enviar() {
    if (streaming || pending.some((p) => !p.att)) return; // espera uploads
    const atts = pending.map((p) => p.att).filter((a): a is AttMeta => !!a);
    const q = input;
    if (!q.trim() && atts.length === 0) return;
    setPending([]);
    setAttError(null);
    void ask(q, undefined, atts);
  }

  /** "Limpar" VISUAL: esvazia a tela e começa uma conversa nova; grava o
   *  instante para não reexibir o que veio antes. O banco fica intacto. */
  function limpar() {
    setMessages([]);
    convRef.current = undefined;
    contextScopeRef.current = undefined;
    askedRef.current = null;
    try {
      localStorage.setItem(`kb.portal.cleared.${spaceSlug}`, new Date().toISOString());
    } catch {
      /* storage indisponível */
    }
  }

  // Biblioteca de prompts do leitor: só quando a visita traz o token de rastreio
  // (o servidor o decifra e chaveia por p_base+p_usuario). Sem isso, nada de
  // salvar/reusar. Memoizado para referência estável (o painel recarrega a lista
  // quando o backend muda).
  const promptBackend = useMemo<PromptBackend | null>(() => {
    if (!track || !track.token) return null;
    return {
      list: () => listPortalPrompts(spaceSlug, track),
      save: (input) => savePortalPrompt(spaceSlug, track, input),
      del: (id) => deletePortalPrompt(spaceSlug, track, id),
    };
  }, [track, spaceSlug]);

  // Esc, foco preso, foco inicial no campo e devolução ao gatilho — o mesmo
  // gancho do Dialog (`use-foco-preso.ts`). Antes só o Esc existia: quem
  // navegava por teclado abria o painel e seguia tabulando pela página ATRÁS
  // dele, e ao fechar era largado no topo do documento.
  useFocoPreso(open, painelRef, onClose);

  // Pergunta inicial (vinda da busca sem resultado).
  useEffect(() => {
    if (open && initialQuestion && askedRef.current !== initialQuestion) {
      askedRef.current = initialQuestion;
      void ask(initialQuestion);
    }
    if (!open) askedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuestion]);

  /**
   * Rola para o fim — mas SÓ se a pessoa já estava lá (mesma regra do widget:
   * 80px de folga). Rolar sempre arranca a leitura de quem subiu para reler um
   * trecho, que é exatamente o que se faz numa resposta longa enquanto ela
   * ainda está chegando.
   */
  function scrollDown() {
    const el = scrollRef.current;
    if (!el) return;
    const perto = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (!perto) return;
    requestAnimationFrame(() => el.scrollTo(0, el.scrollHeight));
  }

  /**
   * Envia a pergunta. Sem `scope`: pergunta nova. Com `scope` (clique num botão
   * de desambiguação): reusa a última pergunta filtrando pelo tema, substituindo
   * a bolha de opções pela resposta.
   */
  async function ask(question: string, scope?: ClarifyScope, atts?: AttMeta[]) {
    if (streaming) return;
    let history: Msg[];
    /**
     * O texto enviado, para poder devolvê-lo ao campo se a rede cair.
     *
     * Fica vazio no caminho do `scope` (a pessoa clicou num botão de
     * desambiguação, não digitou nada) — e aí não há o que restaurar.
     */
    let perguntaEnviada = "";
    if (scope) {
      const semClarify = messages[messages.length - 1]?.options ? messages.slice(0, -1) : messages;
      if (!semClarify.some((m) => m.role === "user")) return;
      history = semClarify;
      setMessages([...semClarify, { role: "assistant", content: "" }]);
    } else {
      const q = question.trim();
      // Anexo sem texto: instrução padrão para o modelo ter o que fazer.
      const content = q || (atts && atts.length ? "Pode analisar o(s) arquivo(s) que anexei?" : "");
      if (!content) return;
      history = [...messages, { role: "user", content, ...(atts && atts.length ? { attachments: atts } : {}) }];
      setMessages([...history, { role: "assistant", content: "" }]);
      // Guardado ANTES de limpar o campo: se a rede cair, é isto que volta.
      perguntaEnviada = content;
      setInput("");
    }
    setStreaming(true);
    // INTERROMPER: uma resposta longa que saiu do rumo obrigava a esperar o fim
    // ou fechar o painel. O widget já tinha isso ("Parar"); aqui não havia como.
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const res = await fetch(comBase("/api/portal/chat"), {
        method: "POST",
        signal: abort.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceSlug,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          conversationId: convRef.current,
          sessionId: sidRef.current,
          ...(trackRef.current ? { track: trackRef.current } : {}),
          ...(scope ? { scope } : {}),
          ...(atts && atts.length ? { attachmentIds: atts.map((a) => a.id) } : {}),
          // Página atual do leitor (o artigo que ele está vendo) — Fase 4.
          ...(typeof window !== "undefined"
            ? { page: { href: location.href, path: location.pathname, title: document.title } }
            : {}),
          ...(contextScopeRef.current ? { contextScope: contextScopeRef.current } : {}),
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        updateLast((m) => ({ ...m, falhou: true, content: err.error ?? "Falha ao responder." }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let full = "";
      let cites: Citation[] = [];
      let clarified = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const chunk of parts) {
          const line = chunk.replace(/^data:\s?/, "").trim();
          if (!line) continue;
          let evt: {
            type: string;
            value?: string;
            citations?: Citation[];
            conversationId?: string;
            scope?: ClarifyScope;
            question?: string;
            options?: ClarifyOption[];
            filename?: string;
            mimeType?: string;
            dataUrl?: string;
            chart?: ChartSpec;
          };
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.type === "citations") cites = evt.citations ?? [];
          else if (evt.type === "theme") contextScopeRef.current = evt.scope;
          else if (evt.type === "clarify") {
            clarified = true;
            updateLast((m) => ({ ...m, content: evt.question ?? "", options: evt.options ?? [] }));
            scrollDown();
          } else if (evt.type === "token") {
            full += evt.value ?? "";
            updateLast((m) => ({ ...m, content: full }));
            scrollDown();
          } else if (evt.type === "file") {
            const f = { filename: evt.filename ?? "arquivo", mimeType: evt.mimeType ?? "", dataUrl: evt.dataUrl ?? "" };
            updateLast((m) => ({ ...m, files: [...(m.files ?? []), f] }));
            scrollDown();
          } else if (evt.type === "chart") {
            const ch = evt.chart;
            if (ch) {
              updateLast((m) => ({ ...m, charts: [...(m.charts ?? []), ch] }));
              scrollDown();
            }
          } else if (evt.type === "done") {
            convRef.current = evt.conversationId || convRef.current;
            // Resposta vazia = falha na chamada ao modelo (mas não quando foi
            // desambiguação — aí a bolha já tem a pergunta + botões).
            if (!clarified) {
              updateLast((m) => ({ ...m, citations: cites, content: m.content || FALHA_RESPOSTA }));
            }
          }
        }
      }
    } catch (e) {
      // Interrupção pedida pela pessoa não é falha: o texto que já chegou fica
      // (é o que ela leu), e um "Erro: AbortError" no lugar dele seria mentira.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        /**
         * QUEDA DE CONEXÃO NÃO É "Erro: Failed to fetch".
         *
         * Era exatamente isso que aparecia: a mensagem interna do navegador,
         * em inglês, sem dizer o que houve nem o que fazer. E pior — a
         * pergunta que a pessoa acabou de digitar já tinha sido apagada do
         * campo (`setInput("")` acontece antes do envio), então ela perdia o
         * texto E não sabia por quê.
         *
         * Agora a pergunta VOLTA para o campo. Rede é a falha mais transitória
         * que existe: quase sempre a ação certa é tentar de novo em dez
         * segundos, e para isso o texto precisa estar lá.
         */
        const deRede = ehFalhaDeRede(e);
        if (deRede) setInput((atual) => atual || perguntaEnviada);
        updateLast((m) => ({
          ...m,
          falhou: true,
          content: deRede
            ? typeof navigator !== "undefined" && !navigator.onLine
              ? "Você está sem conexão. Sua pergunta continua no campo abaixo — é só enviar de novo quando a internet voltar."
              : "Não consegui falar com o servidor. Sua pergunta continua no campo abaixo — tente enviar de novo."
            : "Não consegui responder agora. Tente de novo em instantes.",
        }));
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      scrollDown();
    }
  }

  function updateLast(fn: (m: Msg) => Msg) {
    setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)));
  }
  function giveFeedback(i: number, value: 1 | -1) {
    void submitPortalChatFeedback(
      convRef.current ?? "",
      value,
      spaceSlug,
      sidRef.current ?? "",
    );
    setMessages((prev) => prev.map((m, idx) => (idx === i ? { ...m, feedback: value } : m)));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Perguntar à IA">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm motion-safe:animate-[fade_150ms_ease-out]"
        onClick={onClose}
      />
      <div ref={painelRef} className="relative flex h-dvh w-full max-w-md flex-col overflow-hidden bg-surface shadow-3 motion-safe:animate-[slidein_200ms_ease-out] sm:m-3 sm:h-[calc(100dvh-1.5rem)] sm:rounded-3xl">
        {/* Cabeçalho com gradiente da marca */}
        <div className={`flex items-center gap-3 px-4 py-4 text-white ${GRAD}`}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 shadow-sm">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold leading-tight">Assistente de IA</p>
            <p className="truncate text-xs text-white/80">Respostas com base na documentação</p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={limpar}
              aria-label="Limpar conversa"
              title="Limpar conversa (só nesta tela)"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
            >
              <Eraser className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* A resposta chega token a token. Sem `aria-live`, quem usa leitor de
            tela não sabe que há resposta vindo nem que ela terminou — o
            indicador "pensando" tem `role=status` próprio, mas some no primeiro
            token, que é justamente quando o conteúdo começa a existir.
            `polite` (e não `assertive`) para não atropelar a leitura em curso. */}
        <div
          ref={scrollRef}
          aria-live="polite"
          aria-busy={streaming}
          className="slim-scroll flex-1 space-y-4 overflow-auto bg-surface-2/50 p-4"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <span className={`mb-4 flex size-14 items-center justify-center rounded-2xl text-white shadow-2 ${GRAD}`}>
                <Sparkles className="size-7" />
              </span>
              <p className="text-base font-semibold text-text">Como posso ajudar?</p>
              <p className="mt-1.5 max-w-[17rem] text-sm leading-relaxed text-text-muted">
                Faça uma pergunta sobre esta documentação — as respostas citam as fontes.
              </p>
              {/* Perguntas de partida: caixa vazia é o pior convite — quem não
                  sabe o que a ferramenta faz não sabe o que perguntar, e fecha.
                  Somem no primeiro envio (viram histórico). Alvo de 44px. */}
              {sugestoes.length > 0 && (
                <div className="mt-6 flex w-full flex-col gap-2">
                  {sugestoes.slice(0, 6).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void ask(q)}
                      className="min-h-11 rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-left text-sm text-text shadow-1 transition-colors hover:border-primary hover:text-primary"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex flex-col items-end gap-1.5">
                <div className="group flex items-center gap-1">
                  {promptBackend && (
                    <SavePromptButton
                      texto={m.content}
                      backend={promptBackend}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  )}
                  <div className={`max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm text-white shadow-1 ${GRAD}`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {m.attachments.map((a) => {
                      const Icon = a.mime?.startsWith("image/") ? ImageIcon : FileText;
                      return (
                        <span
                          key={a.id}
                          className="flex max-w-[14rem] items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text"
                        >
                          <Icon className="size-3.5 shrink-0 text-primary" />
                          <span className="truncate">{a.name}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div key={i} className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-white shadow-1 ${GRAD}`}>
                  <Sparkles className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="inline-block max-w-full rounded-2xl rounded-tl-md border border-border bg-surface px-3.5 py-2.5 text-sm shadow-1">
                    {m.content ? (
                      <Markdown
                        content={m.content}
                        citacao={{
                          existe: (n) => (m.citations ?? []).some((c) => c.n === n),
                          onIr: (n) => setCitacaoAtiva({ msg: i, n }),
                        }}
                      />
                    ) : (
                      <TypingIndicator className="py-0.5" />
                    )}
                  </div>
                  {m.options && m.options.length > 0 && (
                    <div className="mt-2.5 flex flex-col gap-2">
                      {m.options.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => ask("", o.scope)}
                          disabled={streaming}
                          className="rounded-xl border-[1.5px] border-brand-purple-200 bg-surface px-3 py-2 text-left text-xs transition-colors hover:border-primary hover:bg-brand-purple-50/60 disabled:opacity-50 dark:border-brand-purple-900 dark:hover:bg-brand-purple-950/40"
                        >
                          <span className="block font-semibold text-primary">{o.label}</span>
                          {o.sublabel && <span className="mt-0.5 block leading-snug text-text-muted">{o.sublabel}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.files && m.files.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {m.files.map((f, i) => (
                        <a
                          key={i}
                          href={f.dataUrl}
                          download={f.filename}
                          rel="noopener"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors hover:text-primary"
                        >
                          📎 {f.filename}
                        </a>
                      ))}
                    </div>
                  )}
                  {m.charts && m.charts.length > 0 && (
                    <div className="flex flex-col">
                      {m.charts.map((ch, i) => (
                        <AskAiChart key={i} spec={ch} />
                      ))}
                    </div>
                  )}
                  {m.citations && m.citations.length > 0 && (
                    // Fechada por padrão: no painel estreito do portal a lista de
                    // fontes empurrava a resposta para fora da vista.
                    <details className="group mt-2.5" open={citacaoAtiva?.msg === i || undefined}>
                      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-text-muted shadow-sm transition-colors hover:text-text">
                        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                        Fontes
                        <span className="tabular-nums">({m.citations.length})</span>
                      </summary>
                      <div className="mt-2 space-y-1.5">
                        {m.citations.map((c) => {
                          // Sem URL (fonte de arquivo) a citação não pode ser link:
                          // um <a href=""> recarrega a página ao ser clicado.
                          const Tag = c.url ? "a" : "div";
                          // `comBase` é OBRIGATÓRIO aqui: a URL vem do servidor como
                          // caminho do app ("/docs/…") e um <a> cru NÃO recebe o
                          // basePath do Next (só <Link>/router.push recebem). Sob
                          // /natcorp/ia isso mandava o leitor para fora do app → 404.
                          const href = c.url ? comBase(c.url) : null;
                          const alvo = citacaoAtiva?.msg === i && citacaoAtiva.n === c.n;
                          return (
                            <Tag
                              key={c.n}
                              {...(href ? { href } : {})}
                              // `ref` no cartão alvo: abrir a sanfona não basta
                              // se a fonte 6 estiver fora da vista.
                              ref={alvo ? ((el: HTMLElement | null) => el?.scrollIntoView({ block: "nearest" })) as never : undefined}
                              className={`flex items-start gap-2 rounded-xl border p-2.5 text-sm no-underline shadow-sm ${
                                alvo ? "border-primary bg-primary/5" : "border-border bg-surface"
                              } ${c.url ? "transition-colors hover:border-primary" : ""}`}
                            >
                              <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-semibold text-primary">
                                  [{c.n}] {c.title}
                                </span>
                                {c.heading_path && (
                                  <span className="block truncate text-2xs text-text-muted">
                                    {c.heading_path}
                                  </span>
                                )}
                              </span>
                            </Tag>
                          );
                        })}
                      </div>
                    </details>
                  )}
                  {/**
                   * Não pergunta "Útil?" embaixo de uma FALHA.
                   *
                   * Com a rede caída, a bolha do assistente carrega um aviso de
                   * conexão — e logo abaixo aparecia o par de polegares. Duas
                   * coisas erradas ao mesmo tempo: pedir avaliação de uma
                   * resposta que não houve, e registrar o 👎 como resposta ruim
                   * da IA. O feedback alimenta a análise de qualidade; uma
                   * queda de Wi-Fi entraria lá como falha do modelo.
                   */}
                  {m.role === "assistant" && m.content && !m.falhou && i === messages.length - 1 && !streaming && (
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-xs text-text-muted">Útil?</span>
                      <button
                        type="button"
                        aria-label="Útil"
                        onClick={() => giveFeedback(i, 1)}
                        className={`rounded-md p-1 transition-colors hover:bg-surface-2 ${m.feedback === 1 ? "text-primary" : "text-text-muted"}`}
                      >
                        <ThumbsUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Não útil"
                        onClick={() => giveFeedback(i, -1)}
                        className={`rounded-md p-1 transition-colors hover:bg-surface-2 ${m.feedback === -1 ? "text-brand-pink-700" : "text-text-muted"}`}
                      >
                        <ThumbsDown className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="border-t border-border bg-surface p-3"
        >
          {promptBackend && (
            <div className="mb-2 flex items-center">
              <PromptLibrary
                backend={promptBackend}
                onInsert={(t) => setInput((p) => (p.trim() ? `${p}\n${t}` : t))}
              />
            </div>
          )}
          {(pending.length > 0 || attError) && (
            <div className="mb-2 flex flex-col gap-1.5">
              {pending.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pending.map((p) => {
                    const Icon = p.att?.mime.startsWith("image/") ? ImageIcon : FileText;
                    return (
                    <span
                      key={p.tmpId}
                      className={`flex max-w-[14rem] items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs ${p.att ? "bg-surface-2 text-text" : "bg-surface-2/60 text-text-muted"}`}
                    >
                      <Icon className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate">{p.name}</span>
                      {p.att ? (
                        <button
                          type="button"
                          aria-label="Remover anexo"
                          onClick={() => setPending((prev) => prev.filter((x) => x.tmpId !== p.tmpId))}
                          className="shrink-0 text-text-muted hover:text-brand-pink-700"
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : (
                        <span className="shrink-0 text-text-muted">…</span>
                      )}
                    </span>
                    );
                  })}
                </div>
              )}
              {attError && <p className="text-xs text-brand-pink-700">{attError}</p>}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept=".pdf,.docx,.pptx,.xlsx,.xlsm,.csv,.txt,.md,.png,.jpg,.jpeg,.gif,.webp"
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {voice.error && <p className="mb-2 text-xs text-brand-pink-700">{voice.error}</p>}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Anexar arquivo"
              title="Anexar documento ou imagem (PDF, Word, Excel, CSV, PNG, JPG…)"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-text-muted transition-colors hover:border-primary hover:text-primary"
            >
              <Paperclip className="size-4" />
            </button>
            <button
              type="button"
              onClick={voice.toggle}
              disabled={voice.state === "transcribing" || (streaming && voice.state !== "recording")}
              aria-label="Gravar áudio"
              title={voice.state === "recording" ? "Parar e transcrever" : "Falar (gravar áudio)"}
              className={`flex size-11 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:border-primary hover:text-primary disabled:opacity-40 ${
                voice.state === "recording" ? "animate-pulse border-brand-pink-700 text-brand-pink-700" : "text-text-muted"
              }`}
            >
              {voice.state === "recording" ? (
                <Square className="size-4" />
              ) : voice.state === "transcribing" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mic className="size-4" />
              )}
            </button>
            <AutoGrowTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              rows={1}
              placeholder="Escreva sua pergunta… (Enter envia)"
              aria-label="Pergunta"
              className={`${controlClass} min-h-11 flex-1 rounded-2xl`}
            />
            {/* Enquanto responde, o MESMO botão interrompe — o lugar onde a
                mão já está. Botão separado obrigaria a procurar. */}
            {streaming ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                aria-label="Parar a resposta"
                title="Parar"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-text text-surface shadow-1 transition-transform hover:scale-105"
              >
                <Square className="size-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending.some((p) => !p.att) || (!input.trim() && pending.length === 0)}
                aria-label="Enviar"
                className={`flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-1 transition-transform hover:enabled:scale-105 disabled:opacity-40 ${GRAD}`}
              >
                <Send className="size-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

