"use client";

import { useEffect, useRef, useState } from "react";

/**
 * RASCUNHO DE FORMULÁRIO — para o trabalho não sumir.
 *
 * O produto preserva bastante coisa: largura de painel, árvore expandida,
 * buscas recentes, o corpo do artigo no editor. Tudo isso é PREFERÊNCIA ou
 * conteúdo já salvo. O que ele não preservava era o que a pessoa acabou de
 * DIGITAR num formulário e ainda não salvou.
 *
 * O caso que motivou isto está escrito no próprio código, no `Sheet` do editor
 * de tool: "Um Esc distraído aqui custa ~40 campos preenchidos." A saída
 * escolhida foi `dismissible={false}` — o Esc deixou de fechar. Resolve o Esc.
 * Não resolve recarregar a página, a aba morrer, a sessão expirar, o navegador
 * atualizar sozinho, nem a queda de conexão no meio. Em todos esses, os 40
 * campos vão embora do mesmo jeito, e a pessoa não fez nada de errado.
 *
 * ── As três decisões que fazem isto não atrapalhar ──────────────────────────
 *
 * 1. NÃO grava o valor inicial. Abrir um cadastro e fechar sem tocar em nada
 *    não pode deixar rascunho para trás — senão toda abertura futura oferece
 *    "recuperar" um rascunho idêntico ao que já está lá, e o aviso vira ruído
 *    que se aprende a ignorar.
 *
 * 2. Restaura UMA vez, na montagem, e AVISA. Recuperar em silêncio é pior que
 *    não recuperar: a pessoa não sabe se está vendo o que salvou ou o que
 *    digitou; `recuperado` existe para a tela poder dizer, e `descartar` para
 *    ela poder discordar.
 *
 * 3. Expira. Rascunho de três semanas atrás quase nunca é o que se quer
 *    retomar, e localStorage não tem coleta de lixo. Sete dias.
 */
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;
const ESPERA_MS = 600;

type Guardado<T> = { em: number; valor: T };

export function useRascunho<T>(
  /** Chave estável por ENTIDADE (`tool:<id>` ou `tool:novo`), não por sessão. */
  chave: string,
  /** O instantâneo atual do formulário. Costuma ser o mesmo objeto do `payload()`. */
  valor: T,
  /** Repõe o formulário a partir do que foi guardado. Chamado só na montagem. */
  restaurar: (v: T) => void,
  opts?: {
    /** `false` desliga tudo (ex.: o formulário está desabilitado ou em modo leitura). */
    ativo?: boolean;
  },
): { recuperado: boolean; descartar: () => void; limpar: () => void } {
  const ativo = opts?.ativo ?? true;
  const k = `kb.rascunho.${chave}`;
  const [recuperado, setRecuperado] = useState(false);
  /**
   * A restauração não pode entrar nas dependências do efeito de gravar, senão
   * repor o formulário dispararia uma gravação do que acabou de ser reposto.
   *
   * A sincronização do ref vai num EFEITO, não no corpo do componente: escrever
   * em ref durante o render é efeito colateral em fase de render — no modo
   * concorrente o React pode render... e descartar, deixando o ref apontando
   * para um closure de uma árvore que nunca existiu.
   */
  const restaurarRef = useRef(restaurar);
  useEffect(() => {
    restaurarRef.current = restaurar;
  }, [restaurar]);
  const montou = useRef(false);

  useEffect(() => {
    if (!ativo) return;
    try {
      const cru = localStorage.getItem(k);
      if (!cru) return;
      const g = JSON.parse(cru) as Guardado<T>;
      if (!g || typeof g.em !== "number" || Date.now() - g.em > VALIDADE_MS) {
        localStorage.removeItem(k);
        return;
      }
      restaurarRef.current(g.valor);
      /**
       * `localStorage` só existe depois da montagem, então a leitura não tem
       * como acontecer durante o render — e a bandeira que avisa a pessoa
       * depende dessa leitura. É o caso legítimo da regra: estado derivado de
       * uma fonte EXTERNA, não de props.
       */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecuperado(true);
    } catch {
      // JSON corrompido ou storage indisponível (aba anônima, cota cheia):
      // um rascunho ilegível não pode impedir o formulário de abrir.
      localStorage.removeItem(k);
    }
  }, [k, ativo]);

  useEffect(() => {
    if (!ativo) return;
    // Pula a primeira passada — ver a decisão 1 no cabeçalho.
    if (!montou.current) {
      montou.current = true;
      return;
    }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(k, JSON.stringify({ em: Date.now(), valor } satisfies Guardado<T>));
      } catch {
        // Cota estourada: perder o rascunho é ruim, quebrar a digitação é pior.
      }
    }, ESPERA_MS);
    return () => clearTimeout(t);
  }, [k, valor, ativo]);

  const limpar = () => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* storage indisponível */
    }
  };

  return {
    recuperado,
    descartar: () => {
      limpar();
      setRecuperado(false);
    },
    limpar,
  };
}
