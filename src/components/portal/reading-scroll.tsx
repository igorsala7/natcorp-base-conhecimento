"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { registerView } from "@/app/(portal)/actions";
import { useActiveArticle } from "./active-article";

/**
 * Conta a visualização UMA vez por sessão do navegador. `sessionStorage`
 * indisponível (modo privado estrito) não impede a contagem — só a dedupe.
 */
function contarView(nodeId: string) {
  try {
    const chave = "kb.viewed";
    const vistos: string[] = JSON.parse(sessionStorage.getItem(chave) ?? "[]");
    if (vistos.includes(nodeId)) return;
    sessionStorage.setItem(chave, JSON.stringify([...vistos, nodeId]));
  } catch {
    /* segue sem dedupe */
  }
  void registerView(nodeId);
}

export type PageArticle = { id: string; anchor: string; path: string };

/**
 * Leitura contínua: acompanha qual artigo está na tela, destaca-o na árvore
 * lateral e mantém a URL coerente com o que se está lendo (sem recarregar).
 *
 * Também posiciona no artigo pedido ao abrir e tem um resgate para âncoras
 * ANTIGAS: como agora as âncoras de título são prefixadas pelo artigo (para não
 * colidirem entre artigos da mesma página), um link antigo tipo `#instalacao`
 * é reapontado para `#slug-do-artigo--instalacao`.
 */
export function ReadingScroll({
  articles,
  initialId,
  spaceSlug,
}: {
  articles: PageArticle[];
  initialId: string | null;
  spaceSlug: string;
}) {
  const ctx = useActiveArticle();
  const setOnPage = ctx?.setOnPage;
  const setActiveId = ctx?.setActiveId;
  const pathname = usePathname();

  // Publica os artigos desta página para a árvore lateral.
  useEffect(() => {
    if (!setOnPage) return;
    setOnPage(new Map(articles.map((a) => [a.id, a.anchor])));
    return () => setOnPage(new Map());
  }, [articles, setOnPage]);

  // `articles` muda de identidade a cada render do servidor; o efeito de
  // posicionamento lê pela ref para não re-rolar num refresh qualquer.
  // Sincronizada em efeito (não no render, regra do compilador) e DECLARADA
  // antes do efeito de posicionamento — efeitos rodam na ordem, então a ref
  // está fresca quando `posicionar` lê.
  const articlesRef = useRef(articles);
  useEffect(() => {
    articlesRef.current = articles;
  }, [articles]);

  // Voltar/avançar do navegador restaura o scroll sozinho — reposicionar por
  // cima disso jogaria o leitor para o topo do artigo em vez de onde parou.
  const navegacaoPop = useRef(false);
  useEffect(() => {
    const onPop = () => {
      navegacaoPop.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /**
   * Posiciona no alvo da navegação. Roda a CADA navegação (pathname/initialId),
   * não só no mount: a busca navega client-side (`router.push`) e, na mesma
   * rota dinâmica, o componente NÃO remonta — com o efeito preso no mount, o
   * clique num resultado simplesmente não rolava a página.
   *
   * Também rola por conta própria mesmo quando a âncora existe: o scroll
   * nativo de hash do App Router não é garantido em navegação client-side.
   * Âncora ANTIGA/sem prefixo (`#instalacao`, e é o que a busca gera) é
   * resgatada para `#<âncora-do-artigo>--instalacao`.
   */
  useEffect(() => {
    const posicionar = () => {
      if (navegacaoPop.current) {
        navegacaoPop.current = false;
        return;
      }
      const lista = articlesRef.current;
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (hash) {
        const direto = document.getElementById(hash);
        if (direto) {
          direto.scrollIntoView({ block: "start" });
          return;
        }
        const atual = lista.find((a) => a.id === initialId);
        const resgate = atual && document.getElementById(`${atual.anchor}--${hash}`);
        if (resgate) {
          resgate.scrollIntoView({ block: "start" });
          return;
        }
      }
      // Sem âncora: primeiro artigo fica no topo (o router já rola para lá);
      // qualquer outro recebe o scroll até o título dele.
      if (!initialId || lista[0]?.id === initialId) return;
      const alvo = lista.find((a) => a.id === initialId);
      const el = alvo && document.getElementById(alvo.anchor);
      if (el) el.scrollIntoView({ block: "start" });
    };

    // Dois quadros: deixa o scroll-para-o-topo do próprio router acontecer
    // primeiro — reposicionar depois dele garante que o alvo vence.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(posicionar);
    });
    // Clique em âncora dentro da MESMA página (TOC, link copiado).
    window.addEventListener("hashchange", posicionar);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener("hashchange", posicionar);
    };
  }, [initialId, pathname]);

  // Scroll-spy: qual artigo está sendo lido.
  useEffect(() => {
    if (!setActiveId || articles.length === 0) return;
    const byAnchor = new Map(articles.map((a) => [a.anchor, a]));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const art = byAnchor.get(entry.target.id);
          if (!art) continue;
          setActiveId(art.id);
          // A "visualização" é chegar de fato no artigo durante a leitura —
          // o mesmo sinal do destaque na árvore, não o carregamento da página.
          contarView(art.id);
          // Mantém a URL do artigo que está sendo lido (sem recarregar).
          const url = `/docs/${spaceSlug}/${art.path}`;
          if (window.location.pathname !== url) {
            window.history.replaceState(null, "", url);
          }
          break;
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    for (const a of articles) {
      const el = document.getElementById(a.anchor);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [articles, setActiveId, spaceSlug]);

  return null;
}
