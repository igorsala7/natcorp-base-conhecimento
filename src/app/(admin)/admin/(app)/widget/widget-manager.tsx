"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Bot, ImagePlus } from "lucide-react";
import { ICONS } from "@/lib/blocks/icons";
import { IconPicker } from "@/components/editor/blocks/icon-picker";
import { escolherEEnviar } from "@/lib/content/upload";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClass } from "@/components/ui/input";
import { Field, eyebrowLabel } from "@/components/ui/field";
import { Surface } from "@/components/ui/surface";
import {
  saveWidgetKey,
  regenerateWidgetKey,
  deleteWidgetKey,
} from "./actions";

export type WidgetKeyRow = {
  id: string;
  /** Documentação DONA (permissão e registro das conversas). */
  space_id: string;
  /** Documentações que este chatbot consulta — inclui a dona. */
  scope_space_ids: string[];
  /** Persona própria; nulo herda a da documentação dona. */
  system_prompt: string | null;
  name: string;
  public_key: string;
  allowed_origins: string[];
  rate_limit: number;
  active: boolean;
  config: {
    primaryColor?: string;
    secondaryColor?: string;
    title?: string;
    subtitle?: string;
    welcome?: string;
    /** Avatar do BOT (cabeçalho + respostas). */
    avatarUrl?: string;
    avatarIcon?: string;
    avatarShape?: "circle" | "rounded" | "square";
    /** Imagem da BOLHA do widget (separada do avatar). */
    launcherUrl?: string;
    launcherIcon?: string;
    bubbleSize?: "sm" | "md" | "lg";
    suggestions?: string[];
    position?: "right" | "left";
    scan?: boolean;
    formAssist?: boolean;
  } | null;
  created_at: string;
};

type SpaceOpt = { id: string; name: string; slug: string };

/**
 * Roxo da marca como DADO, não como estilo: o widget é injetado no site do
 * cliente (Shadow DOM) e não enxerga as CSS variables deste app, então a cor
 * precisa viajar literal no `widget_keys.config`. Fica aqui para não haver
 * duas verdades quando a marca mudar.
 */
const COR_PADRAO = "#511C76";

type Draft = {
  id?: string;
  spaceId: string;
  name: string;
  allowedOrigins: string;
  rateLimit: number;
  active: boolean;
  scopeSpaceIds: string[];
  systemPrompt: string;
  primaryColor: string;
  secondaryColor: string;
  title: string;
  subtitle: string;
  welcome: string;
  avatarUrl: string;
  avatarIcon: string;
  avatarShape: "circle" | "rounded" | "square";
  launcherUrl: string;
  launcherIcon: string;
  bubbleSize: "sm" | "md" | "lg";
  suggestions: string;
  position: "right" | "left";
  scan: boolean;
  formAssist: boolean;
};

function rowToDraft(k: WidgetKeyRow): Draft {
  const c = k.config ?? {};
  return {
    id: k.id,
    spaceId: k.space_id,
    name: k.name,
    allowedOrigins: (k.allowed_origins ?? []).join("\n"),
    rateLimit: k.rate_limit,
    active: k.active,
    scopeSpaceIds: k.scope_space_ids ?? [k.space_id],
    systemPrompt: k.system_prompt ?? "",
    primaryColor: c.primaryColor ?? COR_PADRAO,
    secondaryColor: c.secondaryColor ?? "",
    title: c.title ?? "Assistente",
    subtitle: c.subtitle ?? "",
    welcome: c.welcome ?? "Olá! Como posso ajudar com a documentação?",
    avatarUrl: c.avatarUrl ?? "",
    avatarIcon: c.avatarIcon ?? "",
    avatarShape: c.avatarShape ?? "circle",
    launcherUrl: c.launcherUrl ?? "",
    launcherIcon: c.launcherIcon ?? "",
    bubbleSize: c.bubbleSize ?? "md",
    suggestions: (c.suggestions ?? []).join("\n"),
    position: c.position ?? "right",
    scan: c.scan !== false, // ausente = ligado (comportamento atual)
    formAssist: c.formAssist === true, // ausente = desligado (privacidade)
  };
}


/**
 * Seletor de mídia (ÍCONE do catálogo → SVG branco em data URI, ou IMAGEM
 * enviada ao Storage). Genérico: serve tanto para a IMAGEM DA BOLHA quanto para
 * o AVATAR DO BOT — o dono controla os campos via `url`/`icon`/`onChange`.
 * Ambos os caminhos terminam numa URL que o widget.js consome direto.
 */
