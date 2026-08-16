"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Menu, X } from "lucide-react";
import { MAPA, rotaAtiva, type Rota } from "@/lib/admin/mapa-rotas";
import { Button } from "@/components/ui/button";
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
  const [aberturaMobile, setAberturaMobile] = useState(false);
  const ativa = rotaAtiva(pathname);
  const pode = new Set(permissoes);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecolhida(localStorage.getItem(KEY) === "1");
  }, []);

  // Navegar fecha a gaveta do celular — senão ela cobre a tela recém-aberta.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setAberturaMobile(false), [pathname]);

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

  const conteudo = (
    <nav aria-label="Navegação do admin" className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
      {secoes.map((s, i) => (
        <div key={s.titulo ?? `topo-${i}`} className={i > 0 ? "mt-5" : undefined}>
          {s.titulo &&
            (recolhida ? (
              // Recolhida, o rótulo do grupo vira um traço: some o texto, fica
              // a separação, que é o que o olho usa para agrupar.
              <div className="mx-2 mb-2 border-t border-border" role="presentation" />
            ) : (
              <p className="mb-1.5 px-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">{s.titulo}</p>
            ))}
          {s.titulo === "Documentação" && seletor && !recolhida && <div className="mb-1.5 px-1">{seletor}</div>}
          <ul className="space-y-0.5">
            {s.rotas.map((r) => (
              <li key={r.href}>
                <ItemMenu rota={r} ativa={ativa?.href === r.href} recolhida={recolhida} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={alternar}
        aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
        className="mt-auto justify-start gap-2.5"
      >
        {recolhida ? <PanelLeftOpen /> : <PanelLeftClose />}
        {!recolhida && "Recolher"}
      </Button>
    </nav>
  );

  return (
    <>
      {/* Celular: o admin simplesmente NÃO tinha menu abaixo de 768px — a barra
          era `hidden md:block` e a topbar não tinha hambúrguer. */}
      <Button
        variant="secondary"
        size="icon"
        onClick={() => setAberturaMobile(true)}
        aria-label="Abrir menu"
        aria-expanded={aberturaMobile}
        className="fixed left-3 top-3 z-40 shadow-1 md:hidden"
      >
        <Menu />
      </Button>

      {aberturaMobile && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setAberturaMobile(false)}
            role="presentation"
          />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-border bg-surface">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAberturaMobile(false)}
              aria-label="Fechar menu"
              className="absolute right-2 top-2.5"
            >
              <X />
            </Button>
            {conteudo}
          </div>
        </div>
      )}

      <aside
        data-testid="menu-lateral"
        className={cn(
          "hidden shrink-0 border-r border-border bg-surface transition-[width] duration-200 md:block",
          recolhida ? "w-16" : "w-64",
        )}
      >
        {conteudo}
      </aside>
    </>
  );
}

function ItemMenu({ rota, ativa, recolhida }: { rota: Rota; ativa: boolean; recolhida: boolean }) {
  const Icone = rota.icone;
  return (
    <Link
      href={rota.href}
      // `aria-current` é o que um leitor de tela usa para dizer "você está aqui".
      // Cor sozinha não comunica isso — daí a barra à esquerda junto.
      aria-current={ativa ? "page" : undefined}
      title={recolhida ? rota.rotulo : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150",
        ativa
          ? "bg-surface-2 font-semibold text-primary before:absolute before:inset-y-1.5 before:-left-1 before:w-0.5 before:rounded-full before:bg-primary"
          : "text-text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      {Icone && <Icone className="size-4 shrink-0" aria-hidden="true" />}
      {!recolhida && <span className="truncate">{rota.rotulo}</span>}
    </Link>
  );
}
