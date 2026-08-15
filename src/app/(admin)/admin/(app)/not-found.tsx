import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 404 dentro do admin. Vale principalmente para rota que MUDOU de lugar — nesta
 * rodada de redesenho, várias mudam e a decisão foi não carregar redirects.
 */
export default function NaoEncontrado() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-text-muted">
        <FileQuestion className="size-6" aria-hidden="true" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-text">Esta página não existe</h1>
        <p className="text-sm text-text-muted">
          O endereço pode ter mudado de lugar. Tecle <kbd className="rounded border border-border px-1">⌘K</kbd> para
          procurar pelo nome.
        </p>
      </div>
      <Button asChild variant="ghost">
        <Link href="/admin">
          <ArrowLeft aria-hidden="true" />
          Voltar ao Painel
        </Link>
      </Button>
    </div>
  );
}
