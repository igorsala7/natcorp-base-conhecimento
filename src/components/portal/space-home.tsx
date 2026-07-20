import Link from "next/link";
import { Folder, FileText, LifeBuoy, ArrowRight } from "lucide-react";
import { SearchTrigger, AskTrigger } from "@/components/portal/portal-search";
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
export type CategoriaHome = ItemHome & { artigos: number };
export type RecenteHome = ItemHome & { updatedAt: string };

export type DadosHome = {
  spaceName: string;
  categorias: CategoriaHome[];
  artigosSoltos: ItemHome[];
  recentes: RecenteHome[];
  supportUrl?: string;
};

export function SpaceHomeView({ tema, dados }: { tema: TemaResolvido; dados: DadosHome }) {
  const ligada = (k: RegiaoKey) => regiaoAtiva(tema, k);
  const temCategorias = dados.categorias.length > 0 || dados.artigosSoltos.length > 0;

  // A abertura agrupa título/subtítulo, busca e IA. Se as três estiverem
  // desligadas, o bloco inteiro some junto com o espaçamento dele.
  const abertura = ligada("hero") || ligada("search") || ligada("ask");

  const secao = (key: RegiaoKey) => {
    switch (key) {
      case "cover":
        if (!ligada("cover") || !tema.brand.coverUrl) return null;
        return (
          <div
            key={key}
            className="-mt-10 mb-10 overflow-hidden rounded-xl border border-border lg:-mt-14"
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

      case "categories":
        if (!ligada("categories") || !temCategorias) return null;
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
                      <Folder className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium leading-snug">{c.title}</span>
                      <span className="mt-0.5 block text-[0.8125rem] tabular-nums text-text-muted">
                        {c.artigos} artigo(s)
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
                      <FileText className="size-[18px]" />
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

  return (
    <>
      {tema.home.regions.map((r) => {
        // A abertura sai no lugar da PRIMEIRA das três que estiver na lista,
        // para respeitar a posição escolhida na reordenação.
        const primeiraDaAbertura = tema.home.regions.find(
          (x) => x.key === "hero" || x.key === "search" || x.key === "ask",
        );
        if (r.key === primeiraDaAbertura?.key && abertura) {
          return (
            <section key="abertura" className="mx-auto max-w-2xl pb-4 text-center sm:pb-8">
              {ligada("hero") && (
                <>
                  <h1 className="text-[length:var(--text-4xl)] font-semibold leading-[1.1]">
                    {tema.home.title || dados.spaceName}
                  </h1>
                  <p className="mx-auto mt-4 max-w-md text-[1.0625rem] leading-relaxed text-text-muted">
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
                  <AskTrigger />
                </div>
              )}
            </section>
          );
        }
        return secao(r.key);
      })}
    </>
  );
}
