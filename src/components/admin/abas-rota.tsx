import Link from "next/link";
import { abasDaRota } from "@/lib/admin/mapa-rotas";
import { cn } from "@/lib/utils";

/**
 * A BARRA DE ABAS QUE LÊ DO MAPA.
 *
 * Existiam três jeitos de fazer aba no admin, com três comportamentos:
 *
 *   · `Tabs` (URL, teclado, `role="tablist"`) — 2 telas;
 *   · `Segmented` + `useState` (sem URL, F5 volta à primeira) — 7 telas;
 *   · abas-como-`<Link>` escritas à mão — 5 telas, cada uma com sua cópia do
 *     mesmo bloco de classes.
 *
 * As cópias à mão eram o pior dos três, não por parecerem diferentes, mas por
 * carregarem cada uma a SUA lista de abas — uma segunda verdade ao lado da que
 * o `mapa-rotas` declarava. As duas divergiram: o Cmd+K oferecia abas que a
 * barra não tinha, e a barra tinha abas que o Cmd+K não achava.
 *
 * Este componente resolve as duas coisas de uma vez: um só visual, e a lista
 * vinda de `abasDaRota()` — a mesma função que o Cmd+K chama.
 *
 * ── Quando usar este, e quando usar `Tabs` ──────────────────────────────────
 * Aqui: quando pelo menos uma aba é OUTRA rota (Assistente › Conversas,
 * Desempenho › Acessos). Navegação de verdade, então `<Link>` de verdade —
 * abre em nova aba, aparece no histórico, funciona sem JavaScript.
 *
 * `Tabs` (o primitivo cliente): quando todas as abas são `?aba=` da mesma rota
 * e os dados já estão no cliente. Lá a troca é instantânea e o round-trip ao
 * servidor seria desperdício.
 *
 * ── Por que Server Component ────────────────────────────────────────────────
 * A aba ativa vem de quem renderiza, não da URL lida no cliente: quem monta a
 * página já sabe em que aba está, e resolver de novo no navegador criaria uma
 * janela em que nenhuma aba está acesa.
 */
export function AbasRota({
  rota,
  atual,
  permissoes,
  spaceId,
  className,
}: {
  /** `href` canônico da rota no mapa — ex.: `/admin/assistente`. */
  rota: string;
  /** `key` da aba acesa. */
  atual: string;
  /** Conjunto de `permissoesDo()`. Aba sem permissão não é renderizada. */
  permissoes: Set<string>;
  /** Documentação em jogo, para as abas que carregam `{space}`. */
  spaceId?: string;
  className?: string;
}) {
  const abas = abasDaRota(rota, permissoes, spaceId);
  // Uma aba só não é escolha, é ruído — e zero abas não é barra nenhuma.
  if (abas.length < 2) return null;

  return (
    <nav
      aria-label="Seções da página"
      data-testid="abas"
      className={cn("flex flex-wrap items-center gap-1 border-b border-border", className)}
    >
      {abas.map((a) => {
        const ativa = a.key === atual;
        return (
          <Link
            key={a.key}
            href={a.href}
            // `aria-current` é o que um leitor de tela usa para dizer "você está
            // aqui". Cor e peso sozinhos não comunicam isso.
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors duration-150",
              ativa
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-text-muted hover:border-border-strong hover:text-text",
            )}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
