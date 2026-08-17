"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Menu } from "lucide-react";
import { MAPA, rotaAtiva, type Rota } from "@/lib/admin/mapa-rotas";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * A BARRA — nove itens em três blocos, lidos do mapa de rotas.
 *
 * Eram 18 itens planos agrupados por ferramenta, numa barra RECOLHIDA por
 * padrão que abria no hover. O hover-para-abrir parecia economia de espaço e
 * era o contrário: cobrava um gesto em toda navegação, sumia sozinho depois de
 * um segundo, e impedia ler de relance qual documentação estava selecionada.
 * Isso é parte do "não acho nada" — não dá para procurar no que não está lá.
 *
 * Agora é EXPANDIDA por padrão e recolher é opt-in, persistido. Com nove itens
 * cabe tudo à vista, que é o ponto: para quem vive na ferramenta, o menu deve
 * ser um mapa, não uma gaveta.
 *
 * ── O que a barra não faz ───────────────────────────────────────────────────
 * Ela não decide a documentação atual. Recebe o seletor pronto como slot e o
 * exibe. Quem resolve o espaço é a PÁGINA (via `?space=` → cookie → primeiro da
 * lista), e o cookie é gravado a partir do que ela resolveu. Se o chrome virasse
 * o autor dessa escolha, abrir por link um artigo de outra documentação deixaria
 * a barra dizendo "NATCORP" enquanto o editor mostra outra coisa.
 */

/** `"1"` = recolhida. A ausência significa expandida — o novo padrão. */
const KEY = "kb.sidebarRecolhida";

/**
 * A GAVETA DO CELULAR mora aqui, mas o BOTÃO que a abre mora na topbar.
 *
 * Antes o botão era `fixed left-3 top-3` — e a topbar tem `h-14`, então ele
 * flutuava POR CIMA do breadcrumb em toda tela abaixo de 768px: o primeiro
 * elemento que responde "onde estou" ficava coberto pelo controle que abre o
 * menu. Posição fixa resolve o problema de quem a escreve e cria um para quem
 * usa, porque não participa do layout que precisa lhe dar espaço.
 *
 * Com o estado num contexto, o botão volta ao fluxo normal da topbar (que já
 * sabe alinhar seus filhos) e a gaveta continua sendo responsabilidade da
 * barra. Duas peças, um estado, nenhuma sobreposição.
 */
const MenuMobileCtx = createContext<{
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
} | null>(null);

export function MenuMobileProvider({ children }: { children: ReactNode }) {
  /**
   * O estado guarda EM QUE ROTA a gaveta foi aberta, não um booleano.
   *
   * "Navegar fecha a gaveta" é a regra — senão ela cobre a tela recém-aberta.
   * Escrita como efeito (`useEffect(() => setAberto(false), [pathname])`), ela
   * fecha um render TARDE: existe um quadro em que a rota nova já renderizou
   * com a gaveta ainda por cima. Derivando, a gaveta pertence à rota em que foi
   * aberta e deixa de estar aberta no instante em que a rota muda — sem efeito,
   * sem quadro intermediário.
   */
  const [abertaEm, setAbertaEm] = useState<string | null>(null);
  const pathname = usePathname();
  const aberto = abertaEm === pathname;

  return (
    <MenuMobileCtx.Provider
      value={{ aberto, abrir: () => setAbertaEm(pathname), fechar: () => setAbertaEm(null) }}
    >
      {children}
    </MenuMobileCtx.Provider>
  );
}

/** O gatilho da gaveta. Só existe abaixo de `md` — acima, a barra está sempre à vista. */
export function BotaoMenuMobile() {
  const ctx = useContext(MenuMobileCtx);
  if (!ctx) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={ctx.abrir}
      aria-label="Abrir menu de navegação"
      aria-expanded={ctx.aberto}
      className="-ml-1 shrink-0 md:hidden"
    >
      <Menu />
    </Button>
  );
}

