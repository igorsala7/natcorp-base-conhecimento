"use client";

/**
 * ABAS COM ENDEREÇO.
 *
 * O produto tinha três jeitos de fazer aba — `Segmented`, `border-b-2`
 * artesanal e `<Link>` — e quatro telas guardavam a escolha em `useState` puro.
 * Consequências que pareciam pequenas e não eram:
 *
 *   · F5 nas Integrações sempre voltava para a primeira das 9 abas;
 *   · o Voltar do navegador não desfazia a troca de aba;
 *   · "vá em Assistente › Ontologia" era INLINKÁVEL — não havia URL para ela;
 *   · e por isso o Cmd+K não conseguia mirar aba nenhuma, só páginas.
 *
 * O terceiro item é o que importa para o redesenho: se o menu encolhe e a
 * paleta passa a carregar a navegação, aba precisa ser destino de primeira
 * classe. Estado na URL não é polimento aqui, é requisito da arquitetura.
 *
 * ── Tabs × Segmented ────────────────────────────────────────────────────────
 * `Tabs` troca a REGIÃO de conteúdo (é navegação, merece URL).
 * `Segmented` troca um VALOR dentro do conteúdo — filtro de status, período.
 * Sem essa distinção escrita, os dois viram sinônimos e a URL enche de estado
 * que não é navegação.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Aba = {
  key: string;
  label: React.ReactNode;
  /**
   * Destino quando a aba é OUTRA ROTA — ex.: Conexões › Conversas.
   *
   * Sem `href`, a aba é uma região desta mesma tela e a troca acontece no
   * cliente, sem ir ao servidor. Com `href`, ela é um `<Link>`: navegação de
   * verdade, que abre em nova aba e entra no histórico.
   *
   * As duas formas na MESMA barra existem porque a alternativa é pior. Servir
   * duas barras empilhadas foi o defeito que a tela de Conversas tinha, e
   * converter as abas locais em link custaria um round-trip por clique na tela
   * mais pesada do admin (Conexões faz mais de vinte consultas para montar).
   *
   * Uma aba com `href` NUNCA é a aba selecionada desta barra: ela não mora no
   * `?aba=`, e quem a abre sai desta tela. Ver `atual`.
   */
  href?: string;
  icon?: LucideIcon;
  /** Contagem ou aviso. Use com parcimônia: badge em tudo não destaca nada. */
  badge?: React.ReactNode;
  disabled?: boolean;
  /**
   * Família da aba. Abas com famílias diferentes ganham um separador entre si.
   *
   * Existe por causa das Conexões: nove abas irmãs no mesmo nível, sem nenhuma
   * hierarquia visível — o olho não consegue segurar nove escolhas paralelas, e
   * ali havia três famílias óbvias (quem é o cliente, o que o bot sabe fazer, o
   * que aconteceu).
   *
   * A saída ÓBVIA seria um segundo nível de abas. Seria errado: "seção dentro
   * de seção" é exatamente a queixa que esta reforma veio resolver, e enterrar
   * "Execuções" — a tela onde se passa o dia depurando — atrás de mais um
   * clique piora justamente o caminho mais quente.
   *
   * O separador dá a hierarquia SEM a profundidade. O agrupamento fica legível,
   * e nenhum destino fica mais longe do que já estava.
   */
  grupo?: string;
};

/** A aba troca um painel DESTA tela (e não navega para outra rota)? */
const daTela = (t: Aba) => !t.href;

/** A primeira aba desta tela — a que não suja a URL. */
function primeiraAba(tabs: Aba[]): string {
  return tabs.find((t) => !t.disabled && daTela(t))?.key ?? tabs[0]?.key ?? "";
}

/**
 * Qual aba o parâmetro da URL seleciona.
 *
 * PURA, e chamada pelo `Tabs` e pelo `useAbaAtual`: são duas leituras do mesmo
 * parâmetro, e barra acesa numa aba com o painel de outra é o defeito que uma
 * segunda cópia da regra produz.
 *
 * Valor desconhecido — ou apontando para aba de OUTRA rota, que não tem painel
 * aqui — cai na primeira, em vez de deixar a tela em branco.
 */
export function resolverAba(tabs: Aba[], naUrl: string | null): string {
  const escolhida = tabs.find((t) => t.key === naUrl);
  return escolhida && daTela(escolhida) ? escolhida.key : primeiraAba(tabs);
}

