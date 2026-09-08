import Link from "next/link";
import type { ReactNode } from "react";
import { linkGestao, type SessaoGestao } from "@/lib/gestao/sessao";

/**
 * Moldura da área de gestão, embutida em iFrame numa página do APEX.
 *
 * ── Por que o menu vive aqui e não no `layout.tsx` ─────────────────────
 * Os links precisam carregar `key` e `kbt` para não perder a sessão ao navegar,
 * e um Server Component de layout não recebe `searchParams`. Passar a sessão
 * explicitamente é mais chato de escrever e impossível de esquecer — se faltar,
 * o TypeScript recusa.
 *
 * ── Sem cabeçalho de marca ────────────────────────────────────────────
 * A página tem de parecer parte do APEX. Um header grande com logo denunciaria
 * o iFrame e roubaria altura de uma tela que já é embutida. O que sobra é o
 * mínimo: onde estou, de que base, e as quatro páginas irmãs.
 */

export type AbaGestao = "consumo" | "creditos" | "acessos" | "conversas";

const ABAS: { id: AbaGestao; rotulo: string; href: string }[] = [
  { id: "consumo", rotulo: "Consumo", href: "/gestao" },
  { id: "creditos", rotulo: "Créditos", href: "/gestao/creditos" },
  { id: "acessos", rotulo: "Acessos", href: "/gestao/acessos" },
  { id: "conversas", rotulo: "Conversas", href: "/gestao/conversas" },
];

export function ShellGestao({
  sessao,
  atual,
  titulo,
  descricao,
  acoes,
  children,
}: {
  sessao: SessaoGestao;
  atual: AbaGestao;
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <nav
        aria-label="Gestão do assistente"
        className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-1 gap-y-2 px-4 py-2">
          <ul className="flex flex-1 flex-wrap items-center gap-1">
            {ABAS.map((aba) => {
              const ativa = aba.id === atual;
              return (
                <li key={aba.id}>
                  <Link
                    href={linkGestao(sessao, aba.href)}
                    aria-current={ativa ? "page" : undefined}
                    className={[
                      "inline-flex items-center rounded-md px-3 py-1.5 text-ui font-medium transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                      ativa
                        ? "bg-primary text-primary-fg"
                        : "text-text-muted hover:bg-surface-2 hover:text-text",
                    ].join(" ")}
                  >
                    {aba.rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-text-muted">
            <span className="font-medium text-text">{sessao.identidade.baseNome}</span>
            {sessao.identidade.usuario ? ` · ${sessao.identidade.usuario}` : ""}
            {sessao.identidade.perfil ? ` · ${sessao.identidade.perfil}` : ""}
          </p>
        </div>
      </nav>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
            {descricao ? (
              <p className="mt-1 max-w-prose text-sm text-text-muted">{descricao}</p>
            ) : null}
          </div>
          {acoes ? <div className="flex items-center gap-2">{acoes}</div> : null}
        </header>
        {children}
      </main>
    </div>
  );
}

/**
 * Tela de recusa. Não é um 500 nem um 404 genérico: o texto diz o que aconteceu
 * e o que fazer, porque quem está do outro lado é um usuário do ERP que não tem
 * como investigar nada.
 */
export function RecusaGestao({ mensagem }: { mensagem: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6 text-text">
      <div className="max-w-md rounded-lg border border-warning-line bg-warning-soft p-6 text-center">
        <h1 className="text-lg font-semibold text-warning">Não foi possível abrir a gestão</h1>
        <p className="mt-2 text-sm text-text">{mensagem}</p>
      </div>
    </div>
  );
}

/** Bloco de conteúdo com título — o "card" da área, sem sombra. */
export function Bloco({
  titulo,
  descricao,
  acoes,
  children,
}: {
  titulo?: string;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-6 rounded-lg border border-border bg-surface">
      {titulo ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{titulo}</h2>
            {descricao ? <p className="mt-0.5 text-xs text-text-muted">{descricao}</p> : null}
          </div>
          {acoes}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Número grande com rótulo. `tom` só muda a tinta do valor. */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  tom = "neutro",
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: "neutro" | "bom" | "atencao" | "ruim";
}) {
  const tinta =
    tom === "bom"
      ? "text-success"
      : tom === "atencao"
        ? "text-warning"
        : tom === "ruim"
          ? "text-danger"
          : "text-text";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{rotulo}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tinta}`}>{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-text-muted">{detalhe}</p> : null}
    </div>
  );
}

/** Estado vazio — todo lugar que lista precisa de um. */
export function Vazio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
      {children}
    </p>
  );
}
