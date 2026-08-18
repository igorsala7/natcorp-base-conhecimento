/**
 * ANATOMIA DE PÁGINA — o que faz as telas parecerem o mesmo produto.
 *
 * Nenhum primitivo de controle resolve "cada tela parece de um produto
 * diferente". Botão, campo e cartão já eram compartilhados; o que cada uma das
 * 31 páginas montava à mão era a MOLDURA — `<h1>` com sua própria classe, seu
 * próprio espaçamento até o conteúdo, sua própria largura máxima (havia seis
 * em uso: 2xl, 3xl, 4xl, 5xl, 6xl e 1400px, escolhidas caso a caso) e sua
 * própria barra de filtros.
 *
 * Disciplina não sustenta isso — a sexta largura entrou sem ninguém decidir.
 * Anatomia obrigatória sustenta: depois disto, parecer o mesmo produto é o que
 * acontece quando ninguém faz nada.
 *
 * ── As três larguras ────────────────────────────────────────────────────────
 * A escolha passa a ser pelo TIPO de conteúdo, não pelo gosto do dia:
 *   · `prose` — texto para ler. Limitado pela medida de linha, não pela tela.
 *   · `page`  — formulário e configuração. Campo largo demais fica difícil de ler
 *               e de mirar.
 *   · `wide`  — tabela e análise, onde cortar coluna é pior que rolar.
 *   · `full`  — canvas de duas colunas (árvore + editor), que gere o próprio espaço.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

const LARGURAS = {
  prose: "max-w-[72ch]",
  page: "max-w-4xl",
  wide: "max-w-7xl",
  full: "max-w-none",
} as const;

export type LarguraPagina = keyof typeof LARGURAS;

export function PageShell({
  titulo,
  descricao,
  acoes,
  abas,
  badge,
  largura = "wide",
  children,
  className,
}: {
  titulo: string;
  /** Uma frase sobre o que se faz aqui. Não repita o título com outras palavras. */
  descricao?: React.ReactNode;
  /** Ações da PÁGINA (criar, exportar). Ação de item pertence ao item. */
  acoes?: React.ReactNode;
  /** Abas de seção. Devem levar o estado na URL — ver `Tabs`. */
  abas?: React.ReactNode;
  badge?: React.ReactNode;
  largura?: LarguraPagina;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      // Endereço da página para os testes, emitido de graça pela moldura. Espalhar
      // data-testid por 500 call sites nunca acontece; por 1 primitivo, acontece.
      data-testid="pagina"
      data-pagina={slugify(titulo)}
      className={cn("mx-auto w-full px-6 py-6", LARGURAS[largura], className)}
    >
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          {/* `basis-64` + `grow`: o bloco de título tem uma largura mínima
              confortável e cresce; abaixo dela, o `flex-wrap` do pai joga as
              ações para a linha de baixo em vez de espremer as duas colunas. */}
          <div className="min-w-0 grow basis-64 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {/* QUEBRA, não corta. `truncate` some com o fim do título e não
                  há tooltip que o devolva — e título cortado numa tela cujo
                  nome carrega o escopo ("Chatbot desta documentação") esconde
                  justamente a parte que distingue uma tela da outra. */}
              <h1 className="text-2xl font-semibold tracking-tight text-text text-balance">{titulo}</h1>
              {badge}
            </div>
            {descricao && <p className="max-w-[68ch] text-pretty text-sm text-text-muted">{descricao}</p>}
          </div>
          {/* Sem `shrink-0`: com ele, uma ação larga (o seletor de documentação
              com nome comprido) empurrava o título até cortá-lo. */}
          {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
        </div>
        {abas && <div className="mt-5">{abas}</div>}
      </header>
      {children}
    </div>
  );
}

/**
 * A APARÊNCIA DO CABEÇALHO DE BLOCO, num lugar só.
 *
 * Exportada pelo mesmo motivo que `controlClass`: o `Section` inteiro nem
 * sempre cabe (quando o bloco já é um `Surface` com o próprio espaçamento), e
 * sem uma classe compartilhada o call site reinventa a formatação. Foi o que
 * aconteceu — 24 cabeçalhos escritos à mão em 14 arquivos, em TRÊS grafias:
 *
 *   `text-sm font-semibold tracking-tight text-text`                → o Section
 *   `text-sm font-semibold text-text`                               → integrações
 *   `text-sm font-semibold uppercase tracking-wider text-text-muted` → aparência
 *
 * Nenhuma estava errada isolada. Juntas, faziam três telas vizinhas parecerem
 * de produtos diferentes — que é exatamente o defeito que o `PageShell`
 * resolveu um nível acima, e que se reproduziu aqui embaixo.
 */
export const sectionTitleClass = "text-sm font-semibold tracking-tight text-text";

/**
 * Bloco dentro da página. O título é `<h2>` de propósito: a hierarquia de
 * cabeçalho é como leitor de tela navega, e páginas que montavam `<h1>` duas
 * vezes ou pulavam de h1 para h3 quebravam isso silenciosamente.
 */
export function Section({
  titulo,
  descricao,
  acoes,
  children,
  className,
}: {
  titulo?: string;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {(titulo || acoes) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="space-y-0.5">
            {titulo && <h2 className={sectionTitleClass}>{titulo}</h2>}
            {descricao && <p className="text-xs text-text-muted">{descricao}</p>}
          </div>
          {acoes && <div className="flex items-center gap-2">{acoes}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Barra de lista: busca à esquerda, filtros no meio, contagem à direita.
 *
 * Existe porque essa barra foi copiada em cinco telas — e as cópias divergiram.
 * Três delas ficaram com `focus:ring-focus-ring`, que NÃO é um utilitário válido
 * (o token se chama `ring`): eram quatro telas com anel de foco morto, e
 * ninguém percebeu porque cada uma parecia razoável isolada.
 *
 * A contagem fica à direita e é `aria-live`: em lista com filtro, saber que
 * sobraram 3 de 96 é a informação, não um detalhe.
 */
export function Toolbar({
  busca,
  filtros,
  total,
  acoes,
  className,
}: {
  busca?: React.ReactNode;
  filtros?: React.ReactNode;
  /** Ex.: "12 de 96". Só o texto — o rótulo vem daqui. */
  total?: string;
  acoes?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {busca && <div className="min-w-56 flex-1">{busca}</div>}
      {filtros && <div className="flex flex-wrap items-center gap-2">{filtros}</div>}
      {total && (
        <span aria-live="polite" className="ml-auto shrink-0 text-xs tabular-nums text-text-muted">
          {total}
        </span>
      )}
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </div>
  );
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
