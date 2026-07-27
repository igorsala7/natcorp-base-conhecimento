"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";

/**
 * Loader BLOQUEANTE de tela cheia para operações longas e síncronas (publicar
 * um diretório inteiro, publicar pendências…). Cobre a tela e captura os
 * cliques — impede disparar outra ação enquanto a primeira roda.
 *
 * Espelha o padrão de `ConfirmProvider`/`ToastProvider`. Processos que já têm
 * progresso próprio (jobs de embedding via Realtime, melhoria de diretório em
 * lote no modal) NÃO usam isto — teriam dois indicadores concorrentes.
 */
type LoaderApi = {
  /** Mostra o overlay enquanto `fn` roda e o esconde ao terminar (mesmo em erro). */
  during: <T>(message: string, fn: () => Promise<T>) => Promise<T>;
  show: (message: string) => void;
  hide: () => void;
};

const LoaderContext = createContext<LoaderApi | null>(null);

export function useLoader() {
  const ctx = useContext(LoaderContext);
  if (!ctx) throw new Error("useLoader precisa de <LoaderProvider> na árvore.");
  return ctx;
}

export function LoaderProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  // Conta chamadas aninhadas/concorrentes — só esconde quando a última fecha.
  const ativos = useRef(0);

  const show = useCallback((m: string) => {
    ativos.current += 1;
    setMessage(m);
  }, []);

  const hide = useCallback(() => {
    ativos.current = Math.max(0, ativos.current - 1);
    if (ativos.current === 0) setMessage(null);
  }, []);

  const during = useCallback(
    async <T,>(m: string, fn: () => Promise<T>): Promise<T> => {
      // Atraso curto: uma operação que resolve rápido não pisca o overlay.
      let mostrado = false;
      const timer = setTimeout(() => {
        mostrado = true;
        show(m);
      }, 180);
      try {
        return await fn();
      } finally {
        clearTimeout(timer);
        if (mostrado) hide();
      }
    },
    [show, hide],
  );

  const api = useMemo<LoaderApi>(() => ({ during, show, hide }), [during, show, hide]);

  return (
    <LoaderContext.Provider value={api}>
      {children}
      {message !== null && (
        <div
          role="alertdialog"
          aria-busy="true"
          aria-label={message}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-bg/60 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-4 shadow-2">
            <Loader2 className="size-5 animate-spin text-primary motion-reduce:animate-none" />
            <span className="text-sm font-medium text-text">{message}</span>
          </div>
        </div>
      )}
    </LoaderContext.Provider>
  );
}
