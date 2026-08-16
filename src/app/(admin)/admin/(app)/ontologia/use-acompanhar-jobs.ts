"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ACOMPANHAR UM JOB ATÉ ELE TERMINAR — não até o relógio cansar.
 *
 * As três telas de ingestão sondavam com um teto de ticks: 30, 40 e 60 — ou
 * seja, 75, 100 e 150 segundos, três números diferentes sem motivo. Passado o
 * teto, a sondagem parava e a barra sumia, mesmo com o job rodando.
 *
 * Para o metadado de uma aplicação APEX de 22 MB, isso é garantido: o trabalho
 * dura minutos. Quem processava via "está fazendo", perdia o progresso de vista
 * e não tinha como saber se terminou, travou ou falhou — sem nem um erro para
 * explicar o sumiço.
 *
 * ── Três correções, e a terceira é a que ninguém pede ───────────────────────
 *  1. Para quando o TRABALHO acaba, não quando o contador estoura. O teto vira
 *     uma hora — proteção contra sondar para sempre numa aba esquecida, não
 *     contra job demorado.
 *  2. Começa na MONTAGEM. Recarregar a página no meio de uma importação de 20
 *     minutos mostrava tela limpa, como se nada estivesse rodando.
 *  3. Desacelera. Nos primeiros 30s pergunta a cada 2s (é quando a pessoa está
 *     olhando); depois, a cada 10s. Um job de 20 minutos gerava 480 consultas
 *     no ritmo fixo, quase todas para dizer a mesma coisa.
 */

const RAPIDO = 2_000;
const LENTO = 10_000;
const ACELERADO_ATE = 30_000;
/** Teto absoluto: uma aba esquecida não deve sondar a noite inteira. */
const LIMITE = 60 * 60 * 1000;

export function useAcompanharJobs<T extends { status: string }>(
  buscar: () => Promise<T[]>,
  /** Chamado quando o último job termina — para recarregar o que ele produziu. */
  aoTerminar?: () => void,
) {
  const [jobs, setJobs] = useState<T[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicio = useRef(0);
  const rodando = useRef(false);
  // Refs para o efeito depender só do que importa: as callbacks costumam ser
  // setas novas a cada render, e o loop se remontaria a cada uma. A atribuição
  // vai num efeito — escrever em ref durante o render é o que faz o valor
  // divergir entre a árvore renderizada e a que o React commitou.
  const buscarRef = useRef(buscar);
  const terminarRef = useRef(aoTerminar);
  useEffect(() => {
    buscarRef.current = buscar;
    terminarRef.current = aoTerminar;
  });

  const parar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    rodando.current = false;
  }, []);

  const acompanhar = useCallback(() => {
    if (rodando.current) return;
    rodando.current = true;
    inicio.current = Date.now();

    const passo = async () => {
      const js = await buscarRef.current().catch(() => [] as T[]);
      setJobs(js);

      const ativo = js.some((j) => j.status === "queued" || j.status === "running");
      const decorrido = Date.now() - inicio.current;

      if (!ativo) {
        // Termina de verdade: o trabalho acabou. Só então recarrega o resultado.
        parar();
        terminarRef.current?.();
        return;
      }
      if (decorrido > LIMITE) {
        parar();
        return;
      }
      timer.current = setTimeout(passo, decorrido < ACELERADO_ATE ? RAPIDO : LENTO);
    };
    void passo();
  }, [parar]);

  // Começa sozinho: um job pode ter sido disparado em outra aba, ou a página
  // pode ter sido recarregada no meio dele.
  useEffect(() => {
    acompanhar();
    return parar;
  }, [acompanhar, parar]);

  return { jobs, acompanhar };
}
