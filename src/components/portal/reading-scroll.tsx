"use client";

import { useEffect } from "react";
import { useActiveArticle } from "./active-article";

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

  // Publica os artigos desta página para a árvore lateral.
  useEffect(() => {
    if (!setOnPage) return;
    setOnPage(new Map(articles.map((a) => [a.id, a.anchor])));
    return () => setOnPage(new Map());
  }, [articles, setOnPage]);

  // Posiciona no artigo pedido / resgata âncora antiga.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) {
      if (document.getElementById(hash)) return; // âncora válida: o browser já rolou
      const atual = articles.find((a) => a.id === initialId);
      const resgate = atual && document.getElementById(`${atual.anchor}--${hash}`);
      if (resgate) {
        resgate.scrollIntoView({ block: "start" });
        return;
      }
    }
    // Sem âncora: se o artigo pedido não é o primeiro, rola até ele.
    if (!initialId || articles[0]?.id === initialId) return;
    const alvo = articles.find((a) => a.id === initialId);
    const el = alvo && document.getElementById(alvo.anchor);
    if (el) el.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
