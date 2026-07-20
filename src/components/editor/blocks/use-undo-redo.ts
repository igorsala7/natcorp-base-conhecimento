"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Block } from "@/lib/blocks/schema";

const LIMITE = 100;
/** Janela de coalescência: uma rajada de digitação vira um passo só. */
const JANELA_MS = 500;

/**
 * Desfazer/refazer do documento de blocos.
 *
 * O editor guarda o documento como estado JSON, então o "desfazer" nativo do
 * navegador não serve: ele só conhece o texto de um contentEditable, e nem isso
 * sobrevive quando reescrevemos o innerHTML ao aplicar uma marca.
 *
 * `revisao` muda a cada desfazer/refazer e deve virar `key` da lista de blocos:
 * o <RichText> não sobrescreve o DOM enquanto está em foco (para o cursor não
 * pular ao digitar), então sem o remount o texto desfeito não apareceria.
 */
export function useUndoRedo(
  blocks: Block[],
  setBlocks: Dispatch<SetStateAction<Block[]>>,
  aoAplicar?: () => void,
) {
  const historia = useRef<{ passado: Block[][]; futuro: Block[][] }>({ passado: [], futuro: [] });
  const blocosAnteriores = useRef<Block[]>(blocks);
  const ignorar = useRef(false);
  const janela = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [revisao, setRevisao] = useState(0);
  const [pode, setPode] = useState({ desfazer: false, refazer: false });

  const sincronizar = () =>
    setPode({
      desfazer: historia.current.passado.length > 0,
      refazer: historia.current.futuro.length > 0,
    });

  useEffect(() => {
    if (blocks === blocosAnteriores.current) return;
    const anterior = blocosAnteriores.current;
    blocosAnteriores.current = blocks;
    if (ignorar.current) {
      ignorar.current = false;
      return;
    }
    if (janela.current) {
      clearTimeout(janela.current);
    } else {
      historia.current.passado.push(anterior);
      if (historia.current.passado.length > LIMITE) historia.current.passado.shift();
      historia.current.futuro = [];
    }
    janela.current = setTimeout(() => {
      janela.current = null;
    }, JANELA_MS);
    sincronizar();
  }, [blocks]);

  useEffect(() => () => void (janela.current && clearTimeout(janela.current)), []);

  function aplicar(destino: Block[]) {
    if (janela.current) {
      clearTimeout(janela.current);
      janela.current = null;
    }
    ignorar.current = true;
    setBlocks(destino);
    setRevisao((r) => r + 1);
    aoAplicar?.();
    sincronizar();
  }

  function desfazer() {
    const anterior = historia.current.passado.pop();
    if (!anterior) return;
    historia.current.futuro.push(blocks);
    aplicar(anterior);
  }

  function refazer() {
    const proximo = historia.current.futuro.pop();
    if (!proximo) return;
    historia.current.passado.push(blocks);
    aplicar(proximo);
  }

  return { desfazer, refazer, pode, revisao };
}
