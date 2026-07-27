/**
 * Rola até um elemento e o MANTÉM no topo enquanto a página ainda cresce.
 *
 * A leitura contínua empilha dezenas de artigos e centenas de imagens `lazy`
 * SEM dimensão: quando se rola para uma âncora lá embaixo, o layout ainda está
 * "achatado" (imagens com 0px). Mirar UMA vez cairia numa posição obsoleta e,
 * conforme as imagens de cima carregam e empurram o conteúdo, o leitor pararia
 * em OUTRA seção (o bug: clicar num item e ir parar em outro artigo).
 *
 * Solução: rola para o alvo e RE-ALINHA enquanto a altura do documento muda
 * (imagens entrando), até estabilizar. Aborta se o usuário rolar/teclar. É
 * instantâneo (não "smooth") de propósito — o alvo pode estar a dezenas de
 * milhares de px, e re-alinhar de forma suave brigaria com o próprio ajuste.
 */
export function scrollToElement(el: HTMLElement) {
  const offset = parseInt(getComputedStyle(el).scrollMarginTop, 10) || 0;
  const irPara = () =>
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - offset });

  irPara();

  let ultimaAltura = document.documentElement.scrollHeight;
  let estavel = 0;
  let intervalo = 0;

  const parar = () => {
    clearInterval(intervalo);
    window.removeEventListener("wheel", parar);
    window.removeEventListener("touchmove", parar);
    window.removeEventListener("keydown", onKey);
  };
  // Só teclas de ROLAGEM abortam — digitar numa busca aberta não deve cancelar.
  const onKey = (e: KeyboardEvent) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) parar();
  };

  intervalo = window.setInterval(() => {
    const h = document.documentElement.scrollHeight;
    if (h !== ultimaAltura) {
      ultimaAltura = h;
      irPara();
      estavel = 0;
    } else if (++estavel >= 6) {
      // ~600ms sem o documento mudar de altura → layout assentou.
      parar();
    }
  }, 100);

  window.addEventListener("wheel", parar, { passive: true });
  window.addEventListener("touchmove", parar, { passive: true });
  window.addEventListener("keydown", onKey);
  // Teto de segurança: nunca fica preso re-alinhando para sempre.
  window.setTimeout(parar, 4000);
}
