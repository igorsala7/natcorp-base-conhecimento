"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, controlClass } from "@/components/ui/input";

/**
 * Confirmação e entrada de texto COM design — o substituto dos
 * `confirm()`/`prompt()` nativos, que quebravam a linguagem visual do admin
 * (e nem dark mode respeitavam).
 *
 * Uso: `const { confirmar, pedirTexto } = useConfirm()` e depois
 * `if (await confirmar({ title: "Excluir?" , tone: "danger" })) …`.
 * O Provider vive no layout do admin; as promessas resolvem no clique
 * (Esc/fechar = false/null, como os nativos).
 */

export type ConfirmarOpts = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` pinta o botão de confirmação como destrutivo. */
  tone?: "primary" | "danger";
  /** Trava o botão até o usuário digitar EXATAMENTE este texto. */
  typeToConfirm?: string;
};

export type PedirTextoOpts = {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initial?: string;
  multiline?: boolean;
  confirmLabel?: string;
  /** `false` permite confirmar vazio (devolve ""). Padrão: exige algo. */
  required?: boolean;
};

type Ctx = {
  confirmar: (opts: ConfirmarOpts) => Promise<boolean>;
  pedirTexto: (opts: PedirTextoOpts) => Promise<string | null>;
};

const ConfirmContext = createContext<Ctx | null>(null);

export function useConfirm(): Ctx {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm precisa do <ConfirmProvider> (layout do admin).");
  return ctx;
}

type Pendente =
  | { kind: "confirm"; opts: ConfirmarOpts; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PedirTextoOpts; resolve: (v: string | null) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [texto, setTexto] = useState("");
  // Guarda de corrida: dois pedidos simultâneos — o segundo cancela o primeiro
  // em vez de sobrescrevê-lo e deixar uma promessa pendurada para sempre.
  const pendenteRef = useRef<Pendente | null>(null);

  const abrir = useCallback((p: Pendente) => {
    const anterior = pendenteRef.current;
    if (anterior) {
      if (anterior.kind === "confirm") anterior.resolve(false);
      else anterior.resolve(null);
    }
    pendenteRef.current = p;
    setTexto(p.kind === "prompt" ? (p.opts.initial ?? "") : "");
    setPendente(p);
  }, []);

  const confirmar = useCallback(
    (opts: ConfirmarOpts) =>
      new Promise<boolean>((resolve) => abrir({ kind: "confirm", opts, resolve })),
    [abrir],
  );
  const pedirTexto = useCallback(
    (opts: PedirTextoOpts) =>
      new Promise<string | null>((resolve) => abrir({ kind: "prompt", opts, resolve })),
    [abrir],
  );

  function fechar(valor: boolean | string | null) {
    const p = pendenteRef.current;
    pendenteRef.current = null;
    setPendente(null);
    if (!p) return;
    if (p.kind === "confirm") p.resolve(Boolean(valor));
    else p.resolve(typeof valor === "string" ? valor : null);
  }

  const opts = pendente?.opts;
  const perigo = pendente?.kind === "confirm" && pendente.opts.tone === "danger";
  const alvoDigitado =
    pendente?.kind === "confirm" ? pendente.opts.typeToConfirm ?? null : null;
  const podeConfirmar =
    pendente?.kind === "confirm"
      ? !alvoDigitado || texto.trim() === alvoDigitado
      : pendente?.kind === "prompt"
        ? pendente.opts.required === false || texto.trim().length > 0
        : false;

  function onConfirmar() {
    if (!podeConfirmar) return;
    fechar(pendente?.kind === "prompt" ? texto : true);
  }

  return (
    <ConfirmContext.Provider value={{ confirmar, pedirTexto }}>
      {children}
      {pendente && opts && (
        <Dialog
          open
          onClose={() => fechar(pendente.kind === "prompt" ? null : false)}
          title={opts.title}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => fechar(pendente.kind === "prompt" ? null : false)}>
                {(pendente.kind === "confirm" && pendente.opts.cancelLabel) || "Cancelar"}
              </Button>
              <Button
                variant={perigo ? "danger" : "primary"}
                onClick={onConfirmar}
                disabled={!podeConfirmar}
              >
                {opts.confirmLabel ?? (perigo ? "Excluir" : "Confirmar")}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {opts.description && (
              <p className="flex items-start gap-2.5 text-sm leading-relaxed text-text-muted">
                {perigo && (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand-pink-700" />
                )}
                <span className="min-w-0">{opts.description}</span>
              </p>
            )}

            {pendente.kind === "confirm" && alvoDigitado && (
              <Field
                label={`Digite “${alvoDigitado}” para confirmar`}
                htmlFor="confirm-digitar"
              >
                <Input
                  id="confirm-digitar"
                  autoFocus
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onConfirmar()}
                  placeholder={alvoDigitado}
                />
              </Field>
            )}

            {pendente.kind === "prompt" &&
              (pendente.opts.multiline ? (
                <Field label={pendente.opts.label ?? ""} htmlFor="confirm-texto">
                  <textarea
                    id="confirm-texto"
                    autoFocus
                    rows={3}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder={pendente.opts.placeholder}
                    className={controlClass}
                  />
                </Field>
              ) : (
                <Field label={pendente.opts.label ?? ""} htmlFor="confirm-texto">
                  <Input
                    id="confirm-texto"
                    autoFocus
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onConfirmar()}
                    placeholder={pendente.opts.placeholder}
                  />
                </Field>
              ))}
          </div>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}
