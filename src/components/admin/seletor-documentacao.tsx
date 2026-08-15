"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Library, Plus, Check } from "lucide-react";
import { DropdownMenu, MenuItem, MenuSeparator } from "@/components/ui/menu";

/**
 * QUAL DOCUMENTAÇÃO ESTÁ EM MANUTENÇÃO.
 *
 * Havia uma segunda dimensão de navegação que não aparecia no chrome: um
 * `<Select>` repetido dentro de oito páginas. Trocar de documentação exigia
 * estar numa delas — nas outras 22 telas, a escolha era invisível e imutável.
 *
 * ── Por que aqui e não na topbar ────────────────────────────────────────────
 * Um seletor no topo é a promessa de que TODA tela obedece a ele. Dez das 30
 * páginas não obedecem — Pessoas, Sistema, Conexões, Operação e as demais de
 * plataforma são cross-doc ou não têm espaço nenhum. Um seletor global inerte
 * em um terço das telas produz a pior versão do problema: você troca e nada
 * muda. Encabeçando a seção DOCUMENTAÇÃO, o raio de efeito fica visível — o que
 * está abaixo obedece, o que está em PLATAFORMA visivelmente não.
 *
 * ── A regra que não pode ser violada ────────────────────────────────────────
 * A PÁGINA resolve, o chrome EXIBE.
 *
 * O layout do App Router não recebe `searchParams`, então do servidor ele só
 * enxerga o cookie. Uma página aberta por link com `?space=X` mostraria X
 * enquanto a barra dizia o valor do cookie — a shell mentindo sobre o editor.
 *
 * Por isso a leitura é feita AQUI, no cliente, na mesma ordem que
 * `resolvedSpaceId` usa no servidor: `?space=` primeiro, cookie depois. O
 * `atualDoServidor` é o que o cookie já dizia; o `useSearchParams` cobre o deep
 * link. Nenhum dos dois GRAVA — quem grava continua sendo o `SpaceSwitcher` da
 * página, a partir do que ela de fato resolveu.
 */
export function SeletorDocumentacao({
  espacos,
  atualDoServidor,
  podeCriar,
}: {
  espacos: { id: string; name: string }[];
  /** O que o cookie dizia no render do servidor. Perde para o `?space=` da URL. */
  atualDoServidor?: string;
  podeCriar: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const pathname = usePathname();
  const daUrl = search.get("space");
  const atualId =
    (daUrl && espacos.some((e) => e.id === daUrl) ? daUrl : atualDoServidor) ??
    espacos[0]?.id;
  const atual = espacos.find((e) => e.id === atualId);

  // Instalação zerada: em vez das seis telas que diziam "Nenhuma documentação."
  // em cinza, o seletor vira a porta de entrada.
  if (espacos.length === 0) {
    return podeCriar ? (
      <Link
        href="/admin/documentacoes"
        className="flex w-full items-center gap-2 rounded-md border border-border-strong px-2.5 py-2 text-sm text-primary transition-colors hover:bg-surface-2"
      >
        <Plus className="size-4 shrink-0" aria-hidden="true" />
        Criar a primeira documentação
      </Link>
    ) : (
      <p className="px-2.5 py-2 text-xs text-text-muted">
        Nenhuma documentação ainda. Peça a um Admin técnico para criar a
        primeira.
      </p>
    );
  }

  return (
    <DropdownMenu
      label={atual?.name ?? "Escolher"}
      icon={Library}
      title={`Documentação atual: ${atual?.name ?? "nenhuma"}. Trocar.`}
      align="start"
      panelWidth={224}
    >
      {/* O painel recebe `close` para o item fechar o menu antes de navegar —
          senão ele fica aberto por cima da tela nova. */}
      {(fechar) => (
        <>
          {espacos.map((e) => (
            <MenuItem
              key={e.id}
              icon={e.id === atualId ? Check : undefined}
              // Troca preservando a TELA: quem está em "Desempenho" continua em
              // "Desempenho", só que da outra documentação. Voltar para uma home a
              // cada troca é o que faz alternar entre clientes custar caro.
              onClick={() => {
                fechar();
                router.push(`${pathname}?space=${e.id}`);
              }}
            >
              {e.name}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem
            icon={Library}
            onClick={() => {
              fechar();
              router.push("/admin/documentacoes");
            }}
          >
            Todas as documentações…
          </MenuItem>
          {podeCriar && (
            <MenuItem
              icon={Plus}
              onClick={() => {
                fechar();
                router.push("/admin/documentacoes?nova=1");
              }}
            >
              Nova documentação…
            </MenuItem>
          )}
        </>
      )}
    </DropdownMenu>
  );
}
