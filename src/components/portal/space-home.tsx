import Link from "next/link";
import type { CSSProperties } from "react";
import { Folder, FileText, LifeBuoy, ArrowRight, Star, ThumbsUp } from "lucide-react";
import { SearchTrigger, AskTrigger } from "@/components/portal/portal-search";
import { ICONS } from "@/lib/blocks/icons";
import { regiaoAtiva, type TemaResolvido, type RegiaoKey } from "@/lib/portal/theme";
import { SubscribeForm } from "@/components/portal/subscribe-form";

/**
 * A home pública de uma documentação, como componente PURO.
 *
 * Mesmo papel de `render.tsx` entre o editor e o portal: é o único lugar onde a
 * home existe, então a prévia do admin não tem como mentir sobre o resultado.
 * Recebe dados já buscados e o tema resolvido — não consulta nada.
 *
 * As seções não estão fixas no JSX: a página é a iteração de
 * `tema.home.regions`, cuja ORDEM no array é a ordem na tela.
 */

export type ItemHome = { id: string; title: string; href: string };
export type CategoriaHome = ItemHome & {
  artigos: number;
  icon: string | null;
  descricao: string | null;
};
export type ArtigoSoltoHome = ItemHome & { icon: string | null };
export type RecenteHome = ItemHome & { updatedAt: string };
export type DestaqueHome = ItemHome & { excerpt: string | null };

export type DadosHome = {
  spaceName: string;
  /** Slug do espaço — a região de inscrição envia para a API com ele. */
  spaceSlug: string;
  categorias: CategoriaHome[];
  artigosSoltos: ArtigoSoltoHome[];
  recentes: RecenteHome[];
  /** Curadoria manual (`tema.home.featured`), já resolvida para nós vivos. */
  destaques?: DestaqueHome[];
  /** Melhor saldo de "isso foi útil?" — vazio enquanto não há feedback. */
  maisUteis?: ItemHome[];
  supportUrl?: string;
};

/** Ícone do catálogo pela chave gravada no nó; cai no fallback sem quebrar. */
function IconeDoNo({
  chave,
  fallback: Fallback,
  className,
}: {
  chave: string | null;
  fallback: typeof Folder;
  className?: string;
}) {
  const Icone = (chave && ICONS[chave]) || Fallback;
  return <Icone className={className} />;
}

