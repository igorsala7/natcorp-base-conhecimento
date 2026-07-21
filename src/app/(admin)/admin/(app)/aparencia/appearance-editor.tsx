"use client";

import { useState, useTransition } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Field } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";
import { SpaceHomeView, type DadosHome } from "@/components/portal/space-home";
import { escolherEEnviar } from "@/lib/content/upload";
import { derivarVarianteEscura, derivarHover, contraste } from "@/lib/portal/brand-color";
import {
  ROTULO_REGIAO,
  type RegiaoKey,
  type TemaResolvido,
  type ThemeLink,
} from "@/lib/portal/theme";
import { updateSpaceTheme, updateSpaceChatPrompt } from "../configuracoes/actions";
import { SeletorEstilo, LinksEditor, DestaquesPicker, type ArtigoDisponivel } from "./sections";

export type { ArtigoDisponivel } from "./sections";

/** Converte o tema resolvido de volta para o formato gravado. */
function paraGravar(t: TemaResolvido) {
  // Linha em branco (recém-adicionada e não preenchida) não é erro: some.
  const limparLinks = (ls: ThemeLink[]) =>
    ls
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.label && l.url);
  const header = limparLinks(t.header.links);
  const footer = limparLinks(t.footer.links);

  return {
    brand: {
      ...(t.brand.color ? { color: t.brand.color } : {}),
      ...(t.brand.logoUrl ? { logoUrl: t.brand.logoUrl } : {}),
      ...(t.brand.coverUrl ? { coverUrl: t.brand.coverUrl } : {}),
      coverHeight: t.brand.coverHeight,
    },
    ...(header.length > 0 ? { header: { links: header } } : {}),
    ...(t.footer.text || footer.length > 0
      ? {
          footer: {
            ...(t.footer.text ? { text: t.footer.text } : {}),
            ...(footer.length > 0 ? { links: footer } : {}),
          },
        }
      : {}),
    home: {
      ...(t.home.title ? { title: t.home.title } : {}),
      subtitle: t.home.subtitle,
      heroStyle: t.home.heroStyle,
      categoriesStyle: t.home.categoriesStyle,
      ...(t.home.featured.length > 0 ? { featured: t.home.featured } : {}),
      supportTitle: t.home.supportTitle,
      supportText: t.home.supportText,
      regions: t.home.regions,
    },
    article: { related: t.article.related },
    ...(t.supportUrl ? { supportUrl: t.supportUrl } : {}),
    ...(t.supportEmail ? { supportEmail: t.supportEmail } : {}),
  };
}

