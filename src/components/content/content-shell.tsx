"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useFocoPreso } from "@/components/ui/use-foco-preso";
import { cn } from "@/lib/utils";

const KEY = "kb.treeWidth";
const KEY_COLAPSO = "kb.treeCollapsed"; // sufixado por contexto (editor/nav)
const MIN = 200;
const MAX = 680;
const DEFAULT = 288; // = w-72

/**
 * Layout de duas colunas: navegação (esquerda) + área de edição (direita).
 * A coluna da árvore é redimensionável (largura persistida) e RECOLHÍVEL —
 * na página do EDITOR ela começa recolhida (padrão da referência: o editor
 * ocupa a tela; a árvore expande sob demanda pelo trilho).
 *
 * ── Abaixo de 768px não existem duas colunas ────────────────────────────────
 * Um `flex` com um aside de 288px numa tela de 375px deixa 87px para o editor.
 * Duas colunas não é um layout que "aperta" no celular: é um layout que deixa
 * de existir, e insistir nele entrega as duas metades inutilizáveis em vez de
 * uma inteira.
 *
 * No celular a árvore vira GAVETA e o editor fica com a largura toda. O gatilho
 * é o MESMO trilho fino que o modo recolhido já usa no desktop — quem aprendeu
 * o gesto numa largura o reconhece na outra, e não há um segundo controle para
 * explicar.
 *
 * ── Por que NÃO é o `Sheet`, apesar de ser o primitivo certo ────────────────
 * A primeira versão passava `{aside}` para dentro de um `<Sheet>`. Parecia
 * óbvio — e mantinha DUAS instâncias da árvore montadas ao mesmo tempo: a do
 * `Sheet` e a da coluna do desktop, que `hidden md:flex` esconde por CSS mas
 * não desmonta. A segunda instância derrubava a página:
 *
 *     cannot add `postgres_changes` callbacks for realtime:bulk-jobs
 *     after `subscribe()`
 *
 * O `Tree` assina um canal Realtime de nome FIXO (`bulk-jobs`); o cliente do
 * Supabase devolve o mesmo objeto de canal para o mesmo nome, e o segundo
 * `.on()` depois do `.subscribe()` lança. Só apareceu ao CLICAR — build,
 * tipos, lint e 2.040 testes passaram com o defeito dentro.
 *
 * Então a gaveta é o PRÓPRIO `<aside>` promovido a sobreposição: um elemento
 * só, uma árvore só. O que importava do `Sheet` — foco preso, Escape, retorno
 * do foco ao gatilho — vem do `useFocoPreso`, que é o mesmo hook que ele usa.
 * Reutilizar o primitivo é regra, não dogma: aqui ele custaria montar duas
 * vezes um componente que não tolera ser montado duas vezes.
 */
