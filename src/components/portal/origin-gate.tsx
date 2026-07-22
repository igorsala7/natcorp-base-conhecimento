import type { CSSProperties } from "react";
import { ShieldAlert } from "lucide-react";
import { spaceChrome } from "@/components/portal/shell";

type GateSpace = {
  id: string;
  slug: string;
  name: string;
  theme?: Record<string, unknown> | null;
  access_denied_message: string | null;
};

/**
 * Página bloqueada da restrição por ORIGEM: quem chega sem vir das URLs
 * permitidas vê a MARCA da documentação (mesma faixa de abertura da home —
 * tema do espaço) e a mensagem parametrizada em Configurações. Sem formulário:
 * não há o que digitar; o acesso é pelo sistema de origem.
 */
export function OriginGate({ space }: { space: GateSpace }) {
  const { style, tema, temaClasse } = spaceChrome(space);

  // Mesma lógica de faixa da home (brand/image; "plain" ganha o gradiente da
  // marca — a página bloqueada sem NENHUMA cor pareceria um erro do servidor).
  const heroStyle =
    tema.home.heroStyle === "image" && !tema.brand.coverUrl ? "brand" : tema.home.heroStyle;
  const corDe = tema.brand.color ?? "#511C76";
  const faixaCss: CSSProperties =
    heroStyle === "image"
      ? {
          backgroundColor: "#191036",
          backgroundImage: `linear-gradient(rgba(21,13,38,0.62), rgba(21,13,38,0.62)), url(${tema.brand.coverUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {
          backgroundColor: corDe,
          backgroundImage: `linear-gradient(135deg, ${corDe}, color-mix(in oklab, ${corDe} 45%, #191036))`,
        };

  const mensagem =
    space.access_denied_message?.trim() ||
    "Acesso restrito — esta documentação só pode ser aberta a partir do sistema autorizado.";

  return (
    <div className={`min-h-dvh bg-bg text-text${temaClasse ? ` ${temaClasse}` : ""}`} style={style}>
      <section style={faixaCss} className="px-4 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          {tema.brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tema.brand.logoUrl}
              alt={space.name}
              className="mx-auto h-10 w-auto max-w-[12rem] object-contain"
            />
          ) : (
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/80">
              {space.name}
            </p>
          )}
          <h1 className="mt-6 text-[length:var(--text-3xl)] font-semibold leading-tight">
            {tema.home.title || space.name}
          </h1>
        </div>
      </section>

      <main className="mx-auto max-w-xl px-4 py-12 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40">
          <ShieldAlert className="size-6" />
        </span>
        <p className="mt-5 text-[0.9375rem] leading-relaxed text-text">{mensagem}</p>
        <p className="mt-3 text-sm text-text-muted">
          Abra a documentação pelo link disponível dentro do sistema.
        </p>
      </main>
    </div>
  );
}
