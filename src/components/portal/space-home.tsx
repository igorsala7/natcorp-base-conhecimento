import Link from "next/link";
import type { CSSProperties } from "react";
import { Folder, FileText, LifeBuoy, ArrowRight, Star, ThumbsUp } from "lucide-react";
import { SearchTrigger, AskTrigger } from "@/components/portal/portal-search";
import { ICONS } from "@/lib/blocks/icons";
import { regiaoAtiva, type TemaResolvido, type RegiaoKey } from "@/lib/portal/theme";

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
  const heroStyle =
    tema.home.heroStyle === "image" && !tema.brand.coverUrl ? "brand" : tema.home.heroStyle;
  const comFaixa = heroStyle !== "plain" && abertura;
  const corDe = tema.brand.color ?? "#511C76";
  const faixaCss: CSSProperties | undefined =
    heroStyle === "brand"
      ? {
          backgroundColor: corDe,
          backgroundImage: `linear-gradient(135deg, ${corDe}, color-mix(in oklab, ${corDe} 45%, #191036))`,
        }
      : heroStyle === "image"
        ? {
            backgroundColor: "#191036",
            backgroundImage: `linear-gradient(rgba(21,13,38,0.62), rgba(21,13,38,0.62)), url(${tema.brand.coverUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }
        : undefined;

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
          return (
            <section key={key} className="mt-16 first:mt-0">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Categorias
              </h2>
              <ul className="divide-y divide-border">
                {dados.categorias.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={c.href}
                      className="-mx-3 flex items-center gap-3 rounded-md px-3 py-3 no-underline transition-colors hover:bg-surface-2"
                    >
                      <IconeDoNo chave={c.icon} fallback={Folder} className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.title}</span>
                        {c.descricao && (
                          <span className="block truncate text-[0.8125rem] text-text-muted">
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
                      className="-mx-3 flex items-center gap-3 rounded-md px-3 py-3 no-underline transition-colors hover:bg-surface-2"
                    >
                      <IconeDoNo chave={a.icon} fallback={FileText} className="size-4 shrink-0 text-text-muted" />
                      <span className="min-w-0 flex-1 truncate font-medium">{a.title}</span>
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
        return (
          <section key={key} className="mt-16 first:mt-0">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Categorias
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {dados.categorias.map((c) => (
                <li key={c.id}>
                  <Link
                    href={c.href}
                    className="group flex items-start gap-3.5 rounded-lg border border-border bg-surface p-4 no-underline transition-shadow hover:shadow-2"
                  >
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40">
                      <IconeDoNo chave={c.icon} fallback={Folder} className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium leading-snug">{c.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[0.8125rem] leading-relaxed text-text-muted">
                        {c.descricao ?? (
                          <span className="tabular-nums">{c.artigos} artigo(s)</span>
                        )}
                      </span>
                    </span>
                    <ArrowRight className="mt-2.5 size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transform-none" />
                  </Link>
                </li>
              ))}
              {dados.artigosSoltos.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="group flex items-center gap-3.5 rounded-lg border border-border bg-surface p-4 no-underline transition-shadow hover:shadow-2"
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
            <ul className="divide-y divide-border">
              {maisUteis.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="-mx-3 flex items-center gap-3 rounded-md px-3 py-3 no-underline transition-colors hover:bg-surface-2"
                  >
                    <ThumbsUp className="size-4 shrink-0 text-primary" />
                    <span className="truncate text-sm">{a.title}</span>
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
                    <span className="truncate text-sm">{a.title}</span>
                    <time
                      dateTime={new Date(a.updatedAt).toISOString()}
                      className="shrink-0 text-xs tabular-nums text-text-muted"
                    >
                      {new Date(a.updatedAt).toLocaleDateString("pt-BR")}
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
    }
  };

  const aberturaConteudo = (
    <>
      {ligada("hero") && (
        <>
          <h1
            className={`text-[length:var(--text-4xl)] font-semibold leading-[1.1] ${
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
                className="mb-4 overflow-hidden rounded-2xl px-6 py-14 text-center sm:mb-8 sm:px-10 sm:py-16"
                style={faixaCss}
              >
                <div className="mx-auto max-w-2xl">{aberturaConteudo}</div>
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
