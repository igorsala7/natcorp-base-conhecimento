"use client";

import { useEffect, useRef } from "react";

/**
 * Foco preso num painel modal: Esc fecha, Tab circula por dentro, o foco entra
 * ao abrir e VOLTA ao gatilho ao fechar.
 *
 * Saiu de dentro do [Dialog](./dialog.tsx), onde nasceu, quando o drawer
 * "Perguntar à IA" precisou do mesmo comportamento sem poder usar o Dialog
 * inteiro — ele entra deslizando pela lateral, ocupa a altura toda e não tem a
 * casca de título/tamanho do modal. Duplicar a armadilha de foco ali teria
 * criado a segunda versão de uma coisa que já é sutil o bastante em uma.
 *
 * Sem isto, quem navega por teclado abre o painel e continua tabulando pela
 * página ATRÁS dele; ao fechar, é largado no topo do documento.
 */
export function useFocoPreso(
  aberto: boolean,
  painelRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  // `onClose` costuma ser uma seta nova a cada render; guardar em ref mantém o
  // efeito dependendo SÓ de `aberto` — a armadilha se monta uma vez por
  // abertura, e não a cada digitação dentro do painel.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!aberto) return;
    const gatilho = document.activeElement as HTMLElement | null;

    const focaveis = () =>
      painelRef.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ) ?? ([] as unknown as NodeListOf<HTMLElement>);

    // Foco no primeiro CAMPO, quando houver — é o que a pessoa veio preencher.
    // Sem campo, cai no primeiro focável que não seja o "fechar".
    const campo = painelRef.current?.querySelector<HTMLElement>(
      "input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
    );
    const alvos = focaveis();
    (campo ?? alvos[1] ?? alvos[0])?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const lista = focaveis();
      if (lista.length === 0) return;
      const primeiro = lista[0]!;
      const ultimo = lista[lista.length - 1]!;
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // não rola a página atrás
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      gatilho?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);
}