function LinhaRegiao({
  regiao,
  onToggle,
}: {
  regiao: { key: RegiaoKey; on: boolean };
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: regiao.key,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${ROTULO_REGIAO[regiao.key]}`}
        className="cursor-grab touch-none text-text-muted hover:text-text"
      >
        <GripVertical className="size-4" />
      </button>
      <span className={`flex-1 text-sm ${regiao.on ? "" : "text-text-muted line-through"}`}>
        {ROTULO_REGIAO[regiao.key]}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={regiao.on}
        title={regiao.on ? "Ocultar da home" : "Mostrar na home"}
        className="rounded-sm p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        {regiao.on ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
    </li>
  );
}

export function AppearanceEditor({
  spaceId,
  spaceSlug,
  temaSalvo,
  promptSalvo,
  dados,
  artigosDisponiveis,
}: {
  spaceId: string;
  spaceSlug: string;
  temaSalvo: TemaResolvido;
  /** `spaces.chat_prompt` — persona padrão do chatbot desta documentação. */
  promptSalvo: string;
  dados: DadosHome;
  /** Artigos publicados do espaço — opções do seletor de destaques. */
  artigosDisponiveis: ArtigoDisponivel[];
}) {
  const [tema, setTema] = useState<TemaResolvido>(temaSalvo);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<"logo" | "cover" | null>(null);
  const [prompt, setPrompt] = useState(promptSalvo);

  const sujo = JSON.stringify(tema) !== JSON.stringify(temaSalvo) || prompt !== promptSalvo;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const setBrand = (patch: Partial<TemaResolvido["brand"]>) =>
    setTema((t) => ({ ...t, brand: { ...t.brand, ...patch } }));
  const setHome = (patch: Partial<TemaResolvido["home"]>) =>
    setTema((t) => ({ ...t, home: { ...t.home, ...patch } }));

  function salvar() {
    setMsg(null);
    startTransition(async () => {
      const res = await updateSpaceTheme(spaceId, paraGravar(tema));
      if (!res.ok) return setMsg(res.error);
      if (prompt !== promptSalvo) {
        const r2 = await updateSpaceChatPrompt(spaceId, prompt);
        if (!r2.ok) return setMsg(r2.error);
      }
      setMsg("Salvo. O portal público já reflete a mudança.");
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const regions = [...tema.home.regions];
    const de = regions.findIndex((r) => r.key === active.id);
    const para = regions.findIndex((r) => r.key === over.id);
    if (de < 0 || para < 0) return;
    const [movida] = regions.splice(de, 1);
    regions.splice(para, 0, movida!);
    setHome({ regions });
  }

  // Contraste da cor escolhida, medido e não presumido — a marca do cliente
  // pode simplesmente não servir para texto.
  const cor = tema.brand.color;
  const contrasteClaro = cor ? contraste(cor, "#ffffff") : null;
  const corEscura = cor ? derivarVarianteEscura(cor) : null;
  const corDe = cor ?? "#511C76";

  // A prévia segue o RASCUNHO: os destaques saem dos ids escolhidos agora,
  // não dos que estavam salvos quando a página carregou.
  const dadosPreview: DadosHome = {
    ...dados,
    destaques: tema.home.featured
      .map((id) => {
        const a = artigosDisponiveis.find((x) => x.id === id);
        if (!a) return null;
        const salvo = (dados.destaques ?? []).find((d) => d.id === id);
        return { ...a, excerpt: salvo?.excerpt ?? null };
      })
      .filter((d): d is NonNullable<typeof d> => !!d),
  };

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      {/* ── Formulário ─────────────────────────────────────────────── */}
      <div className="w-full shrink-0 space-y-5 xl:w-96">
        <Surface elevation={1} padding="lg" className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Marca</h2>

          <Field
            label="Cor da marca"
            htmlFor="cor"
            hint={
              cor
                ? `No tema escuro vira ${corEscura} automaticamente, para continuar legível.`
                : "Sem cor definida, a documentação usa o roxo padrão do produto."
            }
          >
            <div className="flex items-center gap-2">
              <input
                id="cor"
                type="color"
                value={cor ?? "#511C76"}
                onChange={(e) => setBrand({ color: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-md border border-border-strong bg-surface p-1"
              />
              <Input
                value={cor ?? ""}
                onChange={(e) => setBrand({ color: e.target.value || null })}
                placeholder="#511C76"
                aria-label="Cor em hexadecimal"
                className="flex-1"
              />
              {cor && (
                <Button variant="ghost" size="icon" title="Remover cor" onClick={() => setBrand({ color: null })}>
                  <RotateCcw className="size-4" />
                </Button>
              )}
            </div>
          </Field>

          {contrasteClaro !== null && contrasteClaro < 4.5 && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              Esta cor mede {contrasteClaro.toFixed(2)}:1 sobre branco — abaixo de 4,5:1. Ela serve
              para preenchimentos, mas texto e links nela ficam difíceis de ler.
            </p>
          )}

          <ImagemCampo
            rotulo="Logo (no cabeçalho)"
            valor={tema.brand.logoUrl}
            enviando={enviando === "logo"}
            onEnviar={() => {
              setEnviando("logo");
              escolherEEnviar(spaceId, (url) => {
                setEnviando(null);
                if (url) setBrand({ logoUrl: url });
                else setMsg("Falha no envio da imagem.");
              });
            }}
            onLimpar={() => setBrand({ logoUrl: null })}
          />

          <ImagemCampo
            rotulo="Imagem de capa da home"
            valor={tema.brand.coverUrl}
            enviando={enviando === "cover"}
            onEnviar={() => {
              setEnviando("cover");
              escolherEEnviar(spaceId, (url) => {
                setEnviando(null);
                if (url) {
                  setBrand({ coverUrl: url });
                  // Enviar a imagem sem ligar a região deixaria o usuário
                  // achando que não funcionou.
                  setHome({
                    regions: tema.home.regions.map((r) =>
                      r.key === "cover" ? { ...r, on: true } : r,
                    ),
                  });
                } else setMsg("Falha no envio da imagem.");
              });
            }}
            onLimpar={() => setBrand({ coverUrl: null })}
          />

          {tema.brand.coverUrl && tema.home.heroStyle !== "image" && (
            <Field label="Altura da faixa de capa" htmlFor="altura" hint="Entre 80 e 480 pixels.">
              <input
                id="altura"
                type="range"
                min={80}
                max={480}
                step={10}
                value={tema.brand.coverHeight}
                onChange={(e) => setBrand({ coverHeight: Number(e.target.value) })}
                className="w-full accent-[var(--color-primary)]"
              />
            </Field>
          )}
        </Surface>

        <Surface elevation={1} padding="lg" className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Layout</h2>

          <SeletorEstilo
            legenda="Abertura (título e busca)"
            valor={tema.home.heroStyle}
            onChange={(heroStyle) => setHome({ heroStyle })}
            opcoes={[
              {
                value: "plain",
                rotulo: "Limpa",
                thumb: (
                  <span className="flex size-full flex-col items-center justify-center gap-1 bg-bg">
                    <span className="h-1 w-8 rounded bg-text/60" />
                    <span className="h-2 w-12 rounded-sm border border-border bg-surface" />
                  </span>
                ),
              },
              {
                value: "brand",
                rotulo: "Cor da marca",
                thumb: (
                  <span
                    className="flex size-full flex-col items-center justify-center gap-1"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${corDe}, color-mix(in oklab, ${corDe} 45%, #191036))`,
                    }}
                  >
                    <span className="h-1 w-8 rounded bg-white/90" />
                    <span className="h-2 w-12 rounded-sm bg-white" />
                  </span>
                ),
              },
              {
                value: "image",
                rotulo: "Imagem",
                thumb: (
                  <span
                    className="flex size-full flex-col items-center justify-center gap-1"
                    style={{
                      backgroundColor: "#191036",
                      backgroundImage: tema.brand.coverUrl
                        ? `linear-gradient(rgba(21,13,38,.62), rgba(21,13,38,.62)), url(${tema.brand.coverUrl})`
                        : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <span className="h-1 w-8 rounded bg-white/90" />
                    <span className="h-2 w-12 rounded-sm bg-white" />
                  </span>
                ),
              },
            ]}
          />
          {tema.home.heroStyle === "image" && !tema.brand.coverUrl && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Envie a imagem de capa acima — sem ela, a abertura usa a cor da marca.
            </p>
          )}

          <SeletorEstilo
            legenda="Categorias"
            valor={tema.home.categoriesStyle}
            onChange={(categoriesStyle) => setHome({ categoriesStyle })}
            opcoes={[
              {
                value: "cards",
                rotulo: "Cartões",
                thumb: (
                  <span className="grid size-full grid-cols-2 gap-1 bg-bg p-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className="flex items-center gap-1 rounded-sm border border-border bg-surface px-1">
                        <span className="size-1.5 rounded-sm bg-primary/60" />
                        <span className="h-1 flex-1 rounded bg-text/30" />
                      </span>
                    ))}
                  </span>
                ),
              },
              {
                value: "tiles",
                rotulo: "Blocos",
                thumb: (
                  <span className="grid size-full grid-cols-3 gap-1 bg-bg p-1.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="flex flex-col items-center justify-center gap-1 rounded-sm border border-border bg-surface">
                        <span className="size-2 rounded-full bg-primary/60" />
                        <span className="h-1 w-4 rounded bg-text/30" />
                      </span>
                    ))}
                  </span>
                ),
              },
              {
                value: "list",
                rotulo: "Lista",
                thumb: (
                  <span className="flex size-full flex-col justify-center gap-1 bg-bg px-2">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="size-1.5 rounded-sm bg-primary/60" />
                        <span className="h-1 flex-1 rounded bg-text/30" />
                      </span>
                    ))}
                  </span>
                ),
              },
            ]}
          />

          <Field
            label="Artigos em destaque"
            htmlFor="destaques"
            hint='Aparecem na região "Artigos em destaque" — ligue-a na lista de regiões abaixo.'
          >
            <DestaquesPicker
              featured={tema.home.featured}
              disponiveis={artigosDisponiveis}
              onChange={(featured) => setHome({ featured })}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tema.article.related}
              onChange={(e) =>
                setTema((t) => ({ ...t, article: { ...t.article, related: e.target.checked } }))
              }
              className="size-4 accent-[var(--color-primary)]"
            />
            Mostrar &quot;Artigos relacionados&quot; no fim das páginas de leitura
          </label>
        </Surface>

        <Surface elevation={1} padding="lg" className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Cabeçalho e rodapé
          </h2>
          <Field
            label="Links do cabeçalho"
            htmlFor="links-header"
            hint="Até 4 — ex.: seu site, abrir chamado, portal do cliente. No celular eles vão para o menu."
          >
            <LinksEditor
              links={tema.header.links}
              max={4}
              onChange={(links) => setTema((t) => ({ ...t, header: { links } }))}
            />
          </Field>
          <Field label="Texto do rodapé" htmlFor="footer-texto" hint="Ex.: © 2026 Sua Empresa.">
            <Input
              id="footer-texto"
              value={tema.footer.text ?? ""}
              maxLength={200}
              onChange={(e) =>
                setTema((t) => ({ ...t, footer: { ...t.footer, text: e.target.value || null } }))
              }
            />
          </Field>
          <Field label="Links do rodapé" htmlFor="links-footer" hint="Até 6.">
            <LinksEditor
              links={tema.footer.links}
              max={6}
              onChange={(links) => setTema((t) => ({ ...t, footer: { ...t.footer, links } }))}
            />
          </Field>
        </Surface>

        <Surface elevation={1} padding="lg" className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Textos</h2>
          <Field label="Título" htmlFor="titulo" hint="Vazio usa o nome da documentação.">
            <Input
              id="titulo"
              value={tema.home.title ?? ""}
              onChange={(e) => setHome({ title: e.target.value || null })}
              placeholder={dados.spaceName}
            />
          </Field>
          <Field label="Subtítulo" htmlFor="subtitulo">
            <textarea
              id="subtitulo"
              rows={2}
              value={tema.home.subtitle}
              onChange={(e) => setHome({ subtitle: e.target.value })}
              className={controlClass}
            />
          </Field>
          <Field label="Título do bloco de suporte" htmlFor="sup-titulo">
            <Input
              id="sup-titulo"
              value={tema.home.supportTitle}
              onChange={(e) => setHome({ supportTitle: e.target.value })}
            />
          </Field>
          <Field label="Texto do bloco de suporte" htmlFor="sup-texto">
            <textarea
              id="sup-texto"
              rows={2}
              value={tema.home.supportText}
              onChange={(e) => setHome({ supportText: e.target.value })}
              className={controlClass}
            />
          </Field>
        </Surface>

        <Surface elevation={1} padding="lg" className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Assistente
          </h2>
          <Field
            label="Persona do chatbot desta documentação"
            htmlFor="chat-prompt"
            hint="Vale para o Ask-AI do portal e para os chatbots desta documentação que não tenham persona própria. As regras de citar fontes e não responder por conhecimento próprio continuam valendo."
          >
            <textarea
              id="chat-prompt"
              rows={4}
              value={prompt}
              placeholder="Ex.: Você é o suporte do Produto Alfa. Responda de forma objetiva e sempre indique o artigo."
              onChange={(e) => setPrompt(e.target.value)}
              className={controlClass}
            />
          </Field>
        </Surface>

        <Surface elevation={1} padding="lg">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-text-muted">
            Regiões
          </h2>
          <p className="mb-3 text-xs text-text-muted">
            Arraste para reordenar; o olho liga e desliga. A prévia ao lado acompanha.
          </p>
          <DndContext
            // Id explícito, obrigatório sob SSR — ver `ssr-dnd-ids.test.tsx`.
            id="dnd-regioes-home"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={tema.home.regions.map((r) => r.key)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-1.5">
                {tema.home.regions.map((r) => (
                  <LinhaRegiao
                    key={r.key}
                    regiao={r}
                    onToggle={() =>
                      setHome({
                        regions: tema.home.regions.map((x) =>
                          x.key === r.key ? { ...x, on: !x.on } : x,
                        ),
                      })
                    }
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </Surface>

        <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-bg py-3">
          <Button onClick={salvar} disabled={pending || !sujo}>
            {pending ? "Salvando…" : "Salvar aparência"}
          </Button>
          {sujo && (
            <Button
              variant="ghost"
              onClick={() => {
                setTema(temaSalvo);
                setPrompt(promptSalvo);
              }}
              disabled={pending}
            >
              Descartar
            </Button>
          )}
          <a
            href={`/docs/${spaceSlug}`}
            target="_blank"
            rel="noopener"
            className="ml-auto text-sm text-primary underline-offset-4 hover:underline"
          >
            Abrir a home
          </a>
        </div>

        {msg && (
          <p role="status" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
            {msg}
          </p>
        )}
      </div>

      {/* ── Prévia ao vivo ─────────────────────────────────────────────
          O MESMO componente da rota pública, com o tema em rascunho. Se fosse
          uma reprodução aqui, ela poderia divergir do que o leitor vê. */}
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          Prévia {sujo && <span className="text-primary">· não salva</span>}
        </p>
        <div
          className={`overflow-hidden rounded-xl border border-border bg-bg p-6 sm:p-10 ${
            cor ? "tema-espaco" : ""
          }`}
          style={
            cor
              ? ({
                  "--marca-claro": cor,
                  "--marca-claro-hover": derivarHover(cor),
                  "--marca-escuro": corEscura,
                } as React.CSSProperties)
              : undefined
          }
        >
          {/* A home pública roda em contêiner largo (`width="wide"`); a prévia
              acompanha para a faixa do hero e a grade de blocos respirarem. */}
          <div className="mx-auto max-w-4xl">
            <SpaceHomeView tema={tema} dados={dadosPreview} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ImagemCampo({
  rotulo,
  valor,
  enviando,
  onEnviar,
  onLimpar,
}: {
  rotulo: string;
  valor: string | null;
  enviando: boolean;
  onEnviar: () => void;
  onLimpar: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-text">{rotulo}</span>
      {valor ? (
        <div className="flex items-center gap-2 rounded-md border border-border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={valor} alt="" className="h-10 w-16 rounded-sm object-cover" />
          <span className="min-w-0 flex-1 truncate text-xs text-text-muted">
            {valor.split("/").pop()}
          </span>
          <Button variant="ghost" size="icon" title="Remover" onClick={onLimpar}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={onEnviar} disabled={enviando}>
          <ImagePlus className="size-4" /> {enviando ? "Enviando…" : "Enviar imagem"}
        </Button>
      )}
    </div>
  );
}