function MidiaPicker({
  url,
  icon,
  spaceId,
  onChange,
}: {
  url: string;
  icon: string;
  spaceId: string;
  /** Atualiza os DOIS campos de uma vez (url derivada + chave do ícone). */
  onChange: (url: string, icon: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [enviando, setEnviando] = useState(false);
  const Icone = icon ? ICONS[icon] : null;

  // O SVG do ícone escolhido só existe no DOM DEPOIS do render — o data URI é
  // lido daqui, não construído à mão (fica sempre fiel ao catálogo).
  useEffect(() => {
    if (!icon || !svgRef.current) return;
    const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svgRef.current.outerHTML)}`;
    if (url !== uri) onChange(uri, icon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icon]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Prévia no mesmo contexto do widget: círculo sobre fundo escuro. */}
      <span
        className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-purple-700"
        aria-hidden
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-7 rounded-full object-cover" />
        ) : (
          <Bot className="size-5 text-white/80" />
        )}
      </span>

      <div className="min-w-40 flex-1">
        <IconPicker
          value={icon || undefined}
          // Limpar o ícone limpa a imagem; escolher um novo é concluído pelo
          // efeito acima (quando o SVG existir no DOM).
          onChange={(key) => onChange(key ? url : "", key ?? "")}
        />
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={enviando || !spaceId}
        onClick={() => {
          setEnviando(true);
          escolherEEnviar(spaceId, (u) => {
            setEnviando(false);
            if (u) onChange(u, "");
          });
        }}
      >
        <ImagePlus className="size-4" /> {enviando ? "Enviando…" : "Enviar imagem"}
      </Button>

      {url && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange("", "")}>
          Remover
        </Button>
      )}

      {/* Fonte do data URI: o ícone renderizado de verdade, invisível. */}
      {Icone && (
        <span className="hidden" aria-hidden>
          <Icone ref={svgRef} color="#ffffff" strokeWidth={2} width={24} height={24} />
        </span>
      )}
    </div>
  );
}

export function WidgetManager({
  spaces,
  initialKeys,
  siteUrl,
  fixedSpaceId,
}: {
  spaces: SpaceOpt[];
  initialKeys: WidgetKeyRow[];
  siteUrl: string;
  /** Modo "chatbot desta documentação": chave nova nasce neste espaço e a
   *  documentação dona fica travada (a página /admin/chatbot usa isso). */
  fixedSpaceId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { confirmar } = useConfirm();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const spaceName = useMemo(
    () => new Map(spaces.map((s) => [s.id, s.name])),
    [spaces],
  );

  // Carrega o widget REAL nesta página para teste (mesmo script do embed).
  useEffect(() => {
    if (!testing) return;
    const s = document.createElement("script");
    s.src = `${siteUrl}/widget.js`;
    s.setAttribute("data-key", testing);
    s.async = true;
    document.body.appendChild(s);
    return () => {
      s.remove();
      document.querySelectorAll("[data-kb-widget]").forEach((el) => el.remove());
    };
  }, [testing, siteUrl]);

  function newDraft() {
    const dona = fixedSpaceId ?? spaces[0]?.id ?? "";
    setDraft({
      spaceId: dona,
      name: "Widget",
      allowedOrigins: "",
      rateLimit: 30,
      active: true,
      // Nasce enxergando só a documentação dona; ampliar é escolha explícita.
      scopeSpaceIds: [dona].filter(Boolean),
      systemPrompt: "",
      primaryColor: COR_PADRAO,
      secondaryColor: "",
      title: "Assistente",
      subtitle: "",
      welcome: "Olá! Como posso ajudar com a documentação?",
      avatarUrl: "",
      avatarIcon: "",
      avatarShape: "circle",
      launcherUrl: "",
      launcherIcon: "",
      bubbleSize: "md",
      suggestions: "",
      position: "right",
      scan: true,
      formAssist: false,
    });
  }

  /** Duplica um widget: reabre o form como NOVA chave (sem id → gera public_key
   *  nova ao salvar), com tudo copiado e "(cópia)" no nome. */
  function duplicate(k: WidgetKeyRow) {
    const d = rowToDraft(k);
    setDraft({ ...d, id: undefined, name: `${k.name} (cópia)` });
  }

  function save() {
    if (!draft) return;
    const payload = {
      id: draft.id,
      spaceId: draft.spaceId,
      name: draft.name,
      allowedOrigins: draft.allowedOrigins.split("\n").map((s) => s.trim()).filter(Boolean),
      rateLimit: Number(draft.rateLimit) || 30,
      active: draft.active,
      // A dona entra sempre, mesmo que desmarcada na lista.
      scopeSpaceIds: [...new Set([draft.spaceId, ...draft.scopeSpaceIds])],
      systemPrompt: draft.systemPrompt.trim() || null,
      config: {
        primaryColor: draft.primaryColor,
        secondaryColor: draft.secondaryColor.trim() || undefined,
        title: draft.title,
        subtitle: draft.subtitle.trim() || undefined,
        welcome: draft.welcome,
        avatarUrl: draft.avatarUrl || undefined,
        avatarIcon: draft.avatarIcon || undefined,
        avatarShape: draft.avatarShape,
        launcherUrl: draft.launcherUrl || undefined,
        launcherIcon: draft.launcherIcon || undefined,
        bubbleSize: draft.bubbleSize,
        suggestions: draft.suggestions.split("\n").map((s) => s.trim()).filter(Boolean),
        position: draft.position,
        scan: draft.scan,
        formAssist: draft.formAssist,
      },
    };
    startTransition(async () => {
      const r = await saveWidgetKey(payload);
      if (!r.ok) toast.error(r.error);
      else {
        setDraft(null);
        toast.success("Chave salva.");
        router.refresh();
      }
    });
  }

  async function regenerate(id: string) {
    if (
      !(await confirmar({
        title: "Gerar nova chave",
        description: "A chave atual para de funcionar imediatamente — todo widget que a usa precisa ser atualizado.",
        tone: "danger",
        confirmLabel: "Gerar nova",
      }))
    )
      return;
    startTransition(async () => {
      const r = await regenerateWidgetKey(id);
      if (r.ok) toast.success("Nova chave gerada.");
      else toast.error(r.error);
      router.refresh();
    });
  }

  async function remove(id: string) {
    if (
      !(await confirmar({
        title: "Excluir chave",
        description: "O widget que usa esta chave deixará de funcionar imediatamente.",
        tone: "danger",
      }))
    )
      return;
    startTransition(async () => {
      const r = await deleteWidgetKey(id);
      if (r.ok) toast.success("Chave excluída.");
      else toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Widgets</h1>
          <p className="mt-1 text-sm text-text-muted">
            Chaves públicas para embutir o chat da documentação em qualquer site (Shadow DOM,
            allowlist de origem, rate limit).
          </p>
        </div>
        <Button onClick={newDraft}>Novo Widget</Button>
      </div>


      {testing && (
        <p className="rounded-md border border-primary/40 bg-brand-purple-50 px-3 py-2 text-sm text-primary dark:bg-brand-purple-950/30">
          Widget de teste ativo no canto da tela (arraste a bolha e converse).
          A origem do teste é esta página — a chave precisa ter esta origem na
          allowlist, ou a allowlist vazia. <strong>Parar teste</strong> para remover.
        </p>
      )}

      {/* Lista de chaves */}
      <div className="space-y-3">
        {initialKeys.length === 0 && !draft && (
          <EmptyState
            title="Nenhuma chave ainda"
            description="Crie uma para gerar o snippet de embed."
          />
        )}
        {initialKeys.map((k) => (
          <Surface key={k.id} elevation={1}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium">{k.name}</span>
              <Badge tone="primary">{spaceName.get(k.space_id) ?? "?"}</Badge>
              {k.active ? (
                <Badge tone="success">Ativa</Badge>
              ) : (
                <Badge tone="neutral">Inativa</Badge>
              )}
              <span className="text-xs text-text-muted">{k.rate_limit}/min</span>
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant={testing === k.public_key ? "primary" : "secondary"}
                  onClick={() =>
                    setTesting((t) => (t === k.public_key ? null : k.public_key))
                  }
                  title="Carrega o widget real nesta página para testar"
                >
                  {testing === k.public_key ? "Parar teste" : "Testar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDraft(rowToDraft(k))}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => duplicate(k)} title="Cria um novo widget com as mesmas configurações (chave nova)">
                  Duplicar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => regenerate(k.id)}>
                  Nova chave
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(k.id)}>
                  Excluir
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-surface-2 px-2 py-1 text-xs">
                {k.public_key}
              </code>
              <CopyButton text={k.public_key} label="Copiar chave" />
            </div>
            <EmbedSnippet
              siteUrl={siteUrl}
              publicKey={k.public_key}
              spaceSlug={spaces.find((s) => s.id === k.space_id)?.slug}
            />
            {(k.allowed_origins?.length ?? 0) === 0 && (
              <p className="mt-2 text-xs text-brand-pink-700">
                ⚠ Sem allowlist de origem: qualquer site pode usar esta chave. Restrinja em produção.
              </p>
            )}
          </Surface>
        ))}
      </div>

      {/* Editor */}
      {draft && (
        <Surface elevation={1} padding="lg" className="border-primary/40">
          <h2 className="mb-4 text-lg font-semibold">
            {draft.id ? "Editar chave" : "Nova chave"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <input className={controlClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Documentação dona (define permissão e registra as conversas)">
              <select
                className={controlClass}
                value={draft.spaceId}
                disabled={!!draft.id || !!fixedSpaceId}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    spaceId: e.target.value,
                    // Trocar a dona não pode deixar a antiga no escopo por inércia.
                    scopeSpaceIds: [e.target.value],
                  })
                }
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>

            <fieldset>
              <legend className={`mb-1 ${eyebrowLabel}`}>
                O que este chatbot consulta
              </legend>
              <p className="mb-2 text-xs leading-relaxed text-text-muted">
                Marque as documentações que ele pode usar para responder. A dona está sempre
                incluída. É isto que permite uma URL responder sobre um produto e outra sobre
                dois.
              </p>
              <div className="space-y-1.5 rounded-lg border border-border p-3">
                {spaces.map((s) => {
                  const dona = s.id === draft.spaceId;
                  const marcada = dona || draft.scopeSpaceIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={marcada}
                        disabled={dona}
                        className="accent-[var(--color-primary)]"
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            scopeSpaceIds: e.target.checked
                              ? [...new Set([...draft.scopeSpaceIds, s.id])]
                              : draft.scopeSpaceIds.filter((x) => x !== s.id),
                          })
                        }
                      />
                      <span className={dona ? "text-text-muted" : ""}>
                        {s.name}
                        {dona && " (dona)"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <Field label="Persona deste chatbot (opcional)">
              <textarea
                className={`${controlClass} h-24`}
                value={draft.systemPrompt}
                placeholder="Ex.: Você atende parceiros comerciais do Produto Alfa. Seja direto e cite o número do artigo."
                onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
              />
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                Vazio herda a persona da documentação dona. As regras de citar fontes e não
                responder por conhecimento próprio continuam valendo — não é possível desligá-las
                por aqui.
              </p>
            </Field>
            <Field label="Origens permitidas (uma por linha; vazio = qualquer)">
              <textarea
                className={`${controlClass} h-20 font-mono text-xs`}
                placeholder="https://app.cliente.com"
                value={draft.allowedOrigins}
                onChange={(e) => setDraft({ ...draft, allowedOrigins: e.target.value })}
              />
            </Field>
            <div className="space-y-4">
              <Field label="Limite (requisições/min por chave)">
                <input
                  type="number"
                  className={controlClass}
                  value={draft.rateLimit}
                  onChange={(e) => setDraft({ ...draft, rateLimit: Number(e.target.value) })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Ativa
              </label>
            </div>
          </div>

          <h3 className={`mb-3 mt-6 ${eyebrowLabel}`}>Aparência</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cor primária">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-12 rounded border border-border"
                  value={draft.primaryColor}
                  onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })}
                />
                <input className={`${controlClass} flex-1`} value={draft.primaryColor} onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })} />
              </div>
            </Field>
            <Field label="Cor secundária (fim do gradiente; vazio = automática)">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-12 rounded border border-border"
                  value={draft.secondaryColor || draft.primaryColor}
                  onChange={(e) => setDraft({ ...draft, secondaryColor: e.target.value })}
                />
                <input
                  className={`${controlClass} flex-1`}
                  value={draft.secondaryColor}
                  placeholder="automática"
                  onChange={(e) => setDraft({ ...draft, secondaryColor: e.target.value })}
                />
                {draft.secondaryColor && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, secondaryColor: "" })}>
                    Auto
                  </Button>
                )}
              </div>
            </Field>
            <Field label="Título do widget">
              <input className={controlClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Subtítulo do widget (abaixo do título)">
              <input
                className={controlClass}
                value={draft.subtitle}
                placeholder="Pergunte o que quiser"
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
              />
            </Field>
            <Field label="Posição inicial">
              <select
                className={controlClass}
                value={draft.position}
                onChange={(e) => setDraft({ ...draft, position: e.target.value as "right" | "left" })}
              >
                <option value="right">Direita</option>
                <option value="left">Esquerda</option>
              </select>
            </Field>
            <Field label="Tamanho da bolha">
              <select
                className={controlClass}
                value={draft.bubbleSize}
                onChange={(e) => setDraft({ ...draft, bubbleSize: e.target.value as Draft["bubbleSize"] })}
              >
                <option value="sm">Pequena</option>
                <option value="md">Média</option>
                <option value="lg">Grande</option>
              </select>
            </Field>
            <Field label="Imagem do widget (bolha flutuante)">
              <MidiaPicker
                url={draft.launcherUrl}
                icon={draft.launcherIcon}
                spaceId={draft.spaceId}
                onChange={(url, icon) => setDraft({ ...draft, launcherUrl: url, launcherIcon: icon })}
              />
            </Field>
            <Field label="Avatar do bot (cabeçalho e respostas)">
              <MidiaPicker
                url={draft.avatarUrl}
                icon={draft.avatarIcon}
                spaceId={draft.spaceId}
                onChange={(url, icon) => setDraft({ ...draft, avatarUrl: url, avatarIcon: icon })}
              />
            </Field>
            <Field label="Formato do avatar">
              <select
                className={controlClass}
                value={draft.avatarShape}
                onChange={(e) => setDraft({ ...draft, avatarShape: e.target.value as Draft["avatarShape"] })}
              >
                <option value="circle">Círculo</option>
                <option value="rounded">Arredondado</option>
                <option value="square">Quadrado</option>
              </select>
            </Field>
            <Field label="Mensagem de boas-vindas">
              <textarea className={`${controlClass} h-16`} value={draft.welcome} onChange={(e) => setDraft({ ...draft, welcome: e.target.value })} />
            </Field>
            <Field label="Perguntas sugeridas (uma por linha)">
              <textarea className={`${controlClass} h-16`} value={draft.suggestions} onChange={(e) => setDraft({ ...draft, suggestions: e.target.value })} />
            </Field>
            <Field label="Ler os dados da tela (varredura)">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.scan}
                  onChange={(e) => setDraft({ ...draft, scan: e.target.checked })}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span className="text-text-muted">
                  Lê os campos, textos e tabelas da página do cliente (inclusive modais e iframes) e envia
                  como contexto para a IA responder sobre a tela. Desligue em telas com dados sensíveis.
                </span>
              </label>
            </Field>
            <Field label="Assistente de formulário (ler e preencher campos)">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.formAssist}
                  onChange={(e) => setDraft({ ...draft, formAssist: e.target.checked })}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span className="text-text-muted">
                  A IA lê os <strong>campos</strong> da tela (pode opinar sobre valores) e pode <strong>propor
                  preencher</strong> um campo — destacando-o em roxo e pedindo confirmação antes de escrever.
                  Bom para gerar textos (ex.: descrição de vaga) a partir dos outros campos. Requer que a leitura
                  da tela esteja ligada.
                </span>
              </label>
            </Field>
          </div>

          <div className="mt-5 flex gap-2">
            <Button onClick={save} disabled={pending || !draft.spaceId}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
          </div>
        </Surface>
      )}

      <ApiDocs siteUrl={siteUrl} />
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copiado!" : label}
    </Button>
  );
}

function EmbedSnippet({
  siteUrl, publicKey, spaceSlug,
}: {
  siteUrl: string;
  publicKey: string;
  spaceSlug?: string;
}) {
  const snippet = `<script src="${siteUrl}/widget.js" data-key="${publicKey}" async></script>`;
  const docUrl = `${siteUrl}/docs/${spaceSlug ?? "SUA-DOCUMENTACAO"}`;
  // O backend do cliente gera um TOKEN cifrado (à prova de adulteração) e o passa
  // no lugar dos parâmetros em texto.
  const embedComRastreio = `<script src="${siteUrl}/widget.js" data-key="${publicKey}"
  data-token="kbt1.SEU_TOKEN_GERADO_NO_BACKEND" async></script>`;
  const urlComRastreio = `${docUrl}?kbt=kbt1.SEU_TOKEN_GERADO_NO_BACKEND`;
  return (
    <div className="mt-3">
      <span className="mb-1 block text-xs font-medium text-text-muted">
        Cole antes de <code>&lt;/body&gt;</code> no site do cliente:
      </span>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-surface-2 px-2 py-1.5 text-xs">
          {snippet}
        </code>
        <CopyButton text={snippet} label="Copiar" />
      </div>

      {/* Rastreamento SEGURO — o backend do cliente assina os parâmetros num token. */}
      <details className="mt-3 rounded-lg border border-border">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-text">
          Rastrear quem usa (token seguro) — empresa, usuário, matrícula, perfil…
        </summary>
        <div className="space-y-3 border-t border-border p-3">
          <p className="text-xs text-text-muted">
            Para saber, no admin (em <b>Conversas</b> e <b>Acessos</b>), quem perguntou o quê, o seu
            backend gera um <b>token cifrado</b> com os dados do usuário logado e o passa no lugar dos
            parâmetros. Assim ninguém altera a identidade pelo console. Pegue a{" "}
            <b>chave de rastreio</b> e o passo a passo em <b>Rastreio seguro</b>, mais abaixo nesta
            página. São apenas rótulos — <b>nunca</b> entram na resposta da IA.
          </p>

          <div>
            <span className="mb-1 block text-xs font-medium text-text-muted">
              1) No widget — o seu backend injeta o token em <code>data-token</code>:
            </span>
            <div className="flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto whitespace-pre rounded bg-surface-2 p-2 text-xs">
                {embedComRastreio}
              </pre>
              <CopyButton text={embedComRastreio} label="Copiar" />
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-text-muted">
              2) Nos links para a documentação — anexe o token em <code>?kbt=</code>:
            </span>
            <div className="flex items-start gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-surface-2 px-2 py-1.5 text-xs">
                {urlComRastreio}
              </code>
              <CopyButton text={urlComRastreio} label="Copiar" />
            </div>
          </div>

          <p className="text-xs text-text-muted">
            A identidade vale para a <b>visita inteira</b>: basta chegar uma vez com o token (por link,
            redirecionamento ou SSO) que as páginas seguintes seguem atribuídas ao mesmo usuário.
            Dentro do token vão os campos <code>p_usuario</code>, <code>p_empresa</code>,{" "}
            <code>p_matricula</code>, <code>p_perfil</code>, <code>p_portal</code>, <code>p_base</code>.
          </p>
        </div>
      </details>
    </div>
  );
}

function ApiDocs({ siteUrl }: { siteUrl: string }) {
  return (
    <Surface elevation={1} padding="lg" className="text-sm">
      <h2 className="text-lg font-semibold">API REST</h2>
      <p className="mt-1 text-text-muted">
        Integre do seu jeito. Autentique com a chave pública no header{" "}
        <code>X-Widget-Key</code> (ou <code>Authorization: Bearer pk_…</code>). A
        origem é validada pela allowlist; há rate limit por chave e por IP.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="font-medium">POST {siteUrl}/api/v1/chat <span className="text-text-muted">— chat RAG (streaming SSE)</span></p>
          <pre className="mt-1 overflow-x-auto rounded bg-surface-2 p-3 text-xs">{`curl -N ${siteUrl}/api/v1/chat \\
  -H "X-Widget-Key: pk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Como emito uma nota fiscal?"}]}'

# Resposta: text/event-stream, eventos JSON:
#   data: {"type":"citations","citations":[{"n":1,"title":"…","url":"/docs/…"}]}
#   data: {"type":"token","value":"…"}
#   data: {"type":"done","conversationId":"…"}`}</pre>
        </div>
        <div>
          <p className="font-medium">POST {siteUrl}/api/v1/search <span className="text-text-muted">— busca híbrida (JSON)</span></p>
          <pre className="mt-1 overflow-x-auto rounded bg-surface-2 p-3 text-xs">{`curl ${siteUrl}/api/v1/search \\
  -H "X-Widget-Key: pk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"nota fiscal","limit":8}'

# Resposta: {"results":[{"title","heading_path","snippet","url"}]}`}</pre>
        </div>
      </div>
    </Surface>
  );
}
