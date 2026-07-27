"use client";

import { useEffect, useRef } from "react";
import { registerView } from "@/app/(portal)/actions";
import { scrollToElement } from "@/lib/portal/scroll";
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
  navTargets,
  initialId,
  spaceSlug,
}: {
  articles: PageArticle[];
  /**
   * TODOS os nós desta página (DIRETÓRIOS + artigos) → mapa `onPage` da árvore.
   * É o que permite clicar num diretório/sub-diretório na árvore e ROLAR até a
   * seção dele (não só nos artigos). O scroll-spy abaixo segue observando apenas
   * `articles` (destaque de leitura + view + URL). Cai em `articles` se ausente.
   */
  navTargets?: PageArticle[];
  initialId: string | null;
  spaceSlug: string;
}) {
  const ctx = useActiveArticle();
  const setOnPage = ctx?.setOnPage;
  const setActiveId = ctx?.setActiveId;

  // Publica os alvos desta página (diretórios + artigos) para a árvore lateral.
  useEffect(() => {
    if (!setOnPage) return;
    const alvos = navTargets ?? articles;
    setOnPage(new Map(alvos.map((a) => [a.id, a.anchor])));
    return () => setOnPage(new Map());
  }, [navTargets, articles, setOnPage]);

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
   * Posiciona no alvo da NAVEGAÇÃO (`initialId`) — só quando ele muda: abertura
   * da página e navegação client-side (`router.push` da busca troca o artigo →
   * troca `initialId` → reposiciona). NÃO depende da URL: rolar ou clicar na
   * árvore mexe a URL via `replaceState`, mas NÃO deve reposicionar. Depender de
   * `initialId` isola isso naturalmente (nossos replaceState não trocam o
   * artigo-alvo) — sem precisar de guardas frágeis.
   *
   * Também rola por conta própria mesmo quando a âncora existe: o scroll nativo
   * de hash do App Router não é garantido em navegação client-side. Âncora
   * ANTIGA/sem prefixo (`#instalacao`) é resgatada para `#<âncora>--instalacao`.
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
          scrollToElement(direto);
          return;
        }
        const atual = lista.find((a) => a.id === initialId);
        const resgate = atual && document.getElementById(`${atual.anchor}--${hash}`);
        if (resgate) {
          scrollToElement(resgate);
          return;
        }
      }
      // Sem âncora: primeiro artigo fica no topo (o router já rola para lá);
      // qualquer outro recebe o scroll até o título dele.
      if (!initialId || lista[0]?.id === initialId) return;
      const alvo = lista.find((a) => a.id === initialId);
      const el = alvo && document.getElementById(alvo.anchor);
      if (el) scrollToElement(el);
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
  }, [initialId]);

  // Scroll-spy: qual artigo está sendo lido.
  useEffect(() => {
    if (!setActiveId || articles.length === 0) return;
    // Âncoras atualmente na "faixa de leitura" (topo). O ativo é o TOPMOST em
    // ORDEM DE DOCUMENTO — não "o primeiro do batch do observer", que era
    // arbitrário: num artigo curto, dois títulos caem na faixa ao mesmo tempo e
    // o spy destacava o IRMÃO DE BAIXO (bug: clicar em "Criação" ia p/ "Indicação").
    const visiveis = new Set<string>();
    const aplicar = () => {
      const art = articles.find((a) => visiveis.has(a.anchor));
      if (!art) return;
      setActiveId(art.id);
      // A "visualização" é chegar de fato no artigo durante a leitura —
      // o mesmo sinal do destaque na árvore, não o carregamento da página.
      contarView(art.id);
      // Mantém a URL do artigo que está sendo lido (sem recarregar). O efeito de
      // posicionamento não reage a isto (depende só de `initialId`), então não
      // precisa de guarda.
      const url = `/docs/${spaceSlug}/${art.path}`;
      if (window.location.pathname !== url) {
        window.history.replaceState(null, "", url);
      }
    };
    // MARGEM DE SEGURANÇA no topo: o artigo ativo é o que ocupa a faixa de
    // leitura ABAIXO do cabeçalho fixo + uma folga. Sem isso, um artigo com
    // só alguns px ainda visíveis no topo continuava "ativo" mesmo com o artigo
    // clicado ocupando ~90% da tela (o topmost intersectava a faixa por um
    // fiapo). A margem = altura do cabeçalho fixo + folga, então o artigo de
    // cima só perde o foco quando encolhe abaixo dessa linha.
    const header = document.querySelector("header");
    const margemTopo = Math.round(header?.getBoundingClientRect().height ?? 0) + 48;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visiveis.add(entry.target.id);
          else visiveis.delete(entry.target.id);
        }
        aplicar();
      },
      { rootMargin: `-${margemTopo}px 0px -55% 0px`, threshold: 0 },
    );
    for (const a of articles) {
      const el = document.getElementById(a.anchor);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [articles, setActiveId, spaceSlug]);

  return null;
}