export function Sidebar({
  permissoes,
  seletor,
}: {
  /** Conjunto vindo de `permissoesDo()`. Item que a pessoa nunca usa não aparece. */
  permissoes: string[];
  /** O `<SpaceSwitcher>` já montado no servidor. Encabeça a seção DOCUMENTAÇÃO. */
  seletor?: ReactNode;
}) {
  const pathname = usePathname();
  const [recolhida, setRecolhida] = useState(false);
  const mobile = useContext(MenuMobileCtx);
  const ativa = rotaAtiva(pathname);
  const pode = new Set(permissoes);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecolhida(localStorage.getItem(KEY) === "1");
  }, []);

  function alternar() {
    setRecolhida((r) => {
      localStorage.setItem(KEY, r ? "0" : "1");
      return !r;
    });
  }

  /**
   * ESCONDER, não desabilitar.
   *
   * Um Leitor via 18 itens dos quais 11 levavam a "Sem permissão." Desabilitar
   * seria o pior dos dois mundos: o menu PARECE grande e É inútil. Para uso
   * interno e denso, tudo que aparece deve ser usável.
   *
   * O custo, que é real: ninguém pede o que não vê. A compensação é a tela de
   * recusa, que nomeia a permissão e o papel — links continuam sendo colados em
   * conversa, e é ela que impede o link recebido de virar mistério.
   */
  const secoes = MAPA.map((s) => ({ ...s, rotas: s.rotas.filter((r) => pode.has(r.permissao)) })).filter(
    (s) => s.rotas.length > 0,
  );

  /**
   * `compacta` é o estado de RECOLHIDA, e ele só existe no desktop: dentro da
   * gaveta do celular a barra ocupa a tela inteira, então recolher não
   * economiza nada e o botão "Recolher" só confundiria.
   */
  const conteudo = (compacta: boolean) => (
    <nav aria-label="Navegação do admin" className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
      {secoes.map((s, i) => (
        <div key={s.titulo ?? `topo-${i}`} className={i > 0 ? "mt-5" : undefined}>
          {s.titulo &&
            (compacta ? (
              // Recolhida, o rótulo do grupo vira um traço: some o texto, fica
              // a separação, que é o que o olho usa para agrupar.
              <div className="mx-2 mb-2 border-t border-border" role="presentation" />
            ) : (
              <p className="mb-1.5 px-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">{s.titulo}</p>
            ))}
          {s.titulo === "Documentação" && seletor && !compacta && <div className="mb-1.5 px-1">{seletor}</div>}
          <ul className="space-y-0.5">
            {s.rotas.map((r) => (
              <li key={r.href}>
                <ItemMenu rota={r} ativa={ativa?.href === r.href} recolhida={compacta} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Só no desktop: ver o comentário de `compacta`. */}
      <Button
        variant="ghost"
        size="sm"
        onClick={alternar}
        aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
        className="mt-auto hidden justify-start gap-2.5 md:inline-flex"
      >
        {recolhida ? <PanelLeftOpen /> : <PanelLeftClose />}
        {!recolhida && "Recolher"}
      </Button>
    </nav>
  );

  return (
    <>
      {/**
       * A gaveta do celular era uma `<div>` com scrim clicável: sem
       * `role="dialog"`, sem `aria-modal`, sem Escape e sem foco preso. Quem a
       * abria pelo teclado tabulava direto para o conteúdo ATRÁS dela — numa
       * página que visualmente estava coberta — e não tinha como fechar.
       *
       * O `Sheet` já resolvia tudo isso e já era testado (`useFocoPreso`). Não
       * havia razão para uma segunda implementação; havia só o fato de que
       * escrever a `<div>` parecia mais curto do que procurar o primitivo.
       */}
      <Sheet
        open={!!mobile?.aberto}
        onClose={() => mobile?.fechar()}
        title="Navegação"
        side="left"
        size="sm"
        bodyClassName="p-0"
        className="md:hidden"
      >
        {conteudo(false)}
      </Sheet>

      <aside
        data-testid="menu-lateral"
        className={cn(
          "hidden shrink-0 border-r border-border bg-surface transition-[width] duration-200 md:block",
          recolhida ? "w-16" : "w-64",
        )}
      >
        {conteudo(recolhida)}
      </aside>
    </>
  );
}

/**
 * RECOLHIDA, O NOME NÃO PODE DEPENDER DO `title`.
 *
 * O `title` nativo não aparece no foco por teclado, não existe em toque e leva
 * cerca de um segundo de hover para surgir. Com a barra recolhida os nove itens
 * viram ícones nus, e ele era o ÚNICO rótulo — o menu inteiro ficava sem nomes
 * para quem navega por teclado.
 *
 * A correção é dupla porque os dois públicos são diferentes: `aria-label` dá o
 * nome a quem usa leitor de tela (sempre, sem hover), e o balão em CSS dá o
 * nome a quem enxerga — disparado por `focus-visible` ALÉM de `hover`, que é
 * exatamente o que o `title` não faz.
 */
function ItemMenu({ rota, ativa, recolhida }: { rota: Rota; ativa: boolean; recolhida: boolean }) {
  const Icone = rota.icone;
  return (
    <Link
      href={rota.href}
      // `aria-current` é o que um leitor de tela usa para dizer "você está aqui".
      // Cor sozinha não comunica isso — daí a barra à esquerda junto.
      aria-current={ativa ? "page" : undefined}
      aria-label={recolhida ? rota.rotulo : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150",
        ativa
          ? "bg-surface-2 font-semibold text-primary before:absolute before:inset-y-1.5 before:-left-1 before:w-0.5 before:rounded-full before:bg-primary"
          : "text-text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      {recolhida && (
        <span
          // `aria-hidden`: quem usa leitor de tela já recebeu o nome pelo
          // `aria-label` do link. Anunciar de novo seria eco.
          aria-hidden="true"
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-text opacity-0 shadow-2 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {rota.rotulo}
        </span>
      )}
      {Icone && <Icone className="size-4 shrink-0" aria-hidden="true" />}
      {!recolhida && <span className="truncate">{rota.rotulo}</span>}
    </Link>
  );
}