export function ContentShell({
  aside,
  children,
  titulo,
  defaultCollapsed = false,
}: {
  aside: ReactNode;
  children: ReactNode;
  /**
   * O `<h1>` da página, invisível.
   *
   * As telas de tela cheia não passam pelo `PageShell`, então não tinham
   * cabeçalho nenhum — e uma página sem `<h1>` deixa quem usa leitor de tela
   * sem a primeira resposta que ele procura ("onde eu caí?"). O atalho de
   * navegar por títulos simplesmente não encontrava nada.
   *
   * `sr-only` e não visível: a resposta visual aqui é a própria árvore ao lado,
   * e um título grande roubaria a altura que o editor usa.
   */
  titulo: string;
  /** Começa com a árvore recolhida num trilho fino (página do editor). */
  defaultCollapsed?: boolean;
}) {
  const [width, setWidth] = useState(DEFAULT);
  const [dragging, setDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  /** Gaveta do celular. Independente de `collapsed`, que é estado do desktop. */
  const [gaveta, setGaveta] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  // Escape, foco preso e retorno do foco ao trilho — o mesmo hook do `Sheet`.
  useFocoPreso(gaveta, asideRef, () => setGaveta(false));
  const widthRef = useRef(DEFAULT);
  const chaveColapso = `${KEY_COLAPSO}.${defaultCollapsed ? "editor" : "nav"}`;

  useEffect(() => {
    const saved = Number(localStorage.getItem(KEY));
    if (saved >= MIN && saved <= MAX) {
      widthRef.current = saved;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidth(saved);
    }
    // A escolha manual (expandir/recolher) vence o default da página.
    const colapso = localStorage.getItem(chaveColapso);
    if (colapso === "1" || colapso === "0") {
      setCollapsed(colapso === "1");
    }
  }, [chaveColapso]);

  // O editor pede para recolher a árvore ao selecionar um bloco (mais espaço
  // para editar). Evento global — só o editor o dispara.
  useEffect(() => {
    function recolher() {
      setCollapsed(true);
      localStorage.setItem(chaveColapso, "1");
    }
    window.addEventListener("kb:collapse-tree", recolher);
    return () => window.removeEventListener("kb:collapse-tree", recolher);
  }, [chaveColapso]);

  function alternar() {
    setCollapsed((c) => {
      localStorage.setItem(chaveColapso, c ? "0" : "1");
      return !c;
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    setDragging(true);
    const onMove = (ev: PointerEvent) => {
      const w = Math.min(MAX, Math.max(MIN, startW + ev.clientX - startX));
      widthRef.current = w;
      setWidth(w);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragging(false);
      localStorage.setItem(KEY, String(widthRef.current));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function reset() {
    widthRef.current = DEFAULT;
    setWidth(DEFAULT);
    localStorage.setItem(KEY, String(DEFAULT));
  }

  /**
   * O trilho fino. Um só componente para os dois papéis, porque é o mesmo
   * gesto: no desktop ele EXPANDE a coluna, no celular ele ABRE a gaveta.
   */
  const trilho = (aoClicar: () => void, soNoCelular: boolean) => (
    <aside
      aria-label="Árvore de conteúdo (recolhida)"
      className={cn(
        "mr-3 w-11 shrink-0 flex-col items-center rounded-lg border border-border bg-surface py-2",
        soNoCelular ? "flex md:hidden" : "hidden md:flex",
      )}
    >
      <button
        type="button"
        onClick={aoClicar}
        title="Mostrar a árvore de conteúdo"
        aria-label="Mostrar a árvore de conteúdo"
        aria-expanded={false}
        className="flex size-8 items-center justify-center rounded-lg border border-brand-purple-200 bg-brand-purple-50 text-primary transition-colors hover:bg-brand-purple-100 dark:border-brand-purple-900 dark:bg-brand-purple-950/50 dark:hover:bg-brand-purple-900/60"
      >
        <PanelLeftOpen className="size-4" />
      </button>
    </aside>
  );

  /** Escurece o fundo e fecha ao toque. Só existe com a gaveta aberta. */
  const scrim = gaveta ? (
    <div
      className="fixed inset-0 z-40 bg-black/50 md:hidden"
      onClick={() => setGaveta(false)}
      role="presentation"
    />
  ) : null;

  /**
   * A COLUNA — e, no celular com `gaveta`, a própria gaveta.
   *
   * `style` sai quando ela é gaveta: largura inline venceria a classe. E
   * `gaveta` só chega a ser `true` abaixo de 768px, porque o trilho que a abre
   * é `md:hidden`; os resets `md:*` cobrem quem redimensiona a janela com ela
   * aberta, sem precisar de JavaScript para isso.
   */
  const coluna = (
    <aside
      ref={asideRef}
      style={gaveta ? undefined : { width }}
      role={gaveta ? "dialog" : undefined}
      aria-modal={gaveta || undefined}
      // Rotulado SEMPRE: como gaveta é o nome do diálogo, como coluna é o nome
      // do landmark que a distingue do menu principal.
      aria-label="Árvore de conteúdo"
      className={cn(
        "shrink-0 flex-col overflow-auto border border-border bg-surface p-3",
        "hidden rounded-lg md:flex",
        gaveta &&
          "fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-sm rounded-none shadow-3 md:static md:w-auto md:rounded-lg md:shadow-none",
      )}
    >
      <div className="mb-1 flex justify-end gap-1.5">
        {/* Fechar: só na gaveta. No desktop quem faz esse papel é "Recolher". */}
        {gaveta && (
          <button
            type="button"
            onClick={() => setGaveta(false)}
            aria-label="Fechar a árvore"
            className="flex size-7 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:bg-surface-2 hover:text-text md:hidden"
          >
            <X className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={alternar}
          title="Recolher a árvore (mais espaço para editar)"
          aria-label="Recolher a árvore"
          aria-expanded
          className="hidden items-center gap-1.5 rounded-lg border border-brand-purple-200 bg-brand-purple-50 px-2 py-1 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-brand-purple-100 dark:border-brand-purple-900 dark:bg-brand-purple-950/50 dark:hover:bg-brand-purple-900/60 md:flex"
        >
          <PanelLeftClose className="size-4" />
          Recolher
        </button>
      </div>
      {aside}
    </aside>
  );

  if (collapsed) {
    return (
      <div data-fullbleed className="flex h-full">
        <h1 className="sr-only">{titulo}</h1>
        {scrim}
        {/* Recolhida no desktop, a coluna some — mas a gaveta do celular
            continua precisando dela montada, então ela só é renderizada
            quando a gaveta está aberta. Nunca duas ao mesmo tempo. */}
        {gaveta && coluna}
        {trilho(alternar, false)}
        {trilho(() => setGaveta(true), true)}
        <section className="min-w-0 flex-1 overflow-auto">{children}</section>
      </div>
    );
  }

  return (
    <div data-fullbleed className="flex h-full">
      <h1 className="sr-only">{titulo}</h1>
      {scrim}
      {/* No celular a coluna some por CSS e o trilho a substitui. */}
      {trilho(() => setGaveta(true), true)}
      {coluna}

      {/* Divisor arrastável — só onde há duas colunas para dividir. */}
      <div
        onPointerDown={onPointerDown}
        onDoubleClick={reset}
        role="separator"
        aria-orientation="vertical"
        title="Arraste para redimensionar (duplo clique para restaurar)"
        className={cn(
          "relative mx-1 hidden w-1.5 shrink-0 cursor-col-resize rounded-full transition-colors md:block",
          dragging ? "bg-primary" : "bg-transparent hover:bg-brand-purple-200",
        )}
      >
        {/* alvo de clique mais largo que a barra visível */}
        <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
      </div>

      <section className="min-w-0 flex-1 overflow-auto">{children}</section>
    </div>
  );
}
