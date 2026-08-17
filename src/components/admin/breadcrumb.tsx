"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { trilha } from "@/lib/admin/mapa-rotas";

/**
 * ONDE VOCÊ ESTÁ — a segunda fonte de posição, que faltava.
 *
 * O `mapa-rotas` declarava, desde o começo, que o breadcrumb lia dele. Ele
 * nunca existiu, e por isso o item aceso na barra lateral era a única resposta
 * para "onde estou" em 31 telas. Quando uma barra de abas atravessava duas
 * seções do menu — o caso de Acessos, que dividia barra com Conversas mas era
 * arquivado em Desempenho —, essa única resposta ficava errada e nada no
 * produto contradizia.
 *
 * ── O que ele mostra, e o que deliberadamente não mostra ────────────────────
 * Seção › Página. Nada mais fundo. A aba já é visível logo abaixo, no corpo da
 * página, e repeti-la aqui só faria a linha crescer sem dizer nada novo. Um
 * terceiro nível com o nome do ARTIGO aberto foi tentado e descartado: o
 * editor já tem o título em foco, e o breadcrumb ficava mais alto que o
 * conteúdo em telas estreitas.
 *
 * ── Por que a seção não é link ──────────────────────────────────────────────
 * "Documentação" e "Plataforma" são agrupamentos do menu, não destinos. Fazê-las
 * clicáveis prometeria uma página de seção que não existe — e beco de um clique
 * é pior que texto estático.
 *
 * Some no celular: lá a barra lateral é uma gaveta e o título da página fica no
 * topo sem competição, então a linha extra só rouba altura de conteúdo.
 */
export function Breadcrumb() {
  const pathname = usePathname();
  const atual = trilha(pathname);

  // Rota fora do mapa (login, definir-senha, 404): sem trilha, sem invenção.
  if (!atual) return null;

  const { secao, rota } = atual;
  const naPropriaRota = pathname === rota.href;

  return (
    <nav aria-label="Trilha de navegação" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
      {secao.titulo && (
        <>
          <span className="shrink-0 text-text-muted">{secao.titulo}</span>
          <ChevronRight className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
        </>
      )}
      {naPropriaRota ? (
        // Já estamos nela: texto, não link. Link para a página atual é ruído
        // para quem navega por teclado — mais uma parada de Tab que não leva
        // a lugar nenhum.
        <span aria-current="page" className="truncate font-medium text-text">
          {rota.rotulo}
        </span>
      ) : (
        <Link
          href={rota.href}
          className="truncate font-medium text-text transition-colors hover:text-primary"
        >
          {rota.rotulo}
        </Link>
      )}
    </nav>
  );
}
