"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

/**
 * Alertas globais (toasts) — o feedback de salvar/criar/excluir/testar aparece
 * num card CENTRALIZADO no topo, bem visível (o antigo esquema era uma barra
 * dentro da página, fácil de perder). SUCESSO/INFO fecham sozinhos em 5s, com o
 * timer PAUSADO enquanto o mouse está em cima; AVISO/ERRO ficam até fechar.
 *
 * O Provider vive no layout do admin (como o ConfirmProvider). `useToast()`
 * devolve `success/error/warning/info`.
 */
type ToastType = "success" | "error" | "warning" | "info";
type Toast = { id: number; type: ToastType; message: string };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  show: (type: ToastType, message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa do <ToastProvider> (layout do admin).");
  return ctx;
}

const ESTILO: Record<ToastType, { icon: typeof Info; classe: string; auto: boolean; role: "status" | "alert" }> = {
  success: {
    icon: CheckCircle2,
    classe: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-100",
    auto: true,
    role: "status",
  },
  info: {
    icon: Info,
    classe: "border-border bg-surface text-text",
    auto: true,
    role: "status",
  },
  warning: {
    icon: AlertTriangle,
    classe: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
    auto: false,
    role: "alert",
  },
  error: {
    icon: XCircle,
    classe: "border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-100",
    auto: false,
    role: "alert",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((type: ToastType, message: string) => {
    if (!message) return;
    const id = (idRef.current += 1);
    // Empilha no máximo 4 (o mais antigo cai) — evita a tela virar coluna de toasts.
    setToasts((ts) => [...ts, { id, type, message }].slice(-4));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => show("success", m),
      error: (m) => show("error", m),
      warning: (m) => show("warning", m),
      info: (m) => show("info", m),
      show,
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-6 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { icon: Icon, classe, auto, role } = ESTILO[toast.type];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parar = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  const iniciar = useCallback(() => {
    if (!auto) return;
    parar();
    timer.current = setTimeout(onClose, 5000);
  }, [auto, onClose, parar]);

  useEffect(() => {
    iniciar();
    return parar;
  }, [iniciar, parar]);

  return (
    <div
      role={role}
      onMouseEnter={parar}
      onMouseLeave={iniciar}
      className={`pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm shadow-3 motion-safe:animate-[fade_150ms_ease-out] ${classe}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 flex-1 whitespace-pre-wrap leading-relaxed">{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