export function Tabs({
  tabs,
  param = "aba",
  value,
  onChange,
  className,
  comPainel = false,
  "aria-label": ariaLabel = "Seções da página",
}: {
  tabs: Aba[];
  /**
   * `true` só quando o conteúdo está dentro de um `<TabPanel>`. Liga o
   * `aria-controls` — que sem o painel apontaria para o vazio. Ver o comentário
   * no atributo.
   */
  comPainel?: boolean;
  /**
   * Nome do parâmetro na URL. Com ele, o componente lê e escreve sozinho.
   * `null` = controlado por `value`/`onChange` — só para abas DENTRO de um
   * modal, onde não há URL para carregar o estado.
   */
  param?: string | null;
  value?: string;
  onChange?: (k: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const refs = React.useRef<(HTMLElement | null)[]>([]);

  const primeira = primeiraAba(tabs);
  const atual = param ? resolverAba(tabs, search.get(param)) : (value ?? primeira);

  function ir(k: string) {
    if (param) {
      const p = new URLSearchParams(search.toString());
      // A primeira aba não suja a URL — endereço limpo é o padrão.
      if (k === primeira) p.delete(param);
      else p.set(param, k);
      const q = p.toString();
      // `replace` e não `push`: alternar entre abas não deve encher o histórico
      // a ponto de o Voltar precisar de dez toques para sair da página.
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }
    onChange?.(k);
  }

  /** Setas navegam entre abas — exigência de `role="tablist"`, não enfeite. */
  function teclado(e: React.KeyboardEvent, i: number) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -999 : e.key === "End" ? 999 : 0;
    if (!dir) return;
    e.preventDefault();
    const ativos = tabs.map((t, idx) => (t.disabled ? -1 : idx)).filter((x) => x >= 0);
    const pos = ativos.indexOf(i);
    const alvo =
      dir === -999 ? ativos[0]! : dir === 999 ? ativos[ativos.length - 1]! : ativos[(pos + dir + ativos.length) % ativos.length]!;
    refs.current[alvo]?.focus();
    // Aba de outra rota NÃO se ativa com a seta: ativar é sair da tela, e
    // atravessar a barra com o teclado passaria por cada uma delas no caminho.
    // Quem quer ir aperta Enter — que é o comportamento nativo do link.
    if (daTela(tabs[alvo]!)) ir(tabs[alvo]!.key);
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      data-testid="abas"
      className={cn("flex flex-wrap items-center gap-1 border-b border-border", className)}
    >
      {tabs.map((t, i) => {
        const ativa = t.key === atual;
        const Icone = t.icon;
        // Separador quando a família muda. `aria-hidden` e fora do fluxo de
        // teclado: para quem navega por setas, ele não existe — o agrupamento
        // é uma ajuda visual, não uma parada a mais.
        const trocouGrupo = i > 0 && t.grupo !== tabs[i - 1]!.grupo;
        const aparencia = cn(
          "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
          ativa
            ? "border-primary font-semibold text-primary"
            : "border-transparent text-text-muted hover:border-border-strong hover:text-text",
        );
        const conteudo = (
          <>
            {Icone && <Icone className="size-4" aria-hidden="true" />}
            {t.label}
            {t.badge != null && (
              <span className="ml-0.5 rounded-full bg-surface-2 px-1.5 text-2xs tabular-nums text-text-muted">
                {t.badge}
              </span>
            )}
          </>
        );
        return (
          <React.Fragment key={t.key}>
            {trocouGrupo && (
              <span aria-hidden="true" className="mx-2 h-4 w-px shrink-0 self-center bg-border" />
            )}
          {t.href ? (
            /**
             * ABA QUE É OUTRA ROTA — `<Link>`, e não botão que navega.
             *
             * Fica dentro do mesmo `tablist` de propósito: é UMA barra, e o
             * teclado continua atravessando-a com as setas. `aria-selected` é
             * sempre falso porque esta aba nunca é a região exibida aqui — quem
             * a ativa sai da tela, e é a barra da tela de destino que a acende.
             *
             * `<Link>` de verdade porque é navegação de verdade: abre em nova
             * aba, entra no histórico e funciona sem JavaScript. Mesma escolha
             * que `AbasRota` faz nas barras que são só navegação.
             */
            <Link
              ref={(el) => {
                refs.current[i] = el;
              }}
              href={t.href}
              role="tab"
              id={`aba-${t.key}`}
              aria-selected={false}
              tabIndex={-1}
              onKeyDown={(e) => teclado(e, i)}
              className={aparencia}
            >
              {conteudo}
            </Link>
          ) : (
          <button
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`aba-${t.key}`}
            aria-selected={ativa}
            /**
             * `aria-controls` só quando o painel EXISTE.
             *
             * Ele era incondicional e apontava para `painel-<key>`, que só o
             * `TabPanel` renderiza — e o `TabPanel` é usado em UM arquivo, a
             * vitrine do design system. Nas doze telas reais, toda aba
             * declarava controlar um elemento inexistente: violação crítica
             * (`aria-valid-attr-value`), e o leitor de tela anuncia uma relação
             * quebrada, que é pior que relação nenhuma.
             *
             * É o mesmo formato do defeito do `fieldAria`: o primitivo exporta
             * o par correto, a vitrine demonstra, e nenhuma tela real usa. Aqui
             * a saída é diferente — em vez de injetar, o componente para de
             * afirmar o que não pode garantir. Quem renderiza `TabPanel` liga o
             * atributo passando `comPainel`.
             */
            aria-controls={comPainel ? `painel-${t.key}` : undefined}
            // Só a aba ativa entra na ordem de Tab; dentro do tablist, as setas
            // é que navegam. É o padrão ARIA, e evita 9 paradas de Tab seguidas.
            tabIndex={ativa ? 0 : -1}
            disabled={t.disabled}
            onClick={() => ir(t.key)}
            onKeyDown={(e) => teclado(e, i)}
            className={aparencia}
          >
            {conteudo}
          </button>
          )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** O painel da aba. Sem ele o `aria-controls` do botão aponta para o vazio. */
export function TabPanel({
  aba,
  atual,
  children,
  className,
}: {
  aba: string;
  atual: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (aba !== atual) return null;
  return (
    <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} tabIndex={0} className={className}>
      {children}
    </div>
  );
}

/**
 * Lê a aba atual da URL no componente pai (que precisa saber qual painel montar).
 * Chama `resolverAba` — a MESMA função do `Tabs`, e não uma segunda cópia da
 * regra, que é como barra acesa e painel montado passam a discordar.
 */
export function useAbaAtual(tabs: Aba[], param = "aba") {
  const search = useSearchParams();
  return resolverAba(tabs, search.get(param));
}