export function SpaceHomeView({ tema, dados }: { tema: TemaResolvido; dados: DadosHome }) {
  const ligada = (k: RegiaoKey) => regiaoAtiva(tema, k);
  const temCategorias = dados.categorias.length > 0 || dados.artigosSoltos.length > 0;
  const destaques = dados.destaques ?? [];
  const maisUteis = dados.maisUteis ?? [];

  // A abertura agrupa título/subtítulo, busca e IA. Se as três estiverem
  // desligadas, o bloco inteiro some junto com o espaçamento dele.
  const abertura = ligada("hero") || ligada("search") || ligada("ask");

  // Faixa de fundo da abertura ("brand" = gradiente da marca, "image" = capa
  // com véu escuro). O véu é fixo e opaco o bastante para o texto branco
  // passar de 4,5:1 sobre QUALQUER imagem — contraste garantido por projeto,
  // não pela sorte da foto.
  // Sem imagem de capa, "image" recai na cor (senão a faixa ficaria sem fundo).
  const heroStyle =
    tema.home.heroStyle === "image" && !tema.brand.coverUrl ? "color" : tema.home.heroStyle;
  const comFaixa = heroStyle !== "plain" && abertura;
  const corDe = tema.brand.color ?? "#511C76"; // cor do site (links, brilhos)
  const corAbertura = tema.home.heroColor ?? corDe; // fundo da abertura
  const textura = tema.home.heroTexture;
  // Fundo da faixa: a IMAGEM mantém o tratamento escuro da referência; a COR usa
  // a cor escolhida como fundo real, com um leve escurecimento no rodapé para o
  // texto branco continuar legível (o "gradiente" troca isso por um degradê).
  const faixaCss: CSSProperties | undefined =
    heroStyle === "image"
      ? {
          backgroundColor: "#191036",
          backgroundImage: `linear-gradient(rgba(21,13,38,0.62), rgba(21,13,38,0.62)), url(${tema.brand.coverUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : heroStyle === "color"
        ? textura === "gradient"
          ? {
              backgroundColor: corAbertura,
              backgroundImage: `linear-gradient(135deg, ${corAbertura}, color-mix(in oklab, ${corAbertura} 45%, #0b0a12))`,
            }
          : {
              backgroundColor: corAbertura,
              backgroundImage: `linear-gradient(rgba(0,0,0,0.04), rgba(0,0,0,0.22))`,
            }
        : undefined;

  // Overlay de textura sobre o fundo. `grid` = grade + brilhos (padrão da
  // referência); `dots`/`noise` = padrões; `gradient`/`none` = sem overlay (o
  // fundo já resolve). Ruído é um data-URI SVG (auto-contido, CSP ok).
  const brilhos = (cor: string) => (
    <>
      <div
        className="absolute -top-32 left-1/4 size-72 rounded-full blur-3xl"
        style={{ backgroundColor: `color-mix(in srgb, ${cor} 30%, transparent)` }}
      />
      <div
        className="absolute -bottom-20 -right-20 size-72 rounded-full blur-3xl"
        style={{ backgroundColor: `color-mix(in srgb, ${cor} 30%, transparent)` }}
      />
    </>
  );
  const grade = (
    <div
      className="absolute inset-0 opacity-[0.35]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
        backgroundSize: "36px 36px",
      }}
    />
  );
  const RUIDO =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
  const aberturaOverlay = !comFaixa
    ? null
    : heroStyle === "image"
      ? (
          <>
            {brilhos(corDe)}
            {grade}
          </>
        )
      : textura === "grid"
        ? (
            <>
              {brilhos("#ffffff")}
              {grade}
            </>
          )
        : textura === "dots"
          ? (
              <div
                className="absolute inset-0 opacity-50"
                style={{
                  backgroundImage: "radial-gradient(rgba(255,255,255,0.22) 1.3px, transparent 1.3px)",
                  backgroundSize: "18px 18px",
                }}
              />
            )
          : textura === "noise"
            ? (
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: RUIDO }} />
              )
            : null;

  const secao = (key: RegiaoKey) => {
    switch (key) {
      case "cover":
        // Com o hero em modo imagem, a capa já é o fundo da faixa — repetir a
        // mesma foto duas vezes na home seria papel de parede, não layout.
        if (!ligada("cover") || !tema.brand.coverUrl || heroStyle === "image") return null;
        return (
          <div
            key={key}
            className="mb-10 overflow-hidden rounded-xl border border-border"
            // Altura reservada: sem isto a imagem empurra a página ao carregar
            // (layout shift no LCP da home).
            style={{ height: tema.brand.coverHeight }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tema.brand.coverUrl}
              alt=""
              className="size-full object-cover"
              width={1600}
              height={tema.brand.coverHeight}
            />
          </div>
        );

      case "hero":
      case "search":
      case "ask":
        return null; // renderizadas juntas na abertura, abaixo

      case "featured":
        if (!ligada("featured") || destaques.length === 0) return null;
        return (
          <section key={key} className="mt-16 first:mt-0">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Em destaque
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {destaques.map((d) => (
                <li key={d.id}>
                  <Link
                    href={d.href}
                    className="group flex h-full items-start gap-3.5 rounded-lg border border-border bg-surface p-4 no-underline transition-shadow hover:shadow-2"
                  >
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40">
                      <Star className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-snug">{d.title}</span>
                      {d.excerpt && (
                        <span className="mt-0.5 line-clamp-2 block text-[0.8125rem] leading-relaxed text-text-muted">
                          {d.excerpt}
                        </span>
                      )}
                    </span>
                    <ArrowRight className="mt-2.5 size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transform-none" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );

      case "categories": {
        if (!ligada("categories") || !temCategorias) return null;
        const estilo = tema.home.categoriesStyle;

        if (estilo === "list") {
          // Linhas da referência: divisor fraco entre elas, tinta da marca no
          // hover e título que "acende" em roxo junto.
          return (
            <section key={key} className="mt-16 first:mt-0">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Categorias
              </h2>
              <ul className="divide-y divide-brand-gray-100 dark:divide-brand-gray-800">
                {dados.categorias.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={c.href}
                      className="group flex items-center gap-4 px-6 py-4 no-underline transition-colors hover:bg-brand-purple-50/50 dark:hover:bg-brand-purple-950/25"
                    >
                      <IconeDoNo chave={c.icon} fallback={Folder} className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold transition-colors group-hover:text-brand-purple-700 dark:group-hover:text-brand-purple-300">
                          {c.title}
                        </span>
                        {c.descricao && (
                          <span className="line-clamp-1 block text-xs text-text-muted">
                            {c.descricao}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-text-muted">
                        {c.artigos} artigo(s)
                      </span>
                    </Link>
                  </li>
                ))}
                {dados.artigosSoltos.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      className="group flex items-center gap-4 px-6 py-4 no-underline transition-colors hover:bg-brand-purple-50/50 dark:hover:bg-brand-purple-950/25"
                    >
                      <IconeDoNo chave={a.icon} fallback={FileText} className="size-4 shrink-0 text-text-muted" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium transition-colors group-hover:text-brand-purple-700 dark:group-hover:text-brand-purple-300">
                        {a.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        if (estilo === "tiles") {
          return (
            <section key={key} className="mt-16 first:mt-0">
              <h2 className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-text-muted">
                Categorias
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dados.categorias.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={c.href}
                      className="group flex h-full flex-col items-center gap-3 rounded-xl border border-border bg-surface px-5 py-8 text-center no-underline transition-shadow hover:shadow-2"
                    >
                      <span className="flex size-12 items-center justify-center rounded-full bg-brand-purple-50 text-primary transition-transform group-hover:scale-105 motion-reduce:transform-none dark:bg-brand-purple-950/40">
                        <IconeDoNo chave={c.icon} fallback={Folder} className="size-5" />
                      </span>
                      <span className="font-semibold leading-snug">{c.title}</span>
                      <span className="text-[0.8125rem] leading-relaxed text-text-muted">
                        {c.descricao ?? `${c.artigos} artigo(s)`}
                      </span>
                    </Link>
                  </li>
                ))}
                {dados.artigosSoltos.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      className="group flex h-full flex-col items-center gap-3 rounded-xl border border-border bg-surface px-5 py-8 text-center no-underline transition-shadow hover:shadow-2"
                    >
                      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-text-muted">
                        <IconeDoNo chave={a.icon} fallback={FileText} className="size-5" />
                      </span>
                      <span className="font-semibold leading-snug">{a.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        // "cards" — o padrão de sempre, agora com ícone da pasta e descrição.
        // Anatomia da referência: ícone 40px com gradiente que INVERTE no
        // hover, nome, descrição em 2 linhas e a contagem com seta que anda.
        return (
          <section key={key} className="mt-16 first:mt-0">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Categorias
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {dados.categorias.map((c, i) => (
                <li key={c.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-fade-up">
                  <Link
                    href={c.href}
                    className="group flex h-full items-start gap-3.5 rounded-xl border border-border bg-surface p-5 no-underline shadow-1 transition-all hover:-translate-y-0.5 hover:border-brand-purple-300 hover:shadow-2 motion-reduce:transform-none dark:hover:border-brand-purple-700"
                  >
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-purple-50 to-brand-purple-100 text-primary transition-colors group-hover:from-brand-purple-500 group-hover:to-brand-purple-700 group-hover:text-white dark:from-brand-purple-950/60 dark:to-brand-purple-900/60 dark:text-brand-purple-300">
                      <IconeDoNo chave={c.icon} fallback={Folder} className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold leading-snug transition-colors group-hover:text-brand-purple-700 dark:group-hover:text-brand-purple-300">
                        {c.title}
                      </span>
                      {c.descricao && (
                        <span className="mt-0.5 line-clamp-2 block text-sm leading-relaxed text-text-muted">
                          {c.descricao}
                        </span>
                      )}
                      <span className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-primary">
                        <span className="tabular-nums">{c.artigos} artigo(s)</span>
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {dados.artigosSoltos.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="group flex items-center gap-3.5 rounded-xl border border-border bg-surface p-5 no-underline shadow-1 transition-all hover:border-brand-purple-300 hover:shadow-2 dark:hover:border-brand-purple-700"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-text-muted">
                      <IconeDoNo chave={a.icon} fallback={FileText} className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium leading-snug">
                      {a.title}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transform-none" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      }

      case "top":
        if (!ligada("top") || maisUteis.length === 0) return null;
        return (
          <section key={key} className="mt-14 first:mt-0">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Mais úteis
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
              {maisUteis.map((a, i) => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="flex items-center gap-3.5 px-4 py-3 no-underline transition-colors hover:bg-brand-purple-50/50 dark:hover:bg-brand-purple-950/25"
                  >
                    <span className="w-5 shrink-0 text-center font-mono text-sm font-bold text-text-muted/60">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                    <ThumbsUp className="size-3.5 shrink-0 text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );

      case "recent":
        if (!ligada("recent") || dados.recentes.length === 0) return null;
        return (
          // Lista, não cartão: é informação secundária.
          <section key={key} className="mt-14 first:mt-0">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Recentemente atualizados
            </h2>
            <ul className="divide-y divide-border">
              {dados.recentes.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="-mx-3 flex items-center justify-between gap-3 rounded-md px-3 py-3 no-underline transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">{a.title}</span>
                    <time
                      dateTime={new Date(a.updatedAt).toISOString()}
                      className="shrink-0 text-xs text-text-muted"
                    >
                      {new Date(a.updatedAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                      })}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );

      case "support":
        if (!ligada("support")) return null;
        return (
          <section key={key} className="mt-16 rounded-lg border border-border p-6 text-center first:mt-0">
            <p className="font-medium">{tema.home.supportTitle}</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-text-muted">
              {tema.home.supportText}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <AskTrigger />
              {dados.supportUrl && (
                <a
                  href={dados.supportUrl}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary"
                >
                  <LifeBuoy className="size-4" /> Falar com o suporte
                </a>
              )}
            </div>
          </section>
        );
      case "subscribe":
        if (!ligada("subscribe")) return null;
        return <SubscribeForm key={key} spaceSlug={dados.spaceSlug} />;
    }
  };

  const aberturaConteudo = (
    <>
      {/* Logo na abertura (opcional): acima do título e abaixo do rótulo
          "Central de ajuda". Sem logo ou sem a opção, não ocupa espaço. */}
      {tema.home.heroLogo && tema.brand.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tema.brand.logoUrl}
          alt=""
          className="mx-auto mb-5 h-16 w-auto max-w-[14rem] object-contain"
        />
      )}
      {ligada("hero") && (
        <>
          <h1
            className={`text-[length:var(--text-3xl)] font-bold leading-[1.1] tracking-tight ${
              comFaixa ? "text-white" : ""
            }`}
          >
            {tema.home.title || dados.spaceName}
          </h1>
          <p
            className={`mx-auto mt-4 max-w-md text-[1.0625rem] leading-relaxed ${
              comFaixa ? "text-white/85" : "text-text-muted"
            }`}
          >
            {tema.home.subtitle}
          </p>
        </>
      )}
      {ligada("search") && (
        <div className={ligada("hero") ? "mt-8" : undefined}>
          <SearchTrigger variant="hero" />
        </div>
      )}
      {ligada("ask") && (
        <div className="mt-3 flex justify-center">
          <AskTrigger tone={comFaixa ? "band" : "default"} />
        </div>
      )}
    </>
  );

  return (
    <>
      {tema.home.regions.map((r) => {
        // A abertura sai no lugar da PRIMEIRA das três que estiver na lista,
        // para respeitar a posição escolhida na reordenação.
        const primeiraDaAbertura = tema.home.regions.find(
          (x) => x.key === "hero" || x.key === "search" || x.key === "ask",
        );
        if (r.key === primeiraDaAbertura?.key && abertura) {
          if (comFaixa) {
            return (
              <section
                key="abertura"
                className="relative mb-4 overflow-hidden rounded-2xl px-6 py-14 text-center sm:mb-8 sm:px-10 sm:py-16"
                style={faixaCss}
              >
                {/* Textura escolhida na Aparência (grade/pontos/ruído/gradiente).
                    O fundo (`faixaCss`) já mandou na cor; aqui é só o detalhe. */}
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  {aberturaOverlay}
                </div>
                <div className="relative mx-auto max-w-2xl">
                  <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                    <span className="size-1.5 animate-pulse rounded-full bg-success motion-reduce:animate-none" />
                    Central de ajuda · {dados.spaceName}
                  </p>
                  {aberturaConteudo}
                </div>
              </section>
            );
          }
          return (
            <section key="abertura" className="mx-auto max-w-2xl pb-4 text-center sm:pb-8">
              {aberturaConteudo}
            </section>
          );
        }
        return secao(r.key);
      })}
    </>
  );
}
