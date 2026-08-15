/**
 * ESQUELETO — a forma do que está vindo.
 *
 * O produto tinha três respostas concorrentes para "está carregando": um overlay
 * bloqueante de tela cheia, 33 `animate-spin` montados à mão e 34 strings
 * "Carregando" soltas. Nenhuma delas diz o que vem depois, e o overlay ainda
 * rouba a tela inteira por causa de uma lista que vai preencher meio painel.
 *
 * A doutrina, para não nascer um quarto mecanismo:
 *
 *   · rota → rota .................. barra de topo + `loading.tsx` com esqueleto
 *   · primeira carga de região ..... `Skeleton` com a FORMA real do conteúdo
 *   · recarga de dado já visível ... mantém o conteúdo + `aria-busy` + opacidade
 *   · ação presa a um controle ..... `<Button loading>`
 *   · lote longo ou perigoso ....... `LoaderProvider`, nomeando a operação
 *   · job em background ............ passos + log carimbado
 *
 * O caso mais fácil de errar é o terceiro: usar esqueleto numa RECARGA faz a
 * tela piscar do conteúdo para o cinza e voltar. Piscar é pior que esperar.
 */
import { cn } from "@/lib/utils";

/**
 * A pele. Altura e largura vêm do `className` — o esqueleto não adivinha a forma
 * do conteúdo, quem o usa é que sabe.
 *
 * `aria-hidden` de propósito: quem anuncia a espera é o `aria-busy` da região.
 * Quarenta caixas cinzas descrevendo a si mesmas é ruído para leitor de tela.
 */
export function Skeleton({
  className,
  variant = "block",
}: {
  className?: string;
  variant?: "block" | "text" | "circle";
}) {
  return (
    <div
      aria-hidden="true"
      data-testid="esqueleto"
      className={cn(
        "animate-pulse bg-surface-2 motion-reduce:animate-none",
        variant === "circle" ? "rounded-full" : variant === "text" ? "h-4 rounded" : "rounded-md",
        className,
      )}
    />
  );
}

/**
 * Parágrafo fantasma. A última linha sai curta porque texto real termina no meio
 * da linha — bloco retangular perfeito não parece texto, parece caixa.
 */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} variant="text" className={i === lines - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}

/** Tabela fantasma: cabeçalho mais forte, linhas com larguras irregulares. */
export function SkeletonTable({ rows = 8, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  const largura = ["w-1/3", "w-1/2", "w-2/3", "w-1/4"];
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-4 border-b border-border pb-3">
        {Array.from({ length: cols }, (_, c) => (
          <Skeleton key={c} variant="text" className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="flex-1">
              <Skeleton variant="text" className={largura[(r + c) % largura.length]} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Grade de cartões — o formato do hub de documentações e da tela de pessoas. */
export function SkeletonCards({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-border p-5">
          <Skeleton variant="text" className="h-5 w-1/2" />
          <SkeletonText lines={2} className="mt-4" />
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Árvore/lista lateral: indentação alternada para não virar escada regular. */
export function SkeletonList({ rows = 10, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 12}px` }}>
          <Skeleton variant="circle" className="size-3.5 shrink-0" />
          <Skeleton variant="text" className={i % 3 === 0 ? "w-2/3" : i % 3 === 1 ? "w-1/2" : "w-3/4"} />
        </div>
      ))}
    </div>
  );
}
