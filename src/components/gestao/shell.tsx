import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import type { ReactNode } from "react";
import { linkGestao, type SessaoGestao } from "@/lib/gestao/sessao";

/**
 * ATENÇÃO: este arquivo é SERVER component e a linha acima puxa `next/headers`
 * por dentro de `sessao.ts`. Nenhum componente com `"use client"` pode importar
 * daqui — o build do Turbopack quebra com "You're importing a module that
 * depends on next/headers", e a mensagem aponta para o Pages Router, que nem
 * existe neste projeto. Client precisa de estado vazio? Use o `EmptyState` de
 * `@/components/ui/empty-state` direto.
 */

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

export type AbaGestao = "consumo" | "creditos" | "acessos" | "prompts" | "conversas";

const ABAS: { id: AbaGestao; rotulo: string; href: string }[] = [
  { id: "consumo", rotulo: "Consumo", href: "/gestao" },
  { id: "creditos", rotulo: "Créditos", href: "/gestao/creditos" },
  { id: "acessos", rotulo: "Acessos", href: "/gestao/acessos" },
  // "Prompts" entre Acessos e Conversas de propósito: as três abas do meio são
  // as de CONFIGURAR o assistente (quanto pode gastar, quem pode o quê, o que
  // já vem escrito), e Conversas é a de OLHAR o que aconteceu.
  { id: "prompts", rotulo: "Prompts", href: "/gestao/prompts" },
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

      {/*
        Faixa de suporte. Existe porque a tela é IDÊNTICA nos dois modos e o
        risco real desta página é agir no cliente errado depois de trocar a base
        num seletor. O aviso fica no topo, fixo, e nomeia o cliente — não é
        decoração, é o que separa "conferi o consumo da natcorp" de "comprei 100
        créditos para a natcorp achando que era a leadec".
      */}
      {sessao.modo === "suporte" ? (
        <div className="border-b border-warning-line bg-warning-soft px-4 py-2">
          <p className="mx-auto max-w-[1400px] text-xs text-warning">
            <strong>Modo suporte Natcorp.</strong> Você está vendo e editando a gestão de{" "}
            <strong>{sessao.identidade.baseNome}</strong> ({sessao.identidade.baseCode}). Alterações
            valem para o cliente e ficam registradas em seu nome.
          </p>
        </div>
      ) : null}

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

/**
 * Estado vazio — todo lugar que lista precisa de um.
 *
 * Delega no `EmptyState` do projeto em vez de repintar a caixa tracejada. O
 * comentário daquele arquivo diz que a caixa "era copiada em cinco telas com
 * medidas diferentes"; aqui ela tinha sido copiada outras quatro vezes, com
 * este componente já existindo ao lado. A API de uma linha fica como estava.
 */
export function Vazio({ children }: { children: ReactNode }) {
  return <EmptyState title={String(children ?? "")} />;
}

/**
 * A FAIXA DE LEITURA — a resposta da tela, em uma frase e um número.
 *
 * ── O defeito que ela corrige ─────────────────────────────────────────
 * As telas da gestão eram uma pilha de caixas brancas de peso igual: filtro,
 * quatro indicadores, aviso, cinco tabelas. Nada dizia por onde começar, e a
 * pergunta que leva alguém a abrir a tela ("sobrou crédito?", "quanto gastei?")
 * ficava para o leitor montar somando cartões. Pior: quando não há plano, três
 * dos quatro indicadores mostram zero ou travessão e o único número grande da
 * tela é o consumo — que sozinho não responde nada.
 *
 * A faixa responde primeiro, em português, e só depois vêm os detalhes. Quem
 * abre para conferir uma coisa lê uma linha e fecha; quem veio investigar
 * continua descendo.
 *
 * ── Por que não é mais um cartão ──────────────────────────────────────
 * Cartão ao lado de cartão vira lista, e lista não tem primeiro item. A faixa
 * ocupa a largura inteira e tem fundo próprio: é a única coisa na página com
 * esse peso, e é isso que a torna o ponto de entrada em vez de mais um item.
 *
 * O público aqui é operador de RH dentro do ERP, não analista. Um número
 * grande sem frase é exatamente o que ele não sabe interpretar.
 */
export function FaixaResumo({
  frase,
  numero,
  unidade,
  tom = "neutro",
  apoio,
}: {
  /** A frase que responde a pergunta da tela. Sempre completa, sempre afirmativa. */
  frase: ReactNode;
  /** O número que a frase destaca. Omita quando a resposta for só texto. */
  numero?: string;
  unidade?: string;
  tom?: "neutro" | "bom" | "atencao" | "ruim";
  /** Pares rótulo/valor de apoio, na mesma linha. Três, no máximo — além disso vira tabela. */
  apoio?: { rotulo: string; valor: string }[];
}) {
  const borda =
    tom === "ruim"
      ? "border-danger-line bg-danger-soft"
      : tom === "atencao"
        ? "border-warning-line bg-warning-soft"
        : "border-border bg-surface-2";
  const tinta =
    tom === "ruim"
      ? "text-danger"
      : tom === "atencao"
        ? "text-warning"
        : tom === "bom"
          ? "text-success"
          : "text-primary";

  return (
    <section className={`mb-6 rounded-lg border px-5 py-4 ${borda}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0 flex-1">
          {numero ? (
            <p className={`text-3xl font-semibold leading-none tabular-nums ${tinta}`}>
              {numero}
              {unidade ? (
                <span className="ml-1.5 text-base font-medium text-text-muted">{unidade}</span>
              ) : null}
            </p>
          ) : null}
          <p className={`max-w-prose text-sm text-text ${numero ? "mt-2" : ""}`}>{frase}</p>
        </div>

        {apoio?.length ? (
          <dl className="flex flex-none flex-wrap gap-x-8 gap-y-2">
            {apoio.map((a) => (
              <div key={a.rotulo}>
                <dt className="text-2xs font-medium uppercase tracking-wide text-text-muted">
                  {a.rotulo}
                </dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-text">{a.valor}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
