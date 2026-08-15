"use client";

/**
 * O QUE APARECE QUANDO A TELA QUEBRA.
 *
 * Até aqui, nenhuma das 31 rotas do admin tinha `error.tsx`. Uma exceção não
 * capturada mostrava a tela de erro crua do Next — fundo branco, stack em inglês
 * em produção reduzida a "Application error: a client-side exception has
 * occurred". O usuário não sabia o que fazer nem o que dizer ao suporte.
 *
 * ── Por que o `digest` é o elemento mais importante daqui ───────────────────
 * Em produção o Next esconde a mensagem real do erro e entrega só um `digest`,
 * que casa com a linha do log do servidor. Não há log estruturado no cliente
 * neste produto: o digest é o ÚNICO fio entre "quebrou pra mim" e a causa. Por
 * isso ele é copiável, e não um texto cinza que ninguém consegue transcrever.
 *
 * `reset()` refaz o render do segmento sem recarregar a página — é o que
 * distingue uma falha transitória (rede, race de sessão) de uma quebra real.
 */
import { AlertTriangle, RotateCw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "./button";
import { CopyButton } from "./copy-button";

export function ErroDaRota({
  error,
  reset,
  titulo = "Algo quebrou nesta tela",
  voltarHref = "/admin",
  voltarLabel = "Voltar ao Painel",
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  titulo?: string;
  voltarHref?: string;
  voltarLabel?: string;
}) {
  // Em desenvolvimento a mensagem real vale mais que o digest (que nem existe).
  const detalhe = process.env.NODE_ENV === "development" ? error.message : null;

  return (
    <div
      data-testid="erro-rota"
      role="alert"
      className="mx-auto flex max-w-lg flex-col items-center gap-5 px-6 py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>

      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-text">{titulo}</h1>
        <p className="text-sm text-text-muted">
          O erro foi registrado. Tentar de novo resolve boa parte dos casos — se insistir, mande o código abaixo para
          quem cuida do sistema.
        </p>
      </div>

      {detalhe && (
        <pre className="max-h-40 w-full overflow-auto rounded-md bg-surface-2 p-3 text-left text-2xs text-text-muted">
          {detalhe}
        </pre>
      )}

      {error.digest && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5">
          <code className="text-2xs text-text-muted">{error.digest}</code>
          <CopyButton text={error.digest} label="Copiar código" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {reset && (
          <Button onClick={reset}>
            <RotateCw aria-hidden="true" />
            Tentar de novo
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href={voltarHref}>
            <ArrowLeft aria-hidden="true" />
            {voltarLabel}
          </Link>
        </Button>
      </div>
    </div>
  );
}
