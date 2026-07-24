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
import { updateSpaceTheme } from "../configuracoes/actions";
import { SeletorEstilo, LinksEditor, SocialEditor, DestaquesPicker, type ArtigoDisponivel } from "./sections";

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
  const social = t.footer.social
    .map((s) => ({ network: s.network, url: s.url.trim() }))
    .filter((s) => s.url);

  return {
    brand: {
      ...(t.brand.color ? { color: t.brand.color } : {}),
      ...(t.brand.logoUrl ? { logoUrl: t.brand.logoUrl } : {}),
      ...(t.brand.coverUrl ? { coverUrl: t.brand.coverUrl } : {}),
      coverHeight: t.brand.coverHeight,
    },
    header: {
      showTitle: t.header.showTitle,
      height: t.header.height,
      ...(header.length > 0 ? { links: header } : {}),
    },
    ...(t.footer.text || footer.length > 0 || social.length > 0
      ? {
          footer: {
            ...(t.footer.text ? { text: t.footer.text } : {}),
            ...(footer.length > 0 ? { links: footer } : {}),
            ...(social.length > 0 ? { social } : {}),
          },
        }
      : {}),
    home: {
      ...(t.home.title ? { title: t.home.title } : {}),
      subtitle: t.home.subtitle,
      heroStyle: t.home.heroStyle,
      ...(t.home.heroColor ? { heroColor: t.home.heroColor } : {}),
      heroTexture: t.home.heroTexture,
      heroLogo: t.home.heroLogo,
      categoriesStyle: t.home.categoriesStyle,
      ...(t.home.featured.length > 0 ? { featured: t.home.featured } : {}),
      supportTitle: t.home.supportTitle,
      supportText: t.home.supportText,
      regions: t.home.regions,
    },
    article: {
      related: t.article.related,
      fontSize: t.article.fontSize,
      divider: t.article.divider,
    },
    ...(t.tracking.ga4 ? { tracking: { ga4: t.tracking.ga4 } } : {}),
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
  dados,
  artigosDisponiveis,
}: {
  spaceId: string;
  spaceSlug: string;
  temaSalvo: TemaResolvido;
  dados: DadosHome;
  /** Artigos publicados do espaço — opções do seletor de destaques. */
  artigosDisponiveis: ArtigoDisponivel[];
}) {
  const [tema, setTema] = useState<TemaResolvido>(temaSalvo);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<"logo" | "cover" | null>(null);

  const sujo = JSON.stringify(tema) !== JSON.stringify(temaSalvo);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const setBrand = (patch: Partial<TemaResolvido["brand"]>) =>
    setTema((t) => ({ ...t, brand: { ...t.brand, ...patch } }));
  const setHome = (patch: Partial<TemaResolvido["home"]>) =>
    setTema((t) => ({ ...t, home: { ...t.home, ...patch } }));
  const setHeader = (patch: Partial<TemaResolvido["header"]>) =>
    setTema((t) => ({ ...t, header: { ...t.header, ...patch } }));

  function salvar() {
    setMsg(null);
    startTransition(async () => {
      // Um erro lançado (não retornado) por uma action dentro da transição sobe
      // até a raiz e apaga a tela. O try/catch mantém a falha na própria página.
      try {
        const res = await updateSpaceTheme(spaceId, paraGravar(tema));
        if (!res.ok) return setMsg(res.error);
        setMsg("Salvo. O portal público já reflete a mudança.");
      } catch (e) {
        setMsg(e instanceof Error ? `Falha ao salvar: ${e.message}` : "Falha ao salvar.");
      }
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
  // Cor da abertura: a escolhida no seletor ou, sem ela, a cor da marca.
  const corAbertura = tema.home.heroColor ?? corDe;
  const contrasteAbertura = contraste(corAbertura, "#ffffff");
  // O <input type="color"> é controlado e EXIGE um #rrggbb válido; um hex sendo
  // digitado ("#5") passaria como valor inválido. Cai na cor da marca até
  // completar, sem quebrar o input.
  const corAberturaInput = /^#[0-9a-f]{6}$/i.test(corAbertura) ? corAbertura : (cor ?? "#511C76");

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
    // Rolagem normal da página: as duas colunas fluem juntas. `items-start`
    // impede a coluna da prévia de esticar (senão sobra uma faixa em branco
    // embaixo da caixa). Sem sticky — nada fica "fixo" enquanto a página rola.
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
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
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Cabeçalho</h2>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tema.header.showTitle}
              onChange={(e) => setHeader({ showTitle: e.target.checked })}
              className="size-4 accent-[var(--color-primary)]"
            />
            Mostrar o nome ao lado do logo
          </label>

          <Field
            label="Altura da barra superior"
            htmlFor="altura-barra"
            hint="Entre 48 e 120 pixels — o logo cresce junto para ganhar destaque."
          >
            <div className="flex items-center gap-3">
              <input
                id="altura-barra"
                type="range"
                min={48}
                max={120}
                step={2}
                value={tema.header.height}
                onChange={(e) => setHeader({ height: Number(e.target.value) })}
                className="w-full accent-[var(--color-primary)]"
              />
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-text-muted">
                {tema.header.height}px
              </span>
            </div>
          </Field>
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
                value: "color",
                rotulo: "Cor",
                thumb: (
                  <span
                    className="flex size-full flex-col items-center justify-center gap-1"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${corAbertura}, color-mix(in oklab, ${corAbertura} 45%, #191036))`,
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
              Envie a imagem de capa acima — sem ela, a abertura usa a cor.
            </p>
          )}

          {tema.home.heroStyle === "color" && (
            <div className="space-y-4 rounded-lg border border-border bg-surface-2/40 p-3">
              <Field label="Cor da abertura" htmlFor="cor-abertura" hint="Independente da cor da marca do site.">
                <div className="flex items-center gap-2">
                  <input
                    id="cor-abertura"
                    type="color"
                    value={corAberturaInput}
                    onChange={(e) => setHome({ heroColor: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-md border border-border-strong bg-surface p-1"
                  />
                  <Input
                    value={tema.home.heroColor ?? ""}
                    onChange={(e) => setHome({ heroColor: e.target.value || null })}
                    placeholder={cor ?? "#511C76"}
                    aria-label="Cor da abertura em hexadecimal"
                    className="flex-1"
                  />
                  {tema.home.heroColor && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Usar a cor da marca"
                      onClick={() => setHome({ heroColor: null })}
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                  )}
                </div>
              </Field>
              {contrasteAbertura < 4.5 && (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  Esta cor mede {contrasteAbertura.toFixed(2)}:1 com o texto branco da abertura — abaixo
                  de 4,5:1. Uma cor mais escura deixa o título e a busca mais legíveis.
                </p>
              )}

              <SeletorEstilo
                legenda="Textura"
                valor={tema.home.heroTexture}
                onChange={(heroTexture) => setHome({ heroTexture })}
                opcoes={[
                  {
                    value: "none",
                    rotulo: "Nenhuma",
                    thumb: <span className="block size-full" style={{ backgroundColor: corAbertura }} />,
                  },
                  {
                    value: "grid",
                    rotulo: "Grade",
                    thumb: (
                      <span
                        className="block size-full"
                        style={{
                          backgroundColor: corAbertura,
                          backgroundImage:
                            "linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)",
                          backgroundSize: "10px 10px",
                        }}
                      />
                    ),
                  },
                  {
                    value: "dots",
                    rotulo: "Pontinhos",
                    thumb: (
                      <span
                        className="block size-full"
                        style={{
                          backgroundColor: corAbertura,
                          backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1.2px, transparent 1.2px)",
                          backgroundSize: "8px 8px",
                        }}
                      />
                    ),
                  },
                  {
                    value: "noise",
                    rotulo: "Ruído",
                    thumb: (
                      <span
                        className="block size-full"
                        style={{
                          backgroundColor: corAbertura,
                          backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
                        }}
                      />
                    ),
                  },
                  {
                    value: "gradient",
                    rotulo: "Gradiente",
                    thumb: (
                      <span
                        className="block size-full"
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${corAbertura}, color-mix(in oklab, ${corAbertura} 45%, #0b0a12))`,
                        }}
                      />
                    ),
                  },
                ]}
              />
            </div>
          )}

          <label
            className={`flex items-center gap-2 text-sm ${tema.brand.logoUrl ? "" : "opacity-60"}`}
          >
            <input
              type="checkbox"
              checked={tema.home.heroLogo && !!tema.brand.logoUrl}
              disabled={!tema.brand.logoUrl}
              onChange={(e) => setHome({ heroLogo: e.target.checked })}
              className="size-4 accent-[var(--color-primary)]"
            />
            Mostrar o logo na abertura (acima do título)
          </label>
          {!tema.brand.logoUrl && (
            <p className="text-xs text-text-muted">Envie um logo em “Marca” para habilitar.</p>
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

        </Surface>

        <Surface elevation={1} padding="lg" className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Leitura
          </h2>

          <SeletorEstilo
            legenda="Tamanho da fonte"
            valor={tema.article.fontSize}
            onChange={(fontSize) =>
              setTema((t) => ({ ...t, article: { ...t.article, fontSize } }))
            }
            opcoes={[
              {
                value: "compact",
                rotulo: "Compacta",
                thumb: (
                  <span className="flex size-full flex-col justify-center gap-1 bg-bg px-2.5">
                    <span className="h-1.5 w-10 rounded bg-text/70" />
                    <span className="h-1 w-full rounded bg-text/25" />
                    <span className="h-1 w-4/5 rounded bg-text/25" />
                  </span>
                ),
              },
              {
                value: "normal",
                rotulo: "Padrão",
                thumb: (
                  <span className="flex size-full flex-col justify-center gap-1 bg-bg px-2.5">
                    <span className="h-2 w-12 rounded bg-text/70" />
                    <span className="h-1 w-full rounded bg-text/25" />
                    <span className="h-1 w-4/5 rounded bg-text/25" />
                  </span>
                ),
              },
              {
                value: "large",
                rotulo: "Ampla",
                thumb: (
                  <span className="flex size-full flex-col justify-center gap-1 bg-bg px-2.5">
                    <span className="h-3 w-14 rounded bg-text/70" />
                    <span className="h-1.5 w-full rounded bg-text/25" />
                    <span className="h-1.5 w-4/5 rounded bg-text/25" />
                  </span>
                ),
              },
            ]}
          />

          <SeletorEstilo
            legenda="Separação entre diretórios"
            valor={tema.article.divider}
            onChange={(divider) =>
              setTema((t) => ({ ...t, article: { ...t.article, divider } }))
            }
            opcoes={[
              {
                value: "band",
                rotulo: "Faixa",
                thumb: (
                  <span className="flex size-full flex-col justify-center gap-1 bg-bg px-2">
                    <span className="flex h-4 flex-col justify-center gap-0.5 rounded-sm bg-brand-purple-50 px-1.5 dark:bg-brand-purple-950/40">
                      <span className="h-1 w-8 rounded bg-primary/70" />
                    </span>
                    <span className="h-1 w-full rounded bg-text/25" />
                  </span>
                ),
              },
              {
                value: "line",
                rotulo: "Linha",
                thumb: (
                  <span className="flex size-full flex-col justify-center gap-1 bg-bg px-2">
                    <span className="w-full border-t border-border-strong/60" />
                    <span className="h-1 w-8 rounded bg-text/70" />
                    <span className="h-1 w-full rounded bg-text/25" />
                  </span>
                ),
              },
              {
                value: "space",
                rotulo: "Só espaço",
                thumb: (
                  <span className="flex size-full flex-col justify-center gap-1.5 bg-bg px-2">
                    <span className="h-1 w-8 rounded bg-text/70" />
                    <span className="h-1 w-full rounded bg-text/25" />
                  </span>
                ),
              },
            ]}
          />

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
          {dados.categorias[0] && (
            <p className="text-xs text-text-muted">
              A prévia ao lado é da home;{" "}
              <a
                href={dados.categorias[0].href}
                target="_blank"
                rel="noopener"
                className="text-primary underline-offset-4 hover:underline"
              >
                abra uma página de leitura
              </a>{" "}
              para ver a tipografia aplicada (depois de salvar).
            </p>
          )}
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
              onChange={(links) => setHeader({ links })}
            />
          </Field>
          <Field
            label="Descrição do rodapé"
            htmlFor="footer-texto"
            hint="Uma linha institucional sobre a empresa (o © com o ano e o nome já aparecem sozinhos)."
          >
            <textarea
              id="footer-texto"
              value={tema.footer.text ?? ""}
              maxLength={280}
              rows={2}
              placeholder="Ex.: Soluções inteligentes de RH para a sua empresa."
              onChange={(e) =>
                setTema((t) => ({ ...t, footer: { ...t.footer, text: e.target.value || null } }))
              }
              className={`${controlClass} resize-none`}
            />
          </Field>
          <Field
            label="Redes sociais"
            htmlFor="footer-redes"
            hint="Ícones no rodapé. Cole o endereço do perfil (ou mailto:/wa.me para e-mail e WhatsApp)."
          >
            <SocialEditor
              social={tema.footer.social}
              max={10}
              onChange={(social) => setTema((t) => ({ ...t, footer: { ...t.footer, social } }))}
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
            Integrações
          </h2>
          <Field
            label="Google Analytics 4 — Measurement ID"
            htmlFor="ga4-id"
            hint="Formato G-XXXXXXX. Vazio desliga. Só o ID — script livre não entra no portal."
          >
            <input
              id="ga4-id"
              value={tema.tracking.ga4 ?? ""}
              placeholder="G-ABC123XYZ"
              onChange={(e) =>
                setTema((t) => ({
                  ...t,
                  tracking: { ga4: e.target.value.trim().toUpperCase() || null },
                }))
              }
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
            <Button variant="ghost" onClick={() => setTema(temaSalvo)} disabled={pending}>
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
